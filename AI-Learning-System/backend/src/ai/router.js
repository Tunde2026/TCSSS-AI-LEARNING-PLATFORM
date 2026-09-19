// TODO: decide which tool and model are appropriate for the current conversation.

async function route({ user, messages, agent }) {
  return { tool: null, model: 'default' };
}

module.exports = route;
