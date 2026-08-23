const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadFileByCategory, getHistory, renameFile, deleteFile, getShareLink, downloadFile, previewFile, getDashboardStats, getFileById, generateShareToken, revokeShareToken, updateShareSettings, getFileByShareToken, downloadFileByShareToken, getTrash, restoreFile, permanentDeleteFile, chunkUploadHandler } = require('../controllers/fileController');
const { CATEGORY_CONFIG } = require('../utils/fileCategoryConfig');
const { validateObjectId } = require('../middleware/validation');

const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1GB limit
const MAX_UPLOAD_SIZE_LABEL = '1GB';

const fs = require('fs');
const path = require('path');

const secureFileFilter = (req, file, cb) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  const blockedExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'msi'];
  if (blockedExtensions.includes(ext)) {
    return cb(new Error('Executable files are strictly prohibited.'));
  }
  cb(null, true);
};

const uploadFactory = (folderKey) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads/temp-uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop().toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      cb(null, `${uniqueSuffix}.${ext}`);
    }
  });
  return multer({ storage, fileFilter: secureFileFilter, limits: { fileSize: MAX_UPLOAD_SIZE } });
};

const multerErrorHandler = (err, req, res, next) => {
  if (err && err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: `File exceeds ${MAX_UPLOAD_SIZE_LABEL} limit.` });
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'File upload failed.' });
  }
  next();
};

const chunkUploadStart = (req, res, next) => {
  req.startTime = Date.now();
  const ctLen = req.headers['content-length'] || 0;
  console.log(`[Upload Trace] Chunk upload request received: content-length=${ctLen} bytes`);
  next();
};


const chunkUpload = multer({ dest: 'uploads/temp-chunks/' });
router.post('/chunk-upload', protect, chunkUploadStart, chunkUpload.single('file'), chunkUploadHandler);

const { uploadLimiter, downloadLimiter, shareLimiter } = require('../middleware/rateLimiter');

router.post(
  '/upload/images',
  protect,
  uploadLimiter,
  uploadFactory('images').single('file'),
  multerErrorHandler,
  uploadFileByCategory
);

router.post(
  '/upload/videos',
  protect,
  uploadLimiter,
  uploadFactory('videos').single('file'),
  multerErrorHandler,
  uploadFileByCategory
);

router.post(
  '/upload/documents',
  protect,
  uploadLimiter,
  uploadFactory('documents').single('file'),
  multerErrorHandler,
  uploadFileByCategory
);

// Public share token lookup (no Mongo ID required)
router.get('/share/:shareToken', optionalAuth, getFileByShareToken);
router.get('/download-shared/:shareToken', downloadLimiter, optionalAuth, downloadFileByShareToken);

// Download with optional auth - allows share tokens or authenticated users
router.get('/download/:id', validateObjectId, downloadLimiter, (req, res, next) => {
  console.log(`[Routes] Matched GET /api/files/download/:id. id=${req.params.id}`);
  return next();
}, optionalAuth, downloadFile);

// Preview endpoint for PDF.js and document previewers - uses query token auth
router.get('/preview/:id', validateObjectId, (req, res, next) => {
  console.log(`[Routes] Matched GET /api/files/preview/:id. id=${req.params.id}`);
  return next();
}, optionalAuth, previewFile);

// Share metadata endpoint for legacy links using file id
router.get('/:id/share', validateObjectId, optionalAuth, getFileByShareToken);

// Viewer-friendly endpoint was removed to enforce secure access via /download/:id.



// History for the authenticated user.
router.get('/history', protect, getHistory);
router.get('/dashboard-stats', protect, getDashboardStats);

// Trash endpoints
router.get('/trash', protect, getTrash);
router.post('/restore/:id', protect, validateObjectId, restoreFile);
router.delete('/permanent/:id', protect, validateObjectId, permanentDeleteFile);


// Test endpoint to verify routing
router.get('/test', protect, (req, res) => {
  res.json({ message: 'File routes working correctly', user: req.user?._id });
});

// Toggle favourite (double click in UI) - Must be BEFORE generic /:id routes
router.post('/favorites/toggle/:id', protect, validateObjectId, async (req, res) => {
  try {
    console.log('[Favorites] Toggling favorite for file ID:', req.params.id);
    console.log('[Favorites] User ID:', req.user?._id);
    
    const file = await require('../models/File').findByPk(req.params.id);
    if (!file) {
      console.log('[Favorites] File not found:', req.params.id);
      return res.status(404).json({ message: 'File not found' });
    }
    
    console.log('[Favorites] File owner ID:', file.userId);
    console.log('[Favorites] Current user ID:', req.user._id);
    
    if (file.userId.toString() !== req.user._id.toString()) {
      console.log('[Favorites] Unauthorized - user does not own this file');
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    file.isFavorite = !file.isFavorite;
    await file.save();
    console.log('[Favorites] Successfully toggled to:', file.isFavorite);

    try {
      const { addEvent } = require('../utils/activityLog');
      const { getIO } = require('../utils/socket');
      const eventType = file.isFavorite ? 'favorite-added' : 'favorite-removed';
      const event = await addEvent({
        type: eventType,
        userName: req.user.name,
        email: req.user.email,
        timestamp: new Date().toISOString(),
        fileName: file.filename,
      });
      try { getIO().emit('admin-update', { type: eventType, event }); } catch(e) {}
      try { getIO().emit('activity', event); } catch(e) {}
      try { getIO().emit('stats-update', {}); } catch(e) {}
    } catch (e) {
      console.warn('[Favorites] Socket emission skipped', e.message);
    }

    res.json(file);
  } catch (err) {
    console.error('[Favorites] Error toggling favorite:', err.message);
    res.status(500).json({ message: 'Server error toggling favorite', error: err.message });
  }
});

// Generate share token for a file (authenticated)
router.post('/:id/generate-share', protect, validateObjectId, shareLimiter, generateShareToken);
router.post('/:id/revoke-share', protect, validateObjectId, revokeShareToken);
router.patch('/:id/update-share', protect, validateObjectId, updateShareSettings);

// Generic routes (less specific) - Must be AFTER specific routes
router.get('/:id', validateObjectId, optionalAuth, getFileById);
router.patch('/:id/rename', protect, validateObjectId, renameFile);
router.route('/:id').delete(protect, validateObjectId, deleteFile);


module.exports = router;
