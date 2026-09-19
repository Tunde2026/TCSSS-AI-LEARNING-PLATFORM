// Loads and validates environment variables.
// Every other module imports config from here — never reads process.env directly.

require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: optional('NODE_ENV', 'development'),

  db: {
    url: required('DATABASE_URL'),
  },

  session: {
    secret: required('SESSION_SECRET'),
    // Session lifetime in milliseconds (7 days)
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },

  ollama: {
    url: optional('OLLAMA_URL', 'http://localhost:11434/v1'),
    model: optional('OLLAMA_MODEL', 'llama3.1:8b'),
  },

  providers: {
    groq: {
      keys: [process.env.GROQ_KEY_1, process.env.GROQ_KEY_2].filter(Boolean),
    },
    cerebras: {
      keys: [process.env.CEREBRAS_KEY_1].filter(Boolean),
    },
    google: {
      keys: [process.env.GOOGLE_KEY_1].filter(Boolean),
    },
    nvidia: {
      keys: [process.env.NVIDIA_KEY_1].filter(Boolean),
    },
    openrouter: {
      keys: [process.env.OPENROUTER_KEY_1].filter(Boolean),
    },
  },
};

module.exports = config;