
// ============================================================
// tools/routes.js
// ------------------------------------------------------------
// Mounts every registered tool's router under its sub-path.
// ============================================================

const express = require('express');
const router  = express.Router();
const registry = require('./registry');

router.use('/quiz',          require('./quiz').router);
router.use('/flashcards',    require('./flashcards').router);
router.use('/mistakes',      require('./mistakes').router);
router.use('/notes',         require('./notes').router);
router.use('/practice',      require('./practice').router);
router.use('/visualization', require('./visualization').router);
router.use('/studyplans',    require('./studyplans').router);
router.use('/imagegen',      require('./imagegen').router);
router.use('/imagesearch',   require('./imagesearch').router);

router.get('/', function (req, res) {
  res.json({ tools: registry.list() });
});

module.exports = router;
