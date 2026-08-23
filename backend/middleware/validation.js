const xss = require('xss');

// ── XSS sanitizer middleware ───────────────────────────────────────────────────
// Sanitizes request body, query params, and route params against XSS attacks.
// Also strips MongoDB-style injection keys ($ prefix) for extra safety.
const sanitizeInputs = (req, res, next) => {
    const sanitizeObj = (obj) => {
        if (!obj) return obj;
        if (typeof obj === 'string') {
            return xss(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeObj(item));
        }
        if (typeof obj === 'object') {
            for (let key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    if (key.startsWith('$')) {
                        delete obj[key];
                    } else {
                        obj[key] = sanitizeObj(obj[key]);
                    }
                }
            }
        }
        return obj;
    };

    req.body = sanitizeObj(req.body);
    req.query = sanitizeObj(req.query);
    req.params = sanitizeObj(req.params);

    next();
};

// ── ID Validator ───────────────────────────────────────────────────────────────
// Validates route :id params — accepts UUIDs and Cloudinary-style IDs.
// No mongoose dependency — project uses PostgreSQL/Sequelize with UUID PKs.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUDINARY_ID_REGEX = /^[a-zA-Z0-9_\-\/]{1,256}$/;

const isValidId = (id) => {
    if (!id || typeof id !== 'string') return false;
    if (id === 'undefined' || id === 'null' || id.trim() === '') return false;
    return UUID_REGEX.test(id) || CLOUDINARY_ID_REGEX.test(id);
};

const validateObjectId = (req, res, next) => {
    if (req.params.id && !isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    next();
};

module.exports = { sanitizeInputs, validateObjectId };
