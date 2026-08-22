const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/contractors - List all contractors
router.get('/', async (req, res) => {
  try {
    const { availability, skill } = req.query;

    let query = supabase
      .from('contractors')
      .select('*')
      .order('name');

    if (availability) query = query.eq('availability_status', availability);
    if (skill) query = query.contains('skills', [skill]);

    const { data: contractors, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch contractors' });
    }

    res.json({ contractors });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contractors - Add a new contractor
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, skills, hourly_rate, availability_status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const { data: contractor, error } = await supabase
      .from('contractors')
      .insert({
        name,
        phone,
        email,
        skills: skills || [],
        hourly_rate: hourly_rate || 75.00,
        availability_status: availability_status || 'available',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create contractor' });
    }

    res.status(201).json({ contractor });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contractors/:id - Get contractor details + their jobs
router.get('/:id', async (req, res) => {
  try {
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Get their active jobs
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title, status, urgency, created_at, properties(address)')
      .eq('contractor_id', req.params.id)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false });

    res.json({ contractor, active_jobs: jobs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/contractors/:id - Update contractor
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'email', 'skills', 'hourly_rate', 'availability_status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data: contractor, error } = await supabase
      .from('contractors')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json({ contractor });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contractors/:id/jobs - Get all jobs for a contractor (contractor view)
router.get('/:id/jobs', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('jobs')
      .select(`
        *,
        properties(address, property_type, owner_name, phone)
      `)
      .eq('contractor_id', req.params.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: jobs, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
