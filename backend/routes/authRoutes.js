const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { registerUser, verifyEmail, resendVerification, loginUser, getProfile, updateProfile, updatePassword, refreshTokenEndpoint, logoutEndpoint, getSessions, revokeSession, revokeAllSessions, googleLogin, saveMobile, checkVibnaEmailAvailability, registerVibnaAccount } = require('../controllers/authController');

// Multer & Cloudinary Storage configuration for avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const publicId = `avatar-${req.user._id}-${Date.now()}`;
    return {
      folder: 'uploads/avatars',
      resource_type: 'image',
      transformation: [
        { width: 250, height: 250, crop: 'fill', gravity: 'face', quality: 'auto' }
      ],
      public_id: publicId,
      format: ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' ? ext : 'jpg',
    };
  },
});
const uploadAvatar = multer({ storage: avatarStorage });

const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerLimiter, (req, res, next) => {
  console.log('[Auth Routes] /register body keys:', req.body && typeof req.body === 'object' ? Object.keys(req.body) : typeof req.body);
  return registerUser(req, res);
});
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

router.post('/login', loginLimiter, (req, res, next) => {
  console.log('[Auth Routes] /login body keys:', req.body && typeof req.body === 'object' ? Object.keys(req.body) : typeof req.body);
  return loginUser(req, res);
});

// Google Sign-In: verify Firebase ID token, find-or-create user, return VIBNA JWT
router.post('/google', googleLogin);

// Vibna-style Google Account Creation (custom @vibna.storage emails)
router.post('/check-vibna-email', checkVibnaEmailAvailability);
router.post('/register-vibna', registerLimiter, registerVibnaAccount);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.post('/save-mobile', protect, saveMobile);

// Security & Sessions
router.post('/refresh', refreshTokenEndpoint);
router.post('/logout', logoutEndpoint); // optional protect
router.get('/sessions', protect, getSessions);
router.delete('/sessions', protect, revokeAllSessions);
router.delete('/sessions/:deviceId', protect, revokeSession);

router.post('/upload-avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const avatarUrl = req.file.secure_url || req.file.url || req.file.path;
    
    // Save avatar URL to the database user document instantly
    const user = await User.findByPk(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.avatar = avatarUrl;
    await user.save();

    try {
      const { getIO } = require('../utils/socket');
      const { addEvent } = require('../utils/activityLog');
      const event = await addEvent({
        type: 'avatar-updated',
        userName: user.name,
        email: user.email,
        timestamp: new Date().toISOString(),
        fileName: null,
      });
      getIO().emit('admin-update', { type: 'avatar-updated', event });
    } catch (e) {
      console.warn('[Auth Avatar] Socket emission skipped - socket not ready', e.message);
    }

    res.json({ avatarUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
