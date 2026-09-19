// Simple console logger with timestamps and levels.
// Replace with a proper logger (pino, winston) when you go to production.

function ts() {
  return new Date().toISOString();
}

function format(level, args) {
  return [`[${ts()}] [${level}]`, ...args];
}

const logger = {
  info:  (...args) => console.log(...format('INFO', args)),
  warn:  (...args) => console.warn(...format('WARN', args)),
  error: (...args) => console.error(...format('ERROR', args)),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...format('DEBUG', args));
    }
  },
};

module.exports = logger;