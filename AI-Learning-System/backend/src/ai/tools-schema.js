// ============================================================
// ai/tools-schema.js
// ------------------------------------------------------------
// Tool schemas in OpenAI function-calling format.
// Sent to providers that support tool_choice so the model
// can decide when to call a tool instead of us guessing with
// regex on the user's text.
//
// Project rule 9 — the LLM decides; the application executes.
// The model returns tool_calls. The backend validates and runs
// them via the existing tool services.
// ============================================================

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'create_quiz',
      description: 'Create a multiple-choice quiz for the student on a specific topic. Use when the student asks to be quizzed, tested, or given questions.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic of the quiz, e.g. "photosynthesis" or "quadratic equations".' },
          count: { type: 'integer', description: 'Number of questions. Default 10. Max 20.', minimum: 1, maximum: 20 },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Difficulty level.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_flashcards',
      description: 'Create a flashcard deck for the student. Use when they ask for flashcards, key terms, or spaced-repetition cards.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          count: { type: 'integer', minimum: 1, maximum: 30, description: 'Number of cards. Default 10.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_theory',
      description: 'Create a fill-in-the-gap theory exercise. Use when they ask for theory questions or gap-fill practice.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          count: { type: 'integer', minimum: 1, maximum: 15, description: 'Default 5.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_practice',
      description: 'Create a practice question set with hints and model answers.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          count: { type: 'integer', minimum: 1, maximum: 15, description: 'Default 5.' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_study_plan',
      description: 'Create a multi-day study plan with daily tasks. Use when the student asks for a study schedule or plan.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          days: { type: 'integer', minimum: 3, maximum: 30, description: 'Number of days. Default 7.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_exam',
      description: 'Start a timed exam for the student. Like a quiz but under real exam conditions with a countdown and no hints.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          count: { type: 'integer', minimum: 3, maximum: 30, description: 'Default 10.' },
          duration_minutes: { type: 'integer', minimum: 5, maximum: 120, description: 'Total exam time. Default 30.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_visualization',
      description: 'Create a Mermaid diagram (flowchart, mindmap, sequence, class) to visually explain a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          kind: { type: 'string', enum: ['flowchart', 'mindmap', 'sequence', 'class', 'state'] },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_sketch',
      description: 'Format a scientific formula, chemical equation, or mathematical expression with correct notation (H2SO4 -> H₂SO₄, x^2 -> x²). Use for chemistry formulas, physics equations, and math notation.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The raw formula or expression to format, e.g. "H2SO4" or "x^2 + 5x - 3 = 0".' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Use ONLY when the answer needs current/latest data, news, or something that may have changed recently. Do not use for stable academic facts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_images',
      description: 'Find real photographs for a topic. Use when the student asks for photos, pictures, or real images of something.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          count: { type: 'integer', minimum: 1, maximum: 12, description: 'Default 6.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an AI illustration for a concept. Use when the student asks to draw or illustrate something for learning.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Description of the image to generate.' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_note',
      description: 'Save content to the student\'s notes. Use when they explicitly ask to save something as a note.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string', description: 'The note body — markdown is allowed.' },
          subject: { type: 'string', description: 'Optional subject tag.' },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mistakes',
      description: 'Show the student their Mistake Bank — questions they answered wrong in past quizzes, grouped by topic.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Quick lookup: name -> schema (used for validating tool_calls)
const TOOL_MAP = TOOL_SCHEMAS.reduce(function (acc, t) {
  acc[t.function.name] = t;
  return acc;
}, {});

module.exports = { TOOL_SCHEMAS, TOOL_MAP };
