const express = require('express');
const { list } = require('./registry');

const router = express.Router();

router.get('/', (req, res) => {
  // TODO: return a list of registered tools.
  res.status(200).json({ tools: list() });
});

module.exports = router;
