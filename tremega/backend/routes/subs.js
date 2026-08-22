const express = require('express');
const { body, validationResult, query } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const { roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Validation
const inviteValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
  body('businessId').isUUID().withMessage('Valid business ID required'),
];

// POST /api/subs - Invite a sub (admin/contractor only)
router.post('/', roleMiddleware(['admin', 'contractor']), inviteValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, firstName, lastName, businessId } = req.body;
    const invitedBy = req.user.userId;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let userId;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user (invited status)
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          status: 'invited',
        })
        .select()
        .single();

      if (userError) throw userError;
      userId = newUser.id;
    }

    // Check if user already has a role in this business
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .single();

    if (existingRole) {
      return res.status(400).json({ error: 'User already has a role in this business' });
    }

    // Create user role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        business_id: businessId,
        role: 'sub',
        status: 'invited',
      })
      .select(`
        *,
        users:user_id (id, email, first_name, last_name)
      `)
      .single();

    if (roleError) throw roleError;

    // Create notification for the invited user
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_business_id: businessId,
      p_type: 'sub_assignment',
      p_title: 'You\'ve been invited to join a business',
      p_description: `You've been invited to join as a subcontractor.`,
      p_related_id: userRole.id,
      p_related_type: 'user_role',
    });

    // TODO: Send invitation email

    res.status(201).json({
      message: 'Invitation sent successfully',
      user: userRole.users,
      role: userRole,
    });
  } catch (error) {
    console.error('Error inviting sub:', error);
    res.status(500).json({ error: 'Failed to invite sub' });
  }
});

// GET /api/subs - List subs with role-based filtering
router.get('/', async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role === 'admin' || role === 'contractor') {
      // Admin and contractor see all subs
      const { data: subs, error } = await supabase
        .from('subs')
        .select('*');

      if (error) throw error;
      return res.json(subs);
    } else if (role === 'sub') {
      // Sub sees only their own profile
      const { data: subs, error } = await supabase
        .from('subs')
        .select('*')
        .eq('id', userId);

      if (error) throw error;
      return res.json(subs);
    } else {
      // Client sees subs assigned to their jobs
      const { data: assignments } = await supabase
        .from('sub_assignments')
        .select('sub_user_id')
        .eq('business_id', req.query.businessId || '');

      const subIds = [...new Set((assignments || []).map(a => a.sub_user_id))];
      if (subIds.length === 0) {
        return res.json([]);
      }

      const { data: subs, error } = await supabase
        .from('subs')
        .select('*')
        .in('id', subIds);

      if (error) throw error;
      return res.json(subs);
    }
  } catch (error) {
    console.error('Error fetching subs:', error);
    res.status(500).json({ error: 'Failed to fetch subs' });
  }
});

// GET /api/subs/:id/performance - Get sub performance metrics
router.get('/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;

    const { data: performance, error } = await supabase
      .from('sub_performance')
      .select('*')
      .eq('sub_user_id', id)
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Get recent completed assignments
    const { data: recentAssignments, error: assignmentsError } = await supabase
      .from('sub_assignments')
      .select(`
        id,
        status,
        assigned_at,
        started_at,
        completed_at,
        bid_line_items (
          description,
          type,
          total
        )
      `)
      .eq('sub_user_id', id)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (assignmentsError) throw assignmentsError;

    res.json({
      performance: performance || {
        total_assignments: 0,
        completed_on_time: 0,
        completion_rate: 0,
        avg_turnaround_hours: 0,
      },
      recentAssignments,
    });
  } catch (error) {
    console.error('Error fetching sub performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// PUT /api/subs/:id - Update sub info (admin/contractor only)
router.put('/:id', roleMiddleware(['admin', 'contractor']), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('status').optional().isIn(['active', 'inactive']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { firstName, lastName, status } = req.body;
    const { businessId } = req.query;

    // Update user info if provided
    if (firstName || lastName) {
      const updateData = {};
      if (firstName) updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;

      const { error: userError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id);

      if (userError) throw userError;
    }

    // Update role status if provided
    if (status) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ status })
        .eq('user_id', id)
        .eq('business_id', businessId);

      if (roleError) throw roleError;
    }

    // Fetch updated sub
    const { data: sub, error } = await supabase
      .from('user_roles')
      .select(`
        *,
        users:user_id (id, email, first_name, last_name)
      `)
      .eq('user_id', id)
      .eq('business_id', businessId)
      .single();

    if (error) throw error;

    res.json(sub);
  } catch (error) {
    console.error('Error updating sub:', error);
    res.status(500).json({ error: 'Failed to update sub' });
  }
});

// DELETE /api/subs/:id - Remove sub (admin/contractor only)
router.delete('/:id', roleMiddleware(['admin', 'contractor']), async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;

    // Soft delete - set status to inactive
    const { error } = await supabase
      .from('user_roles')
      .update({ status: 'inactive' })
      .eq('user_id', id)
      .eq('business_id', businessId);

    if (error) throw error;

    res.json({ message: 'Sub removed successfully' });
  } catch (error) {
    console.error('Error removing sub:', error);
    res.status(500).json({ error: 'Failed to remove sub' });
  }
});

module.exports = router;
