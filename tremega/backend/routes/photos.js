const express = require('express');
const { query, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(authMiddleware);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// POST /api/photos/upload - Upload photo
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { bidId, jobId, phase, description, businessId } = req.body;
    const userId = req.user.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    if (!businessId) {
      return res.status(400).json({ error: 'businessId required' });
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${businessId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('job-photos')
      .getPublicUrl(filePath);

    // Create photo record
    const { data: photo, error: photoError } = await supabase
      .from('job_photos')
      .insert({
        job_id: jobId,
        bid_id: bidId || null,
        business_id: businessId,
        uploaded_by: userId,
        photo_url: publicUrl,
        description: description || '',
        phase: phase || 'progress',
      })
      .select(`
        *,
        uploader:uploaded_by (id, first_name, last_name)
      `)
      .single();

    if (photoError) throw photoError;

    // Create notification for business members
    const { data: businessUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('business_id', businessId)
      .neq('user_id', userId)
      .eq('status', 'active');

    for (const user of businessUsers || []) {
      await supabase.rpc('create_notification', {
        p_user_id: user.user_id,
        p_business_id: businessId,
        p_type: 'photo_upload',
        p_title: 'New photo uploaded',
        p_description: description || 'A new photo was uploaded',
        p_related_id: photo.id,
        p_related_type: 'job_photo',
      });
    }

    res.status(201).json(photo);
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// GET /api/photos - List photos for bid or job
router.get('/', [
  query('businessId').isUUID().withMessage('Valid business ID required'),
  query('bidId').optional().isUUID(),
  query('jobId').optional().isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessId, bidId, jobId } = req.query;
    const userId = req.user.userId;

    if (!bidId && !jobId) {
      return res.status(400).json({ error: 'Either bidId or jobId required' });
    }

    // Check if user is a sub - they can only see photos for their assignments
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .single();

    if (userRole?.role === 'sub') {
      // Subs can only see photos for bids/jobs they're assigned to
      const { data: assignments } = await supabase
        .from('sub_assignments')
        .select('bid_id')
        .eq('sub_user_id', userId)
        .eq('business_id', businessId);

      const assignedBidIds = assignments?.map(a => a.bid_id) || [];

      if (bidId && !assignedBidIds.includes(bidId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    let query = supabase
      .from('job_photos')
      .select(`
        *,
        uploader:uploaded_by (id, first_name, last_name)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (bidId) query = query.eq('bid_id', bidId);
    if (jobId) query = query.eq('job_id', jobId);

    const { data: photos, error } = await query;

    if (error) throw error;

    res.json(photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// DELETE /api/photos/:id - Delete photo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get photo to check ownership and get file path
    const { data: photo, error: fetchError } = await supabase
      .from('job_photos')
      .select('uploaded_by, photo_url, business_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Photo not found' });
      }
      throw fetchError;
    }

    // Check if user is uploader or admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', photo.business_id)
      .single();

    const isUploader = photo.uploaded_by === userId;
    const isAdmin = ['owner', 'admin'].includes(userRole?.role);

    if (!isUploader && !isAdmin) {
      return res.status(403).json({ error: 'Only uploader or admin can delete photos' });
    }

    // Extract file path from URL
    const urlParts = photo.photo_url.split('/');
    const filePath = `${photo.business_id}/${urlParts[urlParts.length - 1]}`;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('job-photos')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue anyway - record deletion is more important
    }

    // Delete record
    const { error: deleteError } = await supabase
      .from('job_photos')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
