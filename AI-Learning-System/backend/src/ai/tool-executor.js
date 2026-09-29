// ============================================================
// ai/tool-executor.js
// ------------------------------------------------------------
// Runs the tool-calling loop:
//   1. Send messages + tools to the gateway
//   2. If the AI returns tool_calls, dispatch each one
//   3. Append results as role: 'tool' messages
//   4. Call gateway again so the AI can summarise
//   5. Repeat up to MAX_ROUNDS
// ============================================================

const logger  = require('../core/logger');
const gateway = require('./gateway');
const { TOOL_SCHEMAS } = require('./tools-schema');
const { dispatch } = require('./tool-dispatch');

const MAX_ROUNDS = 3;

async function runWithTools(input) {
  const messages    = input.messages || [];
  const user        = input.user;
  const temperature = input.temperature != null ? input.temperature : 0.7;
  const maxTokens   = input.maxTokens   != null ? input.maxTokens   : 4096;

  let conversationMessages = messages.slice();
  const toolObjects = [];
  let lastResult = null;
  let usedNativeTools = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let result;
    try {
      result = await gateway.chat({
        messages: conversationMessages,
        temperature,
        maxTokens,
        tools: TOOL_SCHEMAS,
        toolChoice: 'auto',
      });
    } catch (err) {
      if (err.message === 'REQUEST_REJECTED' && round === 0 && !usedNativeTools) {
        logger.warn('[tool-executor] provider rejected tools — retrying without');
        result = await gateway.chat({ messages: conversationMessages, temperature, maxTokens });
      } else {
        throw err;
      }
    }

    lastResult = result;

    if (!result.toolCalls || !result.toolCalls.length) {
      return {
        text: result.text || '',
        toolObjects,
        provider: result.provider,
        attempts: result.attempts,
        rounds: round + 1,
        usedNativeTools,
      };
    }

    usedNativeTools = true;

    conversationMessages.push({
      role: 'assistant',
      content: result.text || '',
      tool_calls: result.toolCalls,
    });

    for (const tc of result.toolCalls) {
      const toolName = tc.function && tc.function.name;
      let parsedArgs = {};
      try { parsedArgs = JSON.parse((tc.function && tc.function.arguments) || '{}'); }
      catch (_) {}

      logger.info('[tool-executor] calling ' + toolName + ' with ' + JSON.stringify(parsedArgs));

      const dispatched = await dispatch(toolName, parsedArgs, { user });
      if (dispatched.toolObject) toolObjects.push(dispatched.toolObject);

      conversationMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(dispatched.resultForAI || { ok: dispatched.ok }),
      });
    }
  }

  return {
    text: (lastResult && lastResult.text) || 'Done.',
    toolObjects,
    provider: lastResult && lastResult.provider,
    attempts: lastResult && lastResult.attempts,
    rounds: MAX_ROUNDS,
    usedNativeTools,
  };
}

module.exports = { runWithTools };
