const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');

const protect = async (req, res, next) => {
    let token = req.query.token;
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            // Check if token is blacklisted
            const isBlacklisted = await BlacklistedToken.findOne({ where: { token } });
            if (isBlacklisted) {
                console.warn(`[Auth Middleware] Blocked attempt to use blacklisted token.`);
                return res.status(401).json({ message: 'Not authorized, token revoked' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            
            req.user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });
            
            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            if (req.user.isSuspended) {
                return res.status(403).json({ message: 'Not authorized, account is suspended' });
            }
            
            if (req.user.provider === 'local' && !req.user.isEmailVerified) {
                return res.status(403).json({ message: 'Email not verified. Please verify your email to access protected resources.', requiresVerification: true });
            }
            
            return next();
        } catch (error) {
            console.error(`[Auth Middleware] Token verification failed: ${error.message}`);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.log(`[Auth Middleware] No token found in request`);
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const optionalAuth = async (req, res, next) => {
    console.log(`\n[Optional Auth Middleware] Request received for: ${req.method} ${req.originalUrl}`);
    
    let token = req.query.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });
            console.log(`[Optional Auth Middleware] User authenticated: ${req.user ? req.user.id : 'Not Found'}`);
        } catch (error) {
            console.log(`[Optional Auth Middleware] Token verification failed (non-blocking): ${error.message}`);
        }
    }

    return next();
};

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

const adminProtect = async (req, res, next) => {
    await protect(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            return next();
        }
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    });
};

module.exports = { protect, optionalAuth, adminProtect, adminOnly };
