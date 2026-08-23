const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { protectAdmin } = require('../middleware/adminMiddleware');
const {
    getOverview,
    getUsers,
    suspendUser,
    activateUser,
    deleteUser,
    getUserDetails,
    getActivities,
    getSecurityStats
} = require('../controllers/adminController');

// All admin routes are protected by adminProtect middleware
router.use(protect, protectAdmin);

router.get('/overview', getOverview);
router.get('/users', getUsers);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/activate', activateUser);
router.delete('/users/:id', deleteUser);
router.get('/users/:id/details', getUserDetails);
router.get('/activities', getActivities);
router.get('/security', getSecurityStats);

module.exports = router;