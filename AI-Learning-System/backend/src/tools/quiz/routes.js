const express = require('express');
const router  = express.Router();
const service = require('./service');
const db      = require('../../db');
const { requireLogin } = require('../../auth');

router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { topic, count, difficulty, subject, isExam, timeLimitSeconds, description } = req.body || {};
    const result = await service.generate({
      userId: req.user.id, topic, count, difficulty, subject,
      isExam: !!isExam,
      timeLimitSeconds: timeLimitSeconds || null,
      description: description || null,
    });
    if (!result.ok) {
      const map = {
        INVALID_TOPIC:     [400, 'Please provide a topic.'],
        AI_FAILED:         [503, 'The AI is temporarily unavailable. Please try again.'],
        INVALID_AI_OUTPUT: [502, 'The AI returned an unusable response. Please try again.'],
      };
      const [status, msg] = map[result.code] || [400, 'Could not generate quiz.'];
      return res.status(status).json({ error: msg, code: result.code });
    }
    res.status(201).json({ quiz: result.quiz });
  } catch (err) { next(err); }
});

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const list = await db.quizzes.listByUser(req.user.id);
    res.json({ quizzes: list });
  } catch (err) { next(err); }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const quiz = await db.quizzes.findById(req.params.id);
    if (!quiz || quiz.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json({ quiz });
  } catch (err) { next(err); }
});

router.patch('/:id/description', requireLogin, async (req, res, next) => {
  try {
    const description = (req.body && req.body.description != null)
      ? String(req.body.description).slice(0, 500)
      : null;
    const updated = await db.quizzes.setDescription(req.params.id, req.user.id, description);
    if (!updated) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ quiz: updated });
  } catch (err) { next(err); }
});

router.post('/:id/attempt', requireLogin, async (req, res, next) => {
  try {
    const result = await service.gradeAttempt({
      quizId: req.params.id,
      userId: req.user.id,
      answers: req.body && req.body.answers,
      timeTakenSeconds: req.body && req.body.timeTakenSeconds,
    });
    if (!result.ok) {
      const map = {
        NOT_FOUND:       [404, 'Quiz not found.'],
        FORBIDDEN:       [403, 'You cannot submit to this quiz.'],
        INVALID_ANSWERS: [400, 'Answers must be an array.'],
      };
      const [status, msg] = map[result.code] || [400, 'Could not grade attempt.'];
      return res.status(status).json({ error: msg, code: result.code });
    }
    res.json({
      attempt:   result.attempt,
      graded:    result.graded,
      questions: result.questions,
    });
  } catch (err) { next(err); }
});

router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const ok = await db.quizzes.remove(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/history/mine', requireLogin, async (req, res, next) => {
  try {
    const { pool } = require('../../db');
    const { rows } = await pool.query(
      `SELECT
          qa.id AS attempt_id,
          qa.score, qa.total, qa.is_exam, qa.time_taken_seconds,
          qa.completed_at,
          q.id AS quiz_id,
          q.title, q.topic, q.subject, q.difficulty, q.description
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.user_id = $1
       ORDER BY qa.completed_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ attempts: rows });
  } catch (err) { next(err); }
});

module.exports = router;