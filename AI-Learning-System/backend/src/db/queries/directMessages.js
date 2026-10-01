// ============================================================
// db/queries/directMessages.js
// ============================================================
const { pool } = require('../pool');

/* ---------- Search users ---------- */
async function searchUsers(query, excludeUserId, limit) {
  limit = Math.min(20, limit || 15);
  const raw = String(query || '').trim();
  if (raw.length < 2) return [];

  const like = '%' + raw.toLowerCase() + '%';

  const r = await pool.query(
    `SELECT id, name, email, verified
       FROM users
      WHERE id <> $1
        AND COALESCE(suspended, FALSE) = FALSE
        AND (
          LOWER(COALESCE(name,  '')) LIKE $2
          OR LOWER(COALESCE(email, '')) LIKE $2
        )
      ORDER BY
        CASE WHEN LOWER(email) = LOWER($3) THEN 0 ELSE 1 END,
        CASE WHEN LOWER(name)  = LOWER($3) THEN 0 ELSE 1 END,
        name ASC
      LIMIT $4`,
    [excludeUserId, like, raw, limit]
  );
  return r.rows;
}

async function findUserByIdOrEmail(identifier, excludeUserId) {
  const r = await pool.query(
    `SELECT id, name, email, verified
       FROM users
      WHERE id <> $1
        AND suspended = FALSE
        AND (id::text = $2 OR LOWER(email) = LOWER($2))
      LIMIT 1`,
    [excludeUserId, String(identifier).trim()]
  );
  return r.rows[0] || null;
}

/* ---------- Conversations ---------- */
async function findExistingDirect(userIdA, userIdB) {
  const r = await pool.query(
    `SELECT c.id
       FROM direct_conversations c
       JOIN direct_conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
       JOIN direct_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
      WHERE c.is_group = FALSE
      LIMIT 1`,
    [userIdA, userIdB]
  );
  return r.rows[0] || null;
}

async function createDirectConversation(userIdA, userIdB) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query(
      `INSERT INTO direct_conversations (is_group) VALUES (FALSE) RETURNING id`
    );
    const id = c.rows[0].id;
    await client.query(
      `INSERT INTO direct_conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [id, userIdA, userIdB]
    );
    await client.query('COMMIT');
    return id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function isMember(conversationId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM direct_conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
    [conversationId, userId]
  );
  return r.rowCount > 0;
}

async function listMyConversations(userId) {
  const r = await pool.query(
    `SELECT c.id, c.is_group, c.title, c.avatar_emoji, c.created_by, c.last_message_at, m2.pinned, m2.folder_id,
            (SELECT body FROM direct_messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT is_ai FROM direct_messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_is_ai,
            (SELECT COUNT(*)::int FROM direct_messages m
              WHERE m.conversation_id = c.id
                AND m.created_at > m2.last_read_at
                AND m.author_id <> $1) AS unread,
            (SELECT json_agg(json_build_object(
                'id', u.id, 'name', u.name, 'email', u.email, 'verified', u.verified
              ) ORDER BY u.name)
              FROM direct_conversation_members m3
              JOIN users u ON u.id = m3.user_id
              WHERE m3.conversation_id = c.id) AS members
       FROM direct_conversations c
       JOIN direct_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $1
      ORDER BY m2.pinned DESC, c.last_message_at DESC`,
    [userId]
  );
  return r.rows;
}

async function getMembers(conversationId) {
  const r = await pool.query(
    `SELECT u.id, u.name, u.email, u.verified, m.is_admin, m.joined_at
       FROM direct_conversation_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = $1`,
    [conversationId]
  );
  return r.rows;
}

/* ---------- Messages ---------- */
async function listMessages(conversationId, limit) {
  limit = Math.min(200, limit || 80);
  const r = await pool.query(
    `SELECT m.id, m.body, m.is_ai, m.ai_provider, m.created_at,
            m.edited_at, m.deleted_at, m.reply_to_id, m.media,
            u.id AS author_id, u.name AS author_name,
            u.email AS author_email, u.verified AS author_verified,
            reply.body AS reply_body,
            reply.is_ai AS reply_is_ai,
            ru.name   AS reply_author_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                'emoji',  r.emoji,
                'user_id', r.user_id,
                'user_name', ru2.name
              ) ORDER BY r.created_at)
                FROM direct_message_reactions r
                LEFT JOIN users ru2 ON ru2.id = r.user_id
               WHERE r.message_id = m.id
            ), '[]'::json) AS reactions
       FROM direct_messages m
       LEFT JOIN users u ON u.id = m.author_id
       LEFT JOIN direct_messages reply ON reply.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = reply.author_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2`,
    [conversationId, limit]
  );
  return r.rows;
}

async function createMessage({ conversationId, authorId, body, isAi, aiProvider, replyToId, media }) {
  const r = await pool.query(
    `INSERT INTO direct_messages
       (conversation_id, author_id, body, is_ai, ai_provider, reply_to_id, media)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [conversationId, authorId, body, !!isAi, aiProvider || null, replyToId || null, media || null]
  );
  await pool.query(
    'UPDATE direct_conversations SET last_message_at = now(), updated_at = now() WHERE id = $1',
    [conversationId]
  );
  return r.rows[0];
}

async function markRead(conversationId, userId) {
  await pool.query(
    `UPDATE direct_conversation_members
        SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
}

async function countTotalUnread(userId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(
       (SELECT COUNT(*)::int FROM direct_messages m
         WHERE m.conversation_id = c.id
           AND m.created_at > m2.last_read_at
           AND m.author_id <> $1)
     ), 0)::int AS n
       FROM direct_conversations c
       JOIN direct_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $1`,
    [userId]
  );
  return r.rows[0].n;
}


async function editMessage(messageId, userId, newBody) {
  const r = await pool.query(
    `UPDATE direct_messages
        SET body = $1, edited_at = now()
      WHERE id = $2 AND author_id = $3 AND deleted_at IS NULL
      RETURNING *`,
    [newBody, messageId, userId]
  );
  return r.rows[0] || null;
}

async function softDeleteMessage(messageId, userId) {
  const r = await pool.query(
    `UPDATE direct_messages
        SET deleted_at = now()
      WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [messageId, userId]
  );
  return r.rowCount > 0;
}

async function toggleReaction(messageId, userId, emoji) {
  // Delete if exists, insert if not
  const del = await pool.query(
    `DELETE FROM direct_message_reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
      RETURNING id`,
    [messageId, userId, emoji]
  );
  if (del.rowCount > 0) return { removed: true };
  try {
    await pool.query(
      `INSERT INTO direct_message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)`,
      [messageId, userId, emoji]
    );
  } catch (_) { /* unique conflict — ignore */ }
  return { removed: false };
}

async function getMessageAuthor(messageId) {
  const r = await pool.query(
    `SELECT id, conversation_id, author_id FROM direct_messages WHERE id = $1 LIMIT 1`,
    [messageId]
  );
  return r.rows[0] || null;
}


async function setPinned(conversationId, userId, pinned) {
  const r = await pool.query(
    `UPDATE direct_conversation_members
        SET pinned = $1
      WHERE conversation_id = $2 AND user_id = $3
      RETURNING pinned`,
    [!!pinned, conversationId, userId]
  );
  return r.rows[0] || null;
}


async function listFolders(userId) {
  const r = await pool.query(
    `SELECT id, name, icon, position FROM dm_folders
       WHERE user_id = $1 ORDER BY position ASC, created_at ASC`,
    [userId]
  );
  return r.rows;
}

async function createFolder(userId, name, icon) {
  const posR = await pool.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM dm_folders WHERE user_id = $1',
    [userId]
  );
  const pos = posR.rows[0].next;
  const r = await pool.query(
    `INSERT INTO dm_folders (user_id, name, icon, position)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, name, icon || 'fa-folder', pos]
  );
  return r.rows[0];
}

async function renameFolder(folderId, userId, name, icon) {
  const r = await pool.query(
    `UPDATE dm_folders SET name = COALESCE($1, name), icon = COALESCE($2, icon)
      WHERE id = $3 AND user_id = $4 RETURNING *`,
    [name || null, icon || null, folderId, userId]
  );
  return r.rows[0] || null;
}

async function deleteFolder(folderId, userId) {
  const r = await pool.query(
    'DELETE FROM dm_folders WHERE id = $1 AND user_id = $2 RETURNING id',
    [folderId, userId]
  );
  return r.rowCount > 0;
}

async function moveConversationToFolder(conversationId, userId, folderId) {
  const r = await pool.query(
    `UPDATE direct_conversation_members
        SET folder_id = $1
      WHERE conversation_id = $2 AND user_id = $3
      RETURNING folder_id`,
    [folderId, conversationId, userId]
  );
  return r.rows[0] || null;
}


async function createGroup({ creatorId, name, avatarEmoji, memberIds }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const c = await client.query(
      `INSERT INTO direct_conversations (is_group, title, created_by, avatar_emoji, last_message_at)
       VALUES (TRUE, $1, $2, $3, now()) RETURNING id`,
      [name, creatorId, avatarEmoji || '👥']
    );
    const conversationId = c.rows[0].id;

    // Creator as admin
    await client.query(
      `INSERT INTO direct_conversation_members (conversation_id, user_id, is_admin)
       VALUES ($1, $2, TRUE)`,
      [conversationId, creatorId]
    );

    // Other members
    const unique = Array.from(new Set(memberIds)).filter(function (id) { return id !== creatorId; });
    for (const uid of unique) {
      await client.query(
        `INSERT INTO direct_conversation_members (conversation_id, user_id, is_admin)
         VALUES ($1, $2, FALSE)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, uid]
      );
    }

    // System welcome message
    await client.query(
      `INSERT INTO direct_messages (conversation_id, author_id, body, is_ai)
       VALUES ($1, NULL, $2, FALSE)`,
      [conversationId, 'Group created: ' + name]
    );

    await client.query('COMMIT');
    return conversationId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function addGroupMember(conversationId, userId) {
  const r = await pool.query(
    `INSERT INTO direct_conversation_members (conversation_id, user_id, is_admin)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (conversation_id, user_id) DO NOTHING
     RETURNING user_id`,
    [conversationId, userId]
  );
  return r.rowCount > 0;
}

async function removeGroupMember(conversationId, userId) {
  const r = await pool.query(
    `DELETE FROM direct_conversation_members
       WHERE conversation_id = $1 AND user_id = $2
       RETURNING user_id`,
    [conversationId, userId]
  );
  return r.rowCount > 0;
}

async function isGroupAdmin(conversationId, userId) {
  const r = await pool.query(
    `SELECT is_admin FROM direct_conversation_members
       WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
    [conversationId, userId]
  );
  return r.rows[0] && r.rows[0].is_admin === true;
}

async function renameGroup(conversationId, name, avatarEmoji) {
  const r = await pool.query(
    `UPDATE direct_conversations
        SET title = COALESCE($1, title),
            avatar_emoji = COALESCE($2, avatar_emoji),
            updated_at = now()
      WHERE id = $3 AND is_group = TRUE
      RETURNING id, title, avatar_emoji`,
    [name || null, avatarEmoji || null, conversationId]
  );
  return r.rows[0] || null;
}

module.exports = {
  searchUsers,
  findUserByIdOrEmail,
  findExistingDirect,
  createDirectConversation,
  isMember,
  listMyConversations,
  getMembers,
  listMessages,
  createMessage,
  markRead,
  countTotalUnread,
  editMessage, softDeleteMessage, toggleReaction, getMessageAuthor,
  setPinned,
  createGroup, addGroupMember, removeGroupMember, isGroupAdmin, renameGroup,
  listFolders, createFolder, renameFolder, deleteFolder, moveConversationToFolder,
};
