const registry = require('./registry');

require('./quiz');
require('./flashcards');
require('./mistakes');
require('./websearch');
require('./notes');
require('./practice');
require('./visualization');
require('./studyplans');
require('./imagegen');
require('./imagesearch');

module.exports = {
  registry,
  router: require('./routes'),
};