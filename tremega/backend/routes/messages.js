const express = require('express');
const { body, query, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/messages - Send message
router.post('/', [
  body('content').trim().notEmpty().withMessage('Message content required'),
  body('businessId').isUUID().withMessage('Valid business ID required'),
  body('bidId').optional().isUUID(),
  body('jobId').optional().isUUID(),
  body('subAssignmentId').optional().isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, businessId, bidId, jobId, subAssignmentId } = req.body;
    const senderId = req.user.userId;

    // Validate that exactly one parent is provided
    const parentCount = [bidId, jobId, subAssignmentId].filter(Boolean).length;
    if (parentCount !== 1) {
      return res.status(400).json({ error: 'Exactly one of bidId, jobId, or subAssignmentId required' });
    }

    // Create message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content,
        business_id: businessId,
        bid_id: bidId || null,
        job_id: jobId || null,
        sub_assignment_id: subAssignmentId || null,
        sender_id: senderId,
      })
      .select(`
        *,
        sender:sender_id (id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;

    // Create notifications for recipients
    // Get all users in the business except sender
    const { data: businessUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('business_id', businessId)
      .neq('user_id', senderId)
      .eq('status', 'active');

    // If it's a sub assignment, only notify the assigned sub and contractor
    if (subAssignmentId) {
      const { data: assignment } = await supabase
        .from('sub_assignments')
        .select('sub_user_id, bid_id')
        .eq('id', subAssignmentId)
        .single();

      if (assignment) {
        // Notify the sub
        await supabase.rpc('create_notification', {
          p_user_id: assignment.sub_user_id,
          p_business_id: businessId,
          p_type: 'message',
          p_title: 'New message',
          p_description: content.substring(0, 100),
          p_related_id: message.id,
          p_related_type: 'message',
        });

        // Notify the bid creator (contractor)
        const { data: bid } = await supabase
          .from('bids')
          .select('created_by')
          .eq('id', assignment.bid_id)
          .single();

        if (bid && bid.created_by !== senderId) {
          await supabase.rpc('create_notification', {
            p_user_id: bid.created_by,
            p_business_id: businessId,
            p_type: 'message',
            p_title: 'New message',
            p_description: content.substring(0, 100),
            p_related_id: message.id,
            p_related_type: 'message',
          });
        }
      }
    } else {
      // Notify all business users
      for (const user of businessUsers || []) {
        await supabase.rpc('create_notification', {
          p_user_id: user.user_id,
          p_business_id: businessId,
          p_type: 'message',
          p_title: 'New message',
          p_description: content.substring(0, 100),
          p_related_id: message.id,
          p_related_type: 'message',
        });
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/messages - Get messages for bid/job/assignment
router.get('/', [
  query('businessId').isUUID().withMessage('Valid business ID required'),
  query('bidId').optional().isUUID(),
  query('jobId').optional().isUUID(),
  query('subAssignmentId').optional().isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessId, bidId, jobId, subAssignmentId } = req.query;
    const userId = req.user.userId;

    // Check if user is a sub and has access to this assignment
    if (subAssignmentId) {
      const { data: assignment } = await supabase
        .from('sub_assignments')
        .select('sub_user_id')
        .eq('id', subAssignmentId)
        .single();

      if (assignment && assignment.sub_user_id === userId) {
        // Sub can only see messages for their own assignments
      } else {
        // Check if user is a business member
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('business_id', businessId)
          .single();

        if (!userRole || !['owner', 'admin', 'contractor'].includes(userRole.role)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
    }

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (id, first_name, last_name, email)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (bidId) query = query.eq('bid_id', bidId);
    if (jobId) query = query.eq('job_id', jobId);
    if (subAssignmentId) query = query.eq('sub_assignment_id', subAssignmentId);

    const { data: messages, error } = await query;

    if (error) throw error;

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/:id/thread - Get full thread
router.get('/:id/thread', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the message to find its parent
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('bid_id, job_id, sub_assignment_id, business_id')
      .eq('id', id)
      .single();

    if (messageError) throw messageError;

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (id, first_name, last_name, email)
      `)
      .eq('business_id', message.business_id)
      .order('created_at', { ascending: true });

    if (message.bid_id) query = query.eq('bid_id', message.bid_id);
    if (message.job_id) query = query.eq('job_id', message.job_id);
    if (message.sub_assignment_id) query = query.eq('sub_assignment_id', message.sub_assignment_id);

    const { data: thread, error } = await query;

    if (error) throw error;

    res.json(thread);
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

module.exports = router;
