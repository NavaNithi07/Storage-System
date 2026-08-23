const rateLimit = require('express-rate-limit');

// Login: 20 attempts per 15 minutes
// skipSuccessfulRequests = only failed logins count toward the limit
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    skipSuccessfulRequests: true,
    skip: () => false, // never skip — relies on server restart to clear old window
});

// Register: 10 requests per hour
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many accounts created from this IP, please try again after an hour.' },
});

// Upload: 100 requests per hour
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Upload limit reached. Please try again later.' },
});

// Download: 500 requests per hour
const downloadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Download limit reached. Please try again later.' },
});

// Share: 200 requests per hour
const shareLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Share link creation limit reached. Please try again later.' },
});

module.exports = {
    loginLimiter,
    registerLimiter,
    uploadLimiter,
    downloadLimiter,
    shareLimiter
};
