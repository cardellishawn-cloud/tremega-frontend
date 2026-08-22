const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');

/**
 * Generate an invoice PDF and return the buffer.
 */
async function generateInvoicePDF(invoiceId) {
  // Fetch invoice with related data
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      jobs(title, description, properties(address)),
      users(name, company, email),
      contractors(name, email, hourly_rate)
    `)
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    throw new Error('Invoice not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Smoky Mountain Handyman', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Professional Handyman Services', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text('Gatlinburg, TN | (865) 555-0100 | info@smokymtnhandyman.com', { align: 'center' });
    doc.moveDown(1);

    // Line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Invoice details
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #: ${invoice.invoice_number}`, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Net 30'}`, { align: 'right' });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' });
    doc.moveDown(1);

    // Bill To
    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.users?.name || 'N/A');
    if (invoice.users?.company) doc.text(invoice.users.company);
    doc.text(invoice.users?.email || '');
    doc.moveDown(0.5);

    // Property
    if (invoice.jobs?.properties?.address) {
      doc.font('Helvetica-Bold').text('Property:');
      doc.font('Helvetica').text(invoice.jobs.properties.address);
      doc.moveDown(0.5);
    }

    // Contractor
    if (invoice.contractors?.name) {
      doc.font('Helvetica-Bold').text('Contractor:');
      doc.font('Helvetica').text(invoice.contractors.name);
      doc.moveDown(1);
    }

    // Job description
    doc.font('Helvetica-Bold').text('Job Description:');
    doc.font('Helvetica').text(invoice.jobs?.description || invoice.jobs?.title || 'N/A');
    doc.moveDown(1);

    // Line items table
    doc.font('Helvetica-Bold').text('Charges:');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50, col2 = 300, col3 = 400, col4 = 480;

    // Table header
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Description', col1, tableTop);
    doc.text('Hours', col2, tableTop);
    doc.text('Rate', col3, tableTop);
    doc.text('Amount', col4, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Labor row
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    doc.text('Labor', col1, y);
    doc.text(String(invoice.labor_hours || 0), col2, y);
    doc.text(`$${(invoice.labor_rate || 0).toFixed(2)}/hr`, col3, y);
    doc.text(`$${((invoice.labor_hours || 0) * (invoice.labor_rate || 0)).toFixed(2)}`, col4, y);

    // Materials row
    if (invoice.materials_cost > 0) {
      y += 20;
      doc.text('Materials', col1, y);
      doc.text('—', col2, y);
      doc.text('—', col3, y);
      doc.text(`$${invoice.materials_cost.toFixed(2)}`, col4, y);
    }

    // Total
    y += 30;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(14);
    doc.text('Total:', col3, y);
    doc.text(`$${(invoice.total_amount || 0).toFixed(2)}`, col4, y);

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica').text(
      'Payment due within 30 days. Please make checks payable to Smoky Mountain Handyman.',
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
