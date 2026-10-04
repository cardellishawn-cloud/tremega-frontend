const express = require('express');
const { query, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/notifications - Get all notifications for logged-in user
// (businessId optional/ignored: live table has no business_id column; scoping is user_id only)
router.get('/', [
  query('businessId').optional().isUUID(),
  query('read').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { read } = req.query;
    const userId = req.user.userId;

    // Schema fix: the LIVE notifications table has no business_id column
    // (cols: user_id, type, title, message, is_read, related_type, related_id).
    // Scope by the caller only.
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (read !== undefined) {
      query = query.eq('is_read', read === 'true');
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    res.json({
      notifications,
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Notification not found' });
      }
      throw error;
    }

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
// (businessId param dropped: live table has no business_id column)
router.put('/mark-all-read', [], async (req, res) => {
  try {
    const userId = req.user.userId;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
