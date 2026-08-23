const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// Strict admin guard — reads latest user role from PostgreSQL to verify admin status.
const protectAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, no user session' });
    }

    try {
        const latestUser = await User.findByPk(req.user.id || req.user._id);
        if (latestUser && latestUser.role === 'admin') {
            return next();
        }
    } catch (err) {
        console.error('[AdminMiddleware] DB check failed:', err.message);
    }

    try {
        await AuditLog.create({
            userId: req.user ? (req.user.id || req.user._id) : null,
            email: req.user ? req.user.email : 'anonymous',
            action: 'UNAUTHORIZED_ACCESS',
            result: 'FAILURE',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: {
                route: req.originalUrl,
                method: req.method,
                reason: req.user ? 'Insufficient role (not admin)' : 'No authenticated user',
            }
        });
    } catch (e) {
        console.warn('[AdminMiddleware] Failed to write AuditLog:', e.message);
    }

    return res.status(403).json({ message: 'Not authorized as an admin' });
};

module.exports = { protectAdmin };
