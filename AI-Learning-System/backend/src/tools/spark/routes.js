// ============================================================
// tools/spark/routes.js
// ------------------------------------------------------------
// Express router for Spark. Mounted at /api/tools/spark.
// ============================================================

const express = require('express');
const router  = express.Router();

const service = require('./service');
const { requireLogin } = require('../../auth');

function statusFor(code) {
  if (code === 'NOT_FOUND')        return 404;
  if (code === 'FORBIDDEN')        return 403;
  if (code === 'ALREADY_COMPLETED') return 409;
  if (code === 'ALREADY_ANSWERED') return 409;
  return 400;
}

// POST /api/tools/spark/start
router.post('/start', requireLogin, async function (req, res, next) {
  try {
    const result = await service.startAssessment(req.user.id);
    if (!result.ok) return res.status(statusFor(result.code)).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/tools/spark/assessment/:id
router.get('/assessment/:id', requireLogin, async function (req, res, next) {
  try {
    const result = await service.getAssessmentState(req.params.id, req.user.id);
    if (!result.ok) return res.status(statusFor(result.code)).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/tools/spark/assessment/:id/respond
router.post('/assessment/:id/respond', requireLogin, async function (req, res, next) {
  try {
    const result = await service.submitResponse(req.params.id, req.user.id, req.body);
    if (!result.ok) return res.status(statusFor(result.code)).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/tools/spark/assessment/:id/result
router.get('/assessment/:id/result', requireLogin, async function (req, res, next) {
  try {
    const result = await service.getResult(req.params.id, req.user.id);
    if (!result.ok) return res.status(statusFor(result.code)).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/tools/spark/assessment/:id/abandon
router.post('/assessment/:id/abandon', requireLogin, async function (req, res, next) {
  try {
    const result = await service.abandonAssessment(req.params.id, req.user.id);
    if (!result.ok) return res.status(statusFor(result.code)).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/tools/spark/history
router.get('/history', requireLogin, async function (req, res, next) {
  try {
    const result = await service.listHistory(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;