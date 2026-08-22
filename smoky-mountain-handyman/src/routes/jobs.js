const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { assignContractor } = require('../services/aiAssignment');

const router = express.Router();

// All job routes require auth
router.use(authMiddleware);

// POST /api/jobs - Create a new job (with AI auto-assignment)
router.post('/', async (req, res) => {
  try {
    const { property_id, title, description, urgency } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const jobUrgency = urgency || 'medium';

    // Use Claude AI to find the best contractor
    const assignment = await assignContractor(description, jobUrgency);

    // Calculate estimated cost
    let estimatedCost = null;
    if (assignment.contractor_id) {
      const { data: contractor } = await supabase
        .from('contractors')
        .select('hourly_rate')
        .eq('id', assignment.contractor_id)
        .single();

      if (contractor) {
        estimatedCost = (contractor.hourly_rate * (assignment.estimated_hours || 2)).toFixed(2);
      }
    }

    // Create the job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        property_id: property_id || null,
        user_id: req.user.id,
        contractor_id: assignment.contractor_id,
        title: title || description.substring(0, 100),
        description,
        status: assignment.contractor_id ? 'assigned' : 'pending',
        urgency: jobUrgency,
        estimated_cost: estimatedCost,
        ai_assignment_reason: assignment.reason,
      })
      .select(`
        *,
        properties(address, property_type),
        contractors(name, phone, email, hourly_rate)
      `)
      .single();

    if (error) {
      console.error('Job creation error:', error);
      return res.status(500).json({ error: 'Failed to create job' });
    }

    // Log status history
    await supabase.from('job_status_history').insert({
      job_id: job.id,
      status: job.status,
      notes: assignment.contractor_id
        ? `Auto-assigned to contractor. Reason: ${assignment.reason}`
        : 'Job created, awaiting assignment',
    });

    res.status(201).json({ job, assignment });
  } catch (err) {
    console.error('Job creation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/jobs - Get all jobs for logged-in user
router.get('/', async (req, res) => {
  try {
    const { status, urgency } = req.query;

    let query = supabase
      .from('jobs')
      .select(`
        *,
        properties(address, property_type, owner_name),
        contractors(name, phone, email, hourly_rate)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (urgency) query = query.eq('urgency', urgency);

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Fetch jobs error:', error);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    res.json({ jobs });
  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/jobs/:id - Get single job with status history
router.get('/:id', async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        properties(address, property_type, owner_name, phone),
        contractors(name, phone, email, hourly_rate, skills)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get status history
    const { data: history } = await supabase
      .from('job_status_history')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });

    res.json({ job, history: history || [] });
  } catch (err) {
    console.error('Fetch job error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/jobs/:id/status - Update job status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'assigned', 'in_progress', 'complete', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const updates = { status };
    if (status === 'complete') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Log status change
    await supabase.from('job_status_history').insert({
      job_id: job.id,
      status,
      notes: notes || `Status changed to ${status}`,
    });

    res.json({ job });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/jobs/:id/photos - Add photos to a job
router.patch('/:id/photos', async (req, res) => {
  try {
    const { photos_url } = req.body; // array of URLs

    if (!Array.isArray(photos_url)) {
      return res.status(400).json({ error: 'photos_url must be an array of URLs' });
    }

    // Get current photos
    const { data: current } = await supabase
      .from('jobs')
      .select('photos_url')
      .eq('id', req.params.id)
      .single();

    const existingPhotos = current?.photos_url || [];
    const allPhotos = [...existingPhotos, ...photos_url];

    const { data: job, error } = await supabase
      .from('jobs')
      .update({ photos_url: allPhotos })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (err) {
    console.error('Photo update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/jobs/:id/reassign - Manually reassign contractor
router.patch('/:id/reassign', async (req, res) => {
  try {
    const { contractor_id, reason } = req.body;

    if (!contractor_id) {
      return res.status(400).json({ error: 'contractor_id is required' });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        contractor_id,
        status: 'assigned',
        ai_assignment_reason: reason || 'Manually reassigned',
      })
      .eq('id', req.params.id)
      .select(`
        *,
        contractors(name, phone, email)
      `)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await supabase.from('job_status_history').insert({
      job_id: job.id,
      status: 'assigned',
      notes: reason || 'Manually reassigned to new contractor',
    });

    res.json({ job });
  } catch (err) {
    console.error('Reassign error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
