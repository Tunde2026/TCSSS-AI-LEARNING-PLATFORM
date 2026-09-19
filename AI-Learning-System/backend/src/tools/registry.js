// ============================================================
// registry.js
// ------------------------------------------------------------
// Every educational tool registers itself here.
//
// Project rule 9 — the LLM decides; the application executes.
// The registry is how the AI Router finds tools. Routes and
// services call registry.get(name) to run one.
//
// Registration shape:
//   {
//     name:         'quiz',                  // unique
//     description:  'Generate a quiz',       // shown to AI router
//     inputSchema:  { ... },                 // JSON schema of inputs
//     execute:      async (input, ctx) => {} // the actual work
//   }
// ============================================================

const tools = new Map();

function register(tool) {
  if (!tool || typeof tool.name !== 'string' || typeof tool.execute !== 'function') {
    throw new Error('Tool must have a string "name" and an "execute" function');
  }
  if (tools.has(tool.name)) {
    throw new Error('Tool already registered: ' + tool.name);
  }
  tools.set(tool.name, tool);
}

function get(name) {
  return tools.get(name) || null;
}

function list() {
  return [...tools.values()].map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

module.exports = { register, get, list };