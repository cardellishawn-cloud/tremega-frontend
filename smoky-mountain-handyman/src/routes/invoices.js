const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/invoiceService');

const router = express.Router();
router.use(authMiddleware);

// POST /api/invoices - Create invoice for a completed job
router.post('/', async (req, res) => {
  try {
    const { job_id, labor_hours, materials_cost, due_date } = req.body;

    if (!job_id || !labor_hours) {
      return res.status(400).json({ error: 'job_id and labor_hours are required' });
    }

    // Get the job with contractor info
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, contractors(hourly_rate)')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const laborRate = job.contractors?.hourly_rate || 75;
    const materialsCost = materials_cost || 0;
    const totalAmount = (labor_hours * laborRate) + materialsCost;

    // Generate invoice number
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });
    const invoiceNumber = `SMH-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        job_id,
        user_id: req.user.id,
        contractor_id: job.contractor_id,
        invoice_number: invoiceNumber,
        labor_hours,
        labor_rate: laborRate,
        materials_cost: materialsCost,
        total_amount: totalAmount,
        status: 'draft',
        due_date: due_date || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Invoice creation error:', error);
      return res.status(500).json({ error: 'Failed to create invoice' });
    }

    res.status(201).json({ invoice });
  } catch (err) {
    console.error('Invoice error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices - List invoices for user
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('invoices')
      .select(`
        *,
        jobs(title, description, properties(address)),
        contractors(name)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: invoices, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch invoices' });
    }

    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        jobs(title, description, properties(address)),
        contractors(name, email),
        users(name, company, email)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id/pdf - Download invoice as PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const pdfBuffer = await generateInvoicePDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// PATCH /api/invoices/:id - Update invoice status
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['status', 'due_date', 'labor_hours', 'materials_cost'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Recalculate total if hours or materials changed
    if (updates.labor_hours || updates.materials_cost) {
      const { data: current } = await supabase
        .from('invoices')
        .select('labor_hours, labor_rate, materials_cost')
        .eq('id', req.params.id)
        .single();

      if (current) {
        const hours = updates.labor_hours || current.labor_hours;
        const materials = updates.materials_cost ?? current.materials_cost;
        updates.total_amount = (hours * current.labor_rate) + materials;
      }
    }

    if (updates.status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
