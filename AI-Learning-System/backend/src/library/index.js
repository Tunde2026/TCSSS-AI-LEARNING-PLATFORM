const router = require('./routes');
const { search } = require('./retrieval');

module.exports = { router, retrieval: { search } };
