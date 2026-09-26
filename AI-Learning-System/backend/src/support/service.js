// ============================================================
// support/service.js
// ------------------------------------------------------------
// Business logic for the Support system.
//
// Ownership model:
//   - Students can edit/delete their own messages on their own ticket
//   - Admins can edit/delete their own admin replies
//   - Legacy messages with sender_id = null fall back to ticket ownership
// ============================================================

const db     = require('../db');
const logger = require('../core/logger');

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH    = 5000;

const AUTO_REPLY_BODY =
  "Thanks for reaching out — we've received your message and our team " +
  "will get back to you shortly. Please come back to this page to check " +
  "for a reply. If this is urgent, contact us on WhatsApp using the number " +
  "you provided.";

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_RE = /^\+?[\d\s\-()]{7,20}$/;

function validateSubmission({ name, email, whatsapp, category, subject, body }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) return 'Please enter your name.';
  if (!email || !EMAIL_RE.test(String(email))) return 'Please enter a valid email address.';
  if (!whatsapp || !WHATSAPP_RE.test(String(whatsapp))) return 'Please enter a valid WhatsApp number (at least 7 digits).';
  if (!db.support.VALID_CATEGORIES.includes(category)) return 'Please choose a category.';
  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) return 'Please enter a short subject.';
  if (subject.length > MAX_SUBJECT_LENGTH) return 'Subject is too long.';
  if (!body || typeof body !== 'string' || body.trim().length < 10) return 'Please describe your issue in a bit more detail.';
  if (body.length > MAX_BODY_LENGTH) return 'Message is too long (max 5000 characters).';
  return null;
}

/* ------------------------------------------------------------
   Submit a new ticket
   ------------------------------------------------------------ */
async function submit({ user, name, email, whatsapp, category, subject, body }) {
  const err = validateSubmission({ name, email, whatsapp, category, subject, body });
  if (err) return { ok: false, code: 'INVALID', detail: err };

  const userId = user ? user.id : null;

  const ticket = await db.support.createTicket({
    userId: userId,
    name: name.trim(),
    email: email.trim(),
    whatsapp: whatsapp.trim(),
    category,
    subject: subject.trim(),
  });

  // The student's opening message
  await db.support.addMessage({
    ticketId: ticket.id,
    senderType: 'student',
    senderId: userId,
    senderName: name.trim(),
    body: body.trim(),
    readByStudent: true,
    readByAdmin: false,
  });

  // The system's auto-reply
  await db.support.addMessage({
    ticketId: ticket.id,
    senderType: 'system',
    senderName: 'AI Learning Platform',
    body: AUTO_REPLY_BODY,
    readByStudent: false,
    readByAdmin: true,
  });

  await db.support.touchTicket(ticket.id);

  logger.info('[support] new ticket ' + ticket.id + ' (' + category + ') from ' + email);
  return { ok: true, ticket };
}

/* ------------------------------------------------------------
   Get a ticket + messages (student or admin)
   ------------------------------------------------------------ */
async function getTicket({ ticketId, userId, isAdmin }) {
  const ticket = await db.support.findTicketById(ticketId);
  if (!ticket) return { ok: false, code: 'NOT_FOUND' };
  if (!isAdmin && ticket.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };

  const messages = await db.support.listMessagesForTicket(ticketId);

  if (isAdmin) {
    await db.support.markMessagesReadByAdmin(ticketId);
  } else {
    await db.support.markMessagesReadByStudent(ticketId);
  }

  return { ok: true, ticket, messages };
}

/* ------------------------------------------------------------
   Student adds a reply
   ------------------------------------------------------------ */
async function studentReply({ ticketId, userId, body }) {
  if (!body || typeof body !== 'string' || body.trim().length < 1) {
    return { ok: false, code: 'EMPTY' };
  }
  if (body.length > MAX_BODY_LENGTH) return { ok: false, code: 'TOO_LONG' };

  const ticket = await db.support.findTicketById(ticketId);
  if (!ticket) return { ok: false, code: 'NOT_FOUND' };
  if (ticket.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  if (ticket.status === 'closed') return { ok: false, code: 'CLOSED' };

  const message = await db.support.addMessage({
    ticketId,
    senderType: 'student',
    senderId: userId,
    senderName: ticket.name,
    body: body.trim(),
    readByStudent: true,
    readByAdmin: false,
  });

  if (ticket.status === 'resolved') {
    await db.support.updateTicketStatus(ticketId, 'open');
  }
  await db.support.touchTicket(ticketId);

  return { ok: true, message };
}

/* ------------------------------------------------------------
   Admin replies
   ------------------------------------------------------------ */
async function adminReply({ ticketId, admin, body }) {
  if (!body || typeof body !== 'string' || body.trim().length < 1) {
    return { ok: false, code: 'EMPTY' };
  }
  if (body.length > MAX_BODY_LENGTH) return { ok: false, code: 'TOO_LONG' };

  const ticket = await db.support.findTicketById(ticketId);
  if (!ticket) return { ok: false, code: 'NOT_FOUND' };

  const message = await db.support.addMessage({
    ticketId,
    senderType: 'admin',
    senderId: admin.id,
    senderName: admin.name || 'Support',
    body: body.trim(),
    readByStudent: false,
    readByAdmin: true,
  });

  if (ticket.status === 'open') {
    await db.support.updateTicketStatus(ticketId, 'in_progress');
  }
  await db.support.touchTicket(ticketId);

  return { ok: true, message };
}

/* ------------------------------------------------------------
   Edit a message.
   Rules:
     - Admins can edit only their own admin replies
     - Students can edit only their own student messages on their own ticket
     - Legacy rows with sender_id = null fall back to ticket ownership
   ------------------------------------------------------------ */
async function editMessage({ messageId, userId, isAdmin, newBody }) {
  if (!newBody || typeof newBody !== 'string' || !newBody.trim()) {
    return { ok: false, code: 'EMPTY' };
  }
  if (newBody.length > MAX_BODY_LENGTH) return { ok: false, code: 'TOO_LONG' };

  const message = await db.support.findMessageById(messageId);
  if (!message) return { ok: false, code: 'NOT_FOUND' };
  if (message.deleted_at) return { ok: false, code: 'DELETED' };

  const ticket = await db.support.findTicketById(message.ticket_id);
  if (!ticket) return { ok: false, code: 'NOT_FOUND' };

  if (isAdmin) {
    if (message.sender_type !== 'admin') return { ok: false, code: 'FORBIDDEN' };
    if (message.sender_id && message.sender_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  } else {
    if (message.sender_type !== 'student') return { ok: false, code: 'FORBIDDEN' };
    if (ticket.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
    if (message.sender_id && message.sender_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  }

  const updated = await db.support.editMessage(messageId, newBody.trim());
  return updated ? { ok: true, message: updated } : { ok: false, code: 'FAILED' };
}

/* ------------------------------------------------------------
   Delete a message (soft delete).
   Same ownership rules as editMessage.
   ------------------------------------------------------------ */
async function deleteMessage({ messageId, userId, isAdmin }) {
  const message = await db.support.findMessageById(messageId);
  if (!message) return { ok: false, code: 'NOT_FOUND' };
  if (message.deleted_at) return { ok: false, code: 'DELETED' };

  const ticket = await db.support.findTicketById(message.ticket_id);
  if (!ticket) return { ok: false, code: 'NOT_FOUND' };

  if (isAdmin) {
    if (message.sender_type !== 'admin') return { ok: false, code: 'FORBIDDEN' };
    if (message.sender_id && message.sender_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  } else {
    if (message.sender_type !== 'student') return { ok: false, code: 'FORBIDDEN' };
    if (ticket.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
    if (message.sender_id && message.sender_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  }

  const deleted = await db.support.softDeleteMessage(messageId);
  return deleted ? { ok: true } : { ok: false, code: 'FAILED' };
}

/* ------------------------------------------------------------
   Admin status change
   ------------------------------------------------------------ */
async function setStatus({ ticketId, status }) {
  if (!db.support.VALID_STATUSES.includes(status)) {
    return { ok: false, code: 'INVALID_STATUS' };
  }
  const updated = await db.support.updateTicketStatus(ticketId, status);
  if (!updated) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, ticket: updated };
}

module.exports = {
  submit,
  getTicket,
  studentReply,
  adminReply,
  editMessage,
  deleteMessage,
  setStatus,
  AUTO_REPLY_BODY,
};