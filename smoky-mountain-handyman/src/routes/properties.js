const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/properties - List all properties for logged-in user
router.get('/', async (req, res) => {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch properties' });
    }

    res.json({ properties });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/properties - Add a new property
router.post('/', async (req, res) => {
  try {
    const { address, owner_name, phone, owner_email, property_type, notes } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        user_id: req.user.id,
        address,
        owner_name,
        phone,
        owner_email,
        property_type: property_type || 'residential',
        notes,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create property' });
    }

    res.status(201).json({ property });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/properties/:id - Get single property with job history
router.get('/:id', async (req, res) => {
  try {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Get jobs at this property
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title, status, urgency, created_at, contractors(name)')
      .eq('property_id', req.params.id)
      .order('created_at', { ascending: false });

    res.json({ property, jobs: jobs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/properties/:id - Update property
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['address', 'owner_name', 'phone', 'owner_email', 'property_type', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data: property, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/properties/:id - Delete property
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete property' });
    }

    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
