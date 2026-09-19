const registry = new Map();

// Every tool registers itself here with a name, schema, and execute function.
function register(tool) {
  if (!tool || !tool.name) {
    throw new Error('Tool registration requires a name');
  }

  registry.set(tool.name, tool);
  return tool;
}

function get(name) {
  return registry.get(name);
}

function list() {
  return Array.from(registry.values());
}

module.exports = { register, get, list };
