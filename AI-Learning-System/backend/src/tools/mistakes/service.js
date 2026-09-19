// Reads quiz_attempts to surface the topics and questions a student got wrong.

const { pool } = require('../../db').pool;

async function getMistakes(userId) {
  // Pull every graded answer that was wrong, with the question and topic.
  const { rows } = await pool.query(
    `SELECT
        qa.id              AS attempt_id,
        qa.completed_at,
        q.topic            AS topic,
        q.subject          AS subject,
        qq.id              AS question_id,
        qq.question        AS question,
        qq.options         AS options,
        qq.correct_option  AS correct_option,
        qq.explanation     AS explanation,
        ans.value->>'selected' AS selected
       FROM quiz_attempts qa
       JOIN quizzes q         ON q.id = qa.quiz_id
       JOIN quiz_questions qq ON qq.quiz_id = q.id
       JOIN jsonb_array_elements(qa.answers) AS ans(value)
              ON ans.value->>'questionId' = qq.id::text
      WHERE qa.user_id = $1
        AND (ans.value->>'isCorrect')::boolean = false
      ORDER BY qa.completed_at DESC
      LIMIT 200`,
    [userId]
  );

  // Group by topic → unique questions
  const byTopic = {};
  for (const row of rows) {
    const key = row.topic || 'Uncategorized';
    if (!byTopic[key]) {
      byTopic[key] = { topic: key, subject: row.subject, questions: [] };
    }
    // dedupe by question id
    if (!byTopic[key].questions.find(q => q.id === row.question_id)) {
      byTopic[key].questions.push({
        id:          row.question_id,
        question:    row.question,
        options:     row.options,
        correct:     row.correct_option,
        selected:    row.selected,
        explanation: row.explanation,
        missedAt:    row.completed_at,
      });
    }
  }

  return Object.values(byTopic).sort((a, b) => b.questions.length - a.questions.length);
}

module.exports = { getMistakes };