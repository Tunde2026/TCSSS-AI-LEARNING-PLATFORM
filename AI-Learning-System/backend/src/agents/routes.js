const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  // TODO: list saved agents for the current user.
  res.status(501).json({ error: 'Not implemented' });
});

router.post('/', (req, res) => {
  // TODO: create a new saved agent.
  res.status(501).json({ error: 'Not implemented' });
});

router.put('/:id', (req, res) => {
  // TODO: update a saved agent.
  res.status(501).json({ error: 'Not implemented' });
});

router.delete('/:id', (req, res) => {
  // TODO: remove a saved agent.
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
