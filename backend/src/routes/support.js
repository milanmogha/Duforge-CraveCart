import { Router } from 'express';
import { Ticket, Notification } from '../models/Misc.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { notify } from '../utils/helpers.js';

const router = Router();

// GET /api/support/ticket-types — v1 get_ticket_types. The types are a schema enum in
// v2 rather than a table, so read them off the model instead of duplicating the list.
router.get('/ticket-types', protect, (req, res) => {
  res.json({ types: Ticket.schema.path('type').enumValues });
});

// ---- Tickets ----

// GET /api/support/tickets (own; admin sees all via ?all=true)
router.get(
  '/tickets',
  protect,
  asyncH(async (req, res) => {
    const q = req.user.role === 'admin' && req.query.all === 'true' ? {} : { user: req.user._id };
    if (req.query.status) q.status = req.query.status;
    const tickets = await Ticket.find(q).sort('-updatedAt').limit(100).populate('user', 'name email role');
    res.json({ tickets });
  })
);

// POST /api/support/tickets { subject, type, priority, message, orderId? }
router.post(
  '/tickets',
  protect,
  asyncH(async (req, res) => {
    const { subject, type, priority, message, orderId } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'subject and message are required' });
    }
    const ticket = await Ticket.create({
      user: req.user._id,
      subject,
      type,
      priority,
      order: orderId || undefined,
      messages: [{ sender: req.user._id, senderRole: req.user.role, message }],
    });
    res.status(201).json({ ticket });
  })
);

// GET /api/support/tickets/:id
router.get(
  '/tickets/:id',
  protect,
  asyncH(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email role')
      .populate('messages.sender', 'name role');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (req.user.role !== 'admin' && String(ticket.user._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your ticket' });
    }
    res.json({ ticket });
  })
);

// POST /api/support/tickets/:id/reply { message }
router.post(
  '/tickets/:id/reply',
  protect,
  asyncH(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const isOwner = String(ticket.user) === String(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ message: 'Not your ticket' });
    }
    if (ticket.status === 'closed') {
      return res.status(400).json({ message: 'Ticket is closed' });
    }
    ticket.messages.push({
      sender: req.user._id,
      senderRole: req.user.role,
      message: req.body.message,
    });
    if (req.user.role === 'admin' && ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();
    if (req.user.role === 'admin') {
      await notify(ticket.user, 'Support replied', `New reply on your ticket: ${ticket.subject}`, { type: 'support' });
    }
    res.json({ ticket });
  })
);

// PUT /api/support/tickets/:id { subject?, description?, type?, priority? } — v1 edit_ticket.
// The owner may correct a ticket while it is still open; once support has resolved or
// closed it the record is frozen, so the thread agents replied to can't be rewritten
// underneath them. Priority stays an admin decision.
router.put(
  '/tickets/:id',
  protect,
  asyncH(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const isOwner = String(ticket.user) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your ticket' });
    }
    if (isOwner && req.user.role !== 'admin' && !['open', 'in_progress'].includes(ticket.status)) {
      return res.status(400).json({ message: 'This ticket is closed and can no longer be edited' });
    }

    const { subject, message, type, priority } = req.body;
    if (subject) ticket.subject = subject;
    if (type && Ticket.schema.path('type').enumValues.includes(type)) ticket.type = type;
    if (priority && req.user.role === 'admin') ticket.priority = priority;
    // v2 has no `description` column — the ticket body is the first entry in the thread.
    // Editing rewrites that opening message; replies are untouched.
    if (message && ticket.messages.length) ticket.messages[0].message = message;

    await ticket.save();
    res.json({ ticket });
  })
);

// PUT /api/support/tickets/:id/status { status } — admin or owner (close only)
router.put(
  '/tickets/:id/status',
  protect,
  asyncH(async (req, res) => {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const isOwner = String(ticket.user) === String(req.user._id);
    if (req.user.role !== 'admin' && !(isOwner && status === 'closed')) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    ticket.status = status;
    await ticket.save();
    res.json({ ticket });
  })
);

// ---- Notifications ----

// GET /api/support/notifications
router.get(
  '/notifications',
  protect,
  asyncH(async (req, res) => {
    const [notifications, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort('-createdAt').limit(50),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ notifications, unread });
  })
);

// PUT /api/support/notifications/read — mark all read
router.put(
  '/notifications/read',
  protect,
  asyncH(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All read' });
  })
);

export default router;
