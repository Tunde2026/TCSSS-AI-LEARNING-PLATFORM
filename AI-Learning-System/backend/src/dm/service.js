// ============================================================
// dm/service.js — direct messaging between students
// ============================================================
const db      = require('../db');
const logger  = require('../core/logger');
const { chat } = require('../ai/gateway');
const { runWithTools } = require('../ai/tool-executor');

const REGISTER_URL = 'https://tcsss-ai-learning-platform.onrender.com/';

const AI_MENTION_RE = /(^|\s)@ai(\s|$)/i;

/* ---------- Search ---------- */
async function search(query, userId) {
  if (!query || query.trim().length < 2) {
    return { ok: false, code: 'QUERY_TOO_SHORT' };
  }
  const users = await db.directMessages.searchUsers(query, userId, 15);
  return { ok: true, users };
}

/* ---------- Start or get a DM ---------- */
async function startConversation({ userId, identifier }) {
  if (!identifier) return { ok: false, code: 'NO_IDENTIFIER' };

  // Try to find the target user
  const target = await db.directMessages.findUserByIdOrEmail(identifier, userId);

  if (!target) {
    return {
      ok: false,
      code: 'USER_NOT_FOUND',
      inviteUrl: REGISTER_URL,
      message: 'That person is not on the platform yet. Send them this link so they can join:',
    };
  }

  // Check for existing DM
  let convId;
  const existing = await db.directMessages.findExistingDirect(userId, target.id);
  if (existing) {
    convId = existing.id;
  } else {
    convId = await db.directMessages.createDirectConversation(userId, target.id);
  }

  return {
    ok: true,
    conversation: { id: convId },
    other: target,
  };
}

/* ---------- List conversations ---------- */
async function listMine(userId) {
  const convs = await db.directMessages.listMyConversations(userId);
  return { ok: true, conversations: convs };
}

/* ---------- Get a conversation's messages ---------- */
async function getConversation({ userId, conversationId }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };

  const [members, messages] = await Promise.all([
    db.directMessages.getMembers(conversationId),
    db.directMessages.listMessages(conversationId, 100),
  ]);

  await db.directMessages.markRead(conversationId, userId);

  return { ok: true, members, messages };
}

/* ---------- Send message (with @ai detection) ---------- */
async function sendMessage({ userId, conversationId, body, replyToId }) {
  if (!body || !body.trim()) return { ok: false, code: 'EMPTY' };
  if (body.length > 4000) return { ok: false, code: 'TOO_LONG' };

  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };

  const userMsg = await db.directMessages.createMessage({
    conversationId,
    authorId: userId,
    body: body.trim(),
    isAi: false,
    replyToId: replyToId || null,
  });

  const wantsAi = AI_MENTION_RE.test(body);

  let aiMsg = null;

  if (wantsAi) {
    // Strip @ai from the text so the prompt is clean
    const promptText = body.replace(AI_MENTION_RE, ' ').trim();

    try {
      // Load recent history for context
      const recent = await db.directMessages.listMessages(conversationId, 20);

      const contextLines = recent.map(function (m) {
        if (m.is_ai) return 'AI: ' + m.body;
        return (m.author_name || 'User') + ': ' + m.body;
      });

      const systemPrompt = `You are an AI tutor inside a student chat on the TCSSS AI Learning Platform.
You can help with questions, but ALSO create learning tools by calling the tools available to you.
When a student mentions @ai and asks for a quiz, flashcards, practice, theory, exam, a diagram, a formula, a study plan, or their mistakes — call the appropriate tool.
Keep your text answer short. The tool widget will appear below your message.
Never claim a tool ran unless it actually did.`;

      const userPrompt = `Conversation so far:\n${contextLines.join('\n')}\n\nAnswer the latest @ai request.`;

      // Full tool-calling pipeline
      const exec = await runWithTools({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        user: { id: userId },
        temperature: 0.6,
        maxTokens: 900,
      });

      const media = (exec.toolObjects && exec.toolObjects.length)
        ? { tools: exec.toolObjects }
        : null;

      aiMsg = await db.directMessages.createMessage({
        conversationId,
        authorId: null,
        body: exec.text || 'Done.',
        isAi: true,
        aiProvider: exec.provider,
        media: media,
      });
    } catch (err) {
      logger.warn('[dm] AI mention failed: ' + err.message);
      aiMsg = await db.directMessages.createMessage({
        conversationId,
        authorId: null,
        body: 'The AI is not available right now. Please try again in a moment.',
        isAi: true,
      });
    }
  }

  return { ok: true, message: userMsg, aiMessage: aiMsg };
}

/* ---------- Unread count ---------- */
async function unreadCount(userId) {
  const n = await db.directMessages.countTotalUnread(userId);
  return { ok: true, unread: n };
}


async function editMessage({ userId, conversationId, messageId, newBody }) {
  if (!newBody || !newBody.trim()) return { ok: false, code: 'EMPTY' };
  if (newBody.length > 4000) return { ok: false, code: 'TOO_LONG' };
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const updated = await db.directMessages.editMessage(messageId, userId, newBody.trim());
  if (!updated) return { ok: false, code: 'NOT_FOUND_OR_NOT_OWNER' };
  return { ok: true, message: updated };
}

async function deleteMessage({ userId, conversationId, messageId }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const ok = await db.directMessages.softDeleteMessage(messageId, userId);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND_OR_NOT_OWNER' };
}

async function reactMessage({ userId, conversationId, messageId, emoji }) {
  const ALLOWED = ['❤️','👍','😂','🎉','😮','👏','🔥','🙏'];
  if (!ALLOWED.includes(emoji)) return { ok: false, code: 'INVALID_EMOJI' };
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const result = await db.directMessages.toggleReaction(messageId, userId, emoji);
  return { ok: true, removed: result.removed };
}


async function setPinned({ userId, conversationId, pinned }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const row = await db.directMessages.setPinned(conversationId, userId, pinned);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, pinned: row.pinned };
}


async function listFolders(userId) {
  const folders = await db.directMessages.listFolders(userId);
  return { ok: true, folders };
}
async function createFolder({ userId, name, icon }) {
  if (!name || !name.trim()) return { ok: false, code: 'EMPTY_NAME' };
  if (name.length > 40) return { ok: false, code: 'TOO_LONG' };
  const f = await db.directMessages.createFolder(userId, name.trim(), icon);
  return { ok: true, folder: f };
}
async function renameFolder({ userId, folderId, name, icon }) {
  const f = await db.directMessages.renameFolder(folderId, userId, name, icon);
  if (!f) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, folder: f };
}
async function deleteFolder({ userId, folderId }) {
  const ok = await db.directMessages.deleteFolder(folderId, userId);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}
async function moveToFolder({ userId, conversationId, folderId }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const row = await db.directMessages.moveConversationToFolder(conversationId, userId, folderId || null);
  return row ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}


async function createGroup({ userId, name, avatarEmoji, memberIds }) {
  if (!name || !name.trim()) return { ok: false, code: 'EMPTY_NAME' };
  if (name.length > 60) return { ok: false, code: 'TOO_LONG' };
  if (!Array.isArray(memberIds) || memberIds.length < 1) return { ok: false, code: 'NEEDS_MEMBERS' };
  if (memberIds.length > 30) return { ok: false, code: 'TOO_MANY' };

  const convId = await db.directMessages.createGroup({
    creatorId: userId,
    name: name.trim(),
    avatarEmoji: avatarEmoji || '👥',
    memberIds: memberIds,
  });
  return { ok: true, conversationId: convId };
}

async function addMember({ userId, conversationId, targetId }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const isAdmin = await db.directMessages.isGroupAdmin(conversationId, userId);
  if (!isAdmin) return { ok: false, code: 'NOT_ADMIN' };

  const added = await db.directMessages.addGroupMember(conversationId, targetId);
  if (!added) return { ok: false, code: 'ALREADY_MEMBER' };

  await db.directMessages.createMessage({
    conversationId: conversationId,
    authorId: null,
    body: 'A new member joined the group.',
    isAi: false,
  });
  return { ok: true };
}

async function leaveGroup({ userId, conversationId }) {
  const isMember = await db.directMessages.isMember(conversationId, userId);
  if (!isMember) return { ok: false, code: 'FORBIDDEN' };
  const removed = await db.directMessages.removeGroupMember(conversationId, userId);
  return removed ? { ok: true } : { ok: false, code: 'FAILED' };
}

async function renameGroup({ userId, conversationId, name, avatarEmoji }) {
  const isAdmin = await db.directMessages.isGroupAdmin(conversationId, userId);
  if (!isAdmin) return { ok: false, code: 'NOT_ADMIN' };
  const row = await db.directMessages.renameGroup(conversationId, name, avatarEmoji);
  if (!row) return { ok: false, code: 'NOT_GROUP' };
  return { ok: true, group: row };
}

async function kickMember({ userId, conversationId, targetId }) {
  const isAdmin = await db.directMessages.isGroupAdmin(conversationId, userId);
  if (!isAdmin) return { ok: false, code: 'NOT_ADMIN' };
  if (targetId === userId) return { ok: false, code: 'CANNOT_KICK_SELF' };
  const removed = await db.directMessages.removeGroupMember(conversationId, targetId);
  return removed ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

module.exports = {
  search,
  startConversation,
  listMine,
  getConversation,
  sendMessage,
  unreadCount,
  editMessage,
  deleteMessage,
  reactMessage,
  setPinned,
  createGroup,
  addMember,
  leaveGroup,
  renameGroup,
  kickMember,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveToFolder,
  REGISTER_URL,
};
