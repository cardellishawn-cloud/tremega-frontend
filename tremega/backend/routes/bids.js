const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const { roleMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation rules
const bidValidation = [
  body('customer_name').trim().notEmpty().withMessage('Customer name required'),
  body('customer_email').isEmail().withMessage('Valid customer email required'),
  body('customer_phone').optional().trim(),
  body('job_address').optional().trim(),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item required'),
  body('lineItems.*.description').trim().notEmpty().withMessage('Line item description required'),
  body('lineItems.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be positive'),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
];

const updateBidValidation = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('taxRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Tax rate must be between 0 and 1'),
  body('lineItems').optional().isArray({ min: 1 }).withMessage('At least one line item required'),
];

// Helper function to calculate days until expiration
const getDaysUntilExpiration = (expirationDate) => {
  if (!expirationDate) return null;
  const now = new Date();
  const exp = new Date(expirationDate);
  const diffTime = exp - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Helper function to format bid response
const formatBidResponse = (bid) => {
  const daysUntilExpiration = bid.status === 'sent' ? getDaysUntilExpiration(bid.expires_at) : null;
  return {
    ...bid,
    daysUntilExpiration,
    lineItems: bid.line_items || [],
  };
};

// POST /api/bids - Create new bid (admin/contractor only)
router.post('/', roleMiddleware(['admin', 'contractor']), bidValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customer_name, customer_email, customer_phone, job_address, title, description, taxRate = 0, lineItems } = req.body;
    const userId = req.user.userId;

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Calculate totals from line items
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Insert bid
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .insert({
        title,
        description: description || null,
        contractor_id: userId,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        job_address: job_address || null,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total,
        estimated_amount: total,
        expires_at: expiresAt.toISOString(),
        status: 'draft',
      })
      .select()
      .single();

    if (bidError) throw bidError;

    // Insert line items
    const lineItemsToInsert = lineItems.map((item, index) => ({
      bid_id: bid.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: item.quantity * item.unitPrice,
      sort_order: index + 1,
    }));

    const { data: insertedLineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .insert(lineItemsToInsert)
      .select();

    if (lineItemsError) throw lineItemsError;

    // Fetch complete bid with line items
    const { data: completeBid, error: fetchError } = await supabase
      .from('bids')
      .select(`
        *,
        line_items (*)
      `)
      .eq('id', bid.id)
      .single();

    if (fetchError) throw fetchError;

    res.status(201).json(formatBidResponse(completeBid));
  } catch (error) {
    console.error('Error creating bid:', error);
    res.status(500).json({ error: 'Failed to create bid' });
  }
});

// GET /api/bids - List bids with role-based filtering
router.get('/', [
  query('status').optional().isIn(['draft', 'sent', 'accepted', 'rejected', 'expired']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.query;
    const { userId, role } = req.user;

    let query = supabase
      .from('bids')
      .select(`
        *,
        line_items (*)
      `)
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (role === 'admin') {
      // Admin sees all bids - no additional filter
    } else if (role === 'contractor') {
      query = query.eq('contractor_id', userId);
    } else if (role === 'client') {
      // Clients see bids where their email matches customer_email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      if (userData) {
        query = query.eq('customer_email', userData.email);
      } else {
        return res.json([]);
      }
    } else if (role === 'sub') {
      // Subs see only bids they have assignments on
      const { data: assignments } = await supabase
        .from('sub_assignments')
        .select('line_item_id')
        .eq('sub_id', userId);

      if (!assignments || assignments.length === 0) {
        return res.json([]);
      }

      // Get bid_ids from line_items
      const lineItemIds = assignments.map(a => a.line_item_id);
      const { data: lineItems } = await supabase
        .from('line_items')
        .select('bid_id')
        .in('id', lineItemIds);

      const bidIds = [...new Set((lineItems || []).map(li => li.bid_id))];
      if (bidIds.length === 0) {
        return res.json([]);
      }
      query = query.in('id', bidIds);
    }

    // Apply optional query filters
    if (status) query = query.eq('status', status);

    const { data: bids, error } = await query;

    if (error) throw error;

    res.json(bids.map(formatBidResponse));
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// GET /api/bids/:id - Get single bid
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Expire old bids first
    await supabase.rpc('expire_old_bids');

    const { data: bid, error } = await supabase
      .from('bids')
      .select(`
        *,
        line_items (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw error;
    }

    res.json(formatBidResponse(bid));
  } catch (error) {
    console.error('Error fetching bid:', error);
    res.status(500).json({ error: 'Failed to fetch bid' });
  }
});

// PUT /api/bids/:id - Update bid (admin/contractor only, must own bid or be admin)
router.put('/:id', roleMiddleware(['admin', 'contractor']), updateBidValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, notes, terms, taxRate, lineItems } = req.body;
    const { userId, role } = req.user;

    // Check if bid exists and is draft
    const { data: existingBid, error: fetchError } = await supabase
      .from('bids')
      .select('status, contractor_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw fetchError;
    }

    // Only allow if user owns the bid or is admin
    if (role !== 'admin' && existingBid.contractor_id !== userId) {
      return res.status(403).json({ error: 'You can only update your own bids' });
    }

    if (existingBid.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft bids can be updated' });
    }

    // Update bid fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (terms !== undefined) updateData.terms = terms;
    if (taxRate !== undefined) updateData.tax_rate = taxRate;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('bids')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;
    }

    // Update line items if provided
    if (lineItems) {
      // Delete existing line items
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('bid_id', id);

      if (deleteError) throw deleteError;

      // Insert new line items
      const lineItemsToInsert = lineItems.map(item => ({
        bid_id: id,
        description: item.description,
        type: item.type || 'other',
        quantity: item.quantity,
        unit: item.unit || 'units',
        unit_price: item.unitPrice,
      }));

      const { error: insertError } = await supabase
        .from('line_items')
        .insert(lineItemsToInsert);

      if (insertError) throw insertError;
    }

    // Fetch updated bid
    const { data: updatedBid, error: fetchUpdatedError } = await supabase
      .from('bids')
      .select(`
        *,
        line_items (*)
      `)
      .eq('id', id)
      .single();

    if (fetchUpdatedError) throw fetchUpdatedError;

    res.json(formatBidResponse(updatedBid));
  } catch (error) {
    console.error('Error updating bid:', error);
    res.status(500).json({ error: 'Failed to update bid' });
  }
});

// POST /api/bids/:id/send - Send bid to customer
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bid exists and is draft
    const { data: existingBid, error: fetchError } = await supabase
      .from('bids')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw fetchError;
    }

    if (existingBid.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft bids can be sent' });
    }

    const { data: updatedBid, error } = await supabase
      .from('bids')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        line_items (*)
      `)
      .single();

    if (error) throw error;

    res.json(formatBidResponse(updatedBid));
  } catch (error) {
    console.error('Error sending bid:', error);
    res.status(500).json({ error: 'Failed to send bid' });
  }
});

// PUT /api/bids/:id/accept - Customer accepts bid
router.put('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bid exists and is sent
    const { data: existingBid, error: fetchError } = await supabase
      .from('bids')
      .select('*, customers:customer_id(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw fetchError;
    }

    if (existingBid.status !== 'sent') {
      return res.status(400).json({ error: 'Only sent bids can be accepted' });
    }

    // Create job from bid
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        customer_id: existingBid.customer_id,
        business_id: existingBid.business_id,
        title: existingBid.title,
        status: 'scheduled',
        notes: `Created from accepted bid: ${existingBid.title}\n\n${existingBid.notes || ''}`,
        created_by: existingBid.created_by,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Update bid with accepted status and job link
    const { data: updatedBid, error: updateError } = await supabase
      .from('bids')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        job_id: job.id,
      })
      .eq('id', id)
      .select(`
        *,
        line_items (*)
      `)
      .single();

    if (updateError) throw updateError;

    res.json({
      bid: formatBidResponse(updatedBid),
      job,
    });
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
});

// PUT /api/bids/:id/reject - Customer rejects bid
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bid exists and is sent
    const { data: existingBid, error: fetchError } = await supabase
      .from('bids')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw fetchError;
    }

    if (existingBid.status !== 'sent') {
      return res.status(400).json({ error: 'Only sent bids can be rejected' });
    }

    const { data: updatedBid, error } = await supabase
      .from('bids')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        line_items (*)
      `)
      .single();

    if (error) throw error;

    res.json(formatBidResponse(updatedBid));
  } catch (error) {
    console.error('Error rejecting bid:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
});

// DELETE /api/bids/:id - Delete bid (admin/contractor only, draft only)
router.delete('/:id', roleMiddleware(['admin', 'contractor']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bid exists and is draft
    const { data: existingBid, error: fetchError } = await supabase
      .from('bids')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw fetchError;
    }

    if (existingBid.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft bids can be deleted' });
    }

    // Hard delete (line items will cascade)
    const { error } = await supabase
      .from('bids')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Bid deleted successfully' });
  } catch (error) {
    console.error('Error deleting bid:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

// POST /api/bids/:bidId/line-items/:lineItemId/assign-sub - Assign sub (admin/contractor only)
router.post('/:bidId/line-items/:lineItemId/assign-sub', roleMiddleware(['admin', 'contractor']), [
  body('subUserId').isUUID().withMessage('Valid sub user ID required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bidId, lineItemId } = req.params;
    const { subUserId } = req.body;
    const assignedBy = req.user.userId;

    // Get bid to verify it exists and get business_id
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('business_id, title')
      .eq('id', bidId)
      .single();

    if (bidError) {
      if (bidError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bid not found' });
      }
      throw bidError;
    }

    // Verify line item belongs to bid
    const { data: lineItem, error: lineItemError } = await supabase
      .from('line_items')
      .select('id, description')
      .eq('id', lineItemId)
      .eq('bid_id', bidId)
      .single();

    if (lineItemError) {
      if (lineItemError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Line item not found' });
      }
      throw lineItemError;
    }

    // Check if sub is already assigned to this line item
    const { data: existingAssignment } = await supabase
      .from('sub_assignments')
      .select('id')
      .eq('bid_line_item_id', lineItemId)
      .eq('sub_user_id', subUserId)
      .single();

    if (existingAssignment) {
      return res.status(400).json({ error: 'Sub already assigned to this line item' });
    }

    // Create assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('sub_assignments')
      .insert({
        bid_line_item_id: lineItemId,
        sub_user_id: subUserId,
        bid_id: bidId,
        business_id: bid.business_id,
        status: 'assigned',
      })
      .select(`
        *,
        sub:sub_user_id (id, first_name, last_name, email),
        line_item:bid_line_item_id (id, description, type, total)
      `)
      .single();

    if (assignmentError) throw assignmentError;

    // Create notification for the sub
    await supabase.rpc('create_notification', {
      p_user_id: subUserId,
      p_business_id: bid.business_id,
      p_type: 'sub_assignment',
      p_title: 'You\'ve been assigned to a job',
      p_description: `You've been assigned to: ${lineItem.description} on bid "${bid.title}"`,
      p_related_id: assignment.id,
      p_related_type: 'sub_assignment',
    });

    res.status(201).json({
      assignment,
      notificationSent: true,
    });
  } catch (error) {
    console.error('Error assigning sub:', error);
    res.status(500).json({ error: 'Failed to assign sub' });
  }
});

// GET /api/sub-assignments - List assignments for logged-in sub
router.get('/sub-assignments', [
  query('subUserId').optional().isUUID(),
  query('status').optional().isIn(['assigned', 'started', 'completed']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subUserId, status } = req.query;
    const requestingUserId = req.user.userId;

    // If subUserId is provided, verify the requester is that sub or has admin access
    const targetSubId = subUserId || requestingUserId;

    let query = supabase
      .from('sub_assignments')
      .select(`
        id,
        status,
        assigned_at,
        started_at,
        completed_at,
        line_items!inner (
          id,
          description,
          type,
          quantity,
          unit,
          unit_price,
          total
        )
      `)
      .eq('sub_user_id', targetSubId)
      .order('assigned_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: assignments, error } = await query;

    if (error) throw error;

    // Format response to hide sensitive info (customer, bid total)
    const formattedAssignments = assignments.map(a => ({
      id: a.id,
      status: a.status,
      assignedDate: a.assigned_at,
      startedAt: a.started_at,
      completedAt: a.completed_at,
      lineItem: {
        id: a.line_items.id,
        description: a.line_items.description,
        type: a.line_items.type,
        quantity: a.line_items.quantity,
        unit: a.line_items.unit,
        unitPrice: a.line_items.unit_price,
        total: a.line_items.total,
      },
    }));

    res.json(formattedAssignments);
  } catch (error) {
    console.error('Error fetching sub assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// PUT /api/sub-assignments/:id/start - Sub marks work as started
router.put('/sub-assignments/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify assignment belongs to this sub
    const { data: assignment, error: fetchError } = await supabase
      .from('sub_assignments')
      .select('sub_user_id, status, business_id, bid_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      throw fetchError;
    }

    if (assignment.sub_user_id !== userId) {
      return res.status(403).json({ error: 'You can only start your own assignments' });
    }

    if (assignment.status !== 'assigned') {
      return res.status(400).json({ error: 'Assignment already started or completed' });
    }

    // Update assignment
    const { data: updated, error } = await supabase
      .from('sub_assignments')
      .update({
        status: 'started',
        started_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify contractor (bid creator)
    const { data: bid } = await supabase
      .from('bids')
      .select('created_by, title')
      .eq('id', assignment.bid_id)
      .single();

    if (bid) {
      await supabase.rpc('create_notification', {
        p_user_id: bid.created_by,
        p_business_id: assignment.business_id,
        p_type: 'job_update',
        p_title: 'Sub started work',
        p_description: `A sub has started work on bid "${bid.title}"`,
        p_related_id: id,
        p_related_type: 'sub_assignment',
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error starting assignment:', error);
    res.status(500).json({ error: 'Failed to start assignment' });
  }
});

// PUT /api/sub-assignments/:id/complete - Sub marks work as completed
router.put('/sub-assignments/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify assignment belongs to this sub
    const { data: assignment, error: fetchError } = await supabase
      .from('sub_assignments')
      .select('sub_user_id, status, business_id, bid_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      throw fetchError;
    }

    if (assignment.sub_user_id !== userId) {
      return res.status(403).json({ error: 'You can only complete your own assignments' });
    }

    if (assignment.status !== 'started') {
      return res.status(400).json({ error: 'Assignment must be started before completing' });
    }

    // Update assignment
    const { data: updated, error } = await supabase
      .from('sub_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify contractor (bid creator)
    const { data: bid } = await supabase
      .from('bids')
      .select('created_by, title')
      .eq('id', assignment.bid_id)
      .single();

    if (bid) {
      await supabase.rpc('create_notification', {
        p_user_id: bid.created_by,
        p_business_id: assignment.business_id,
        p_type: 'job_update',
        p_title: 'Sub completed work',
        p_description: `A sub has completed work on bid "${bid.title}"`,
        p_related_id: id,
        p_related_type: 'sub_assignment',
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error completing assignment:', error);
    res.status(500).json({ error: 'Failed to complete assignment' });
  }
});

module.exports = router;
