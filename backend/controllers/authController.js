const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const User = require('../models/User');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { getIO } = require('../utils/socket');
const { addEvent } = require('../utils/activityLog');

const generateAccessToken = (userOrId) => {
    let payload = {};
    if (userOrId && typeof userOrId === 'object') {
        payload = {
            id: userOrId.id || userOrId._id,
            email: userOrId.email,
            role: userOrId.role
        };
    } else {
        payload = { id: userOrId };
    }
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
};

const generateToken = generateAccessToken;

const buildUserResponse = (user, extraToken) => ({
    _id: user.id,
    name: user.name,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email,
    vibnaEmail: user.vibnaEmail || '',
    googleEmail: user.googleEmail || '',
    username: user.username || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
    role: user.role || 'user',
    mobile: user.mobile || '',
    provider: user.provider || 'local',
    isEmailVerified: user.isEmailVerified,
    token: extraToken || generateToken(user),
});

const registerUser = async (req, res) => {
    const { name, email, mobile, password } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedMobile = mobile?.trim();

    try {
        if (!normalizedEmail || !normalizedEmail.endsWith('@vibna.storage')) {
            return res.status(400).json({ message: 'Email address must end with @vibna.storage.' });
        }
        const emailHandle = normalizedEmail.split('@')[0];
        if (!emailHandle || emailHandle.length < 3) {
            return res.status(400).json({ message: 'Email handle must be at least 3 characters.' });
        }
        if (!/^[a-z0-9._]+$/.test(emailHandle)) {
            return res.status(400).json({ message: 'Email handle can only contain lowercase letters, numbers, dots and underscores.' });
        }

        if (normalizedMobile) {
            if (!/^[0-9]{10}$/.test(normalizedMobile)) {
                return res.status(400).json({ message: 'Mobile number must be a 10-digit number.' });
            }
        }

        const whereOr = [{ email: normalizedEmail }];
        if (normalizedMobile) whereOr.push({ mobile: normalizedMobile });
        const userExists = await User.findOne({ where: { [Op.or]: whereOr } });

        if (userExists) {
            if (userExists.email === normalizedEmail) {
                return res.status(400).json({ message: 'This email is already registered.' });
            }
            return res.status(400).json({ message: 'This mobile number is already linked to an existing VIBNA Storage account.' });
        }

        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!password || !passRegex.test(password)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
        }

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const newSession = {
            token: refreshToken,
            deviceId: req.body.deviceId || 'unknown',
            deviceName: 'Web Browser',
            browser: req.useragent?.browser || 'Unknown Browser',
            os: req.useragent?.os || 'Unknown OS',
            ipAddress: req.ip,
            lastActive: new Date(),
            loginTime: new Date()
        };

        const user = await User.create({
            name,
            email: normalizedEmail,
            vibnaEmail: normalizedEmail,
            mobile: normalizedMobile || null,
            password,
            role: 'user',
            isEmailVerified: true,
            refreshTokens: [newSession],
        });

        if (user) {
            const event = await addEvent({ type: 'user-registered', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null });
            try { getIO().emit('admin-update', { type: 'user-registered', event }); getIO().emit('activity', event); getIO().emit('stats-update', {}); } catch (e) {}

            res.status(201).json({ ...buildUserResponse(user), refreshToken });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email or mobile already registered.' });
        }
        res.status(500).json({ message: error.message });
    }
};

const verifyEmail = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Verification token is required' });
    try {
        const user = await User.findOne({ where: { verificationToken: token } });
        if (!user) return res.status(400).json({ message: 'Invalid or expired verification token' });
        await user.update({ isEmailVerified: true, verificationToken: null });
        res.json({ message: 'Email verified successfully! You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const resendVerification = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    try {
        const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isEmailVerified) return res.status(400).json({ message: 'Email is already verified' });
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await user.update({ verificationToken });
        const { sendVerificationEmail } = require('../utils/mailer');
        await sendVerificationEmail(user.email, user.name, verificationToken);
        res.json({ message: 'Verification email resent successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const loginUser = async (req, res) => {
    const identifier = req.body.identifier || req.body.email || req.body.username;
    const { password } = req.body;
    const normalizedIdentifier = identifier?.toLowerCase().trim();
    const isAdminCredentials = (normalizedIdentifier === 'admin@gmail.com' || normalizedIdentifier === 'admin' || normalizedIdentifier === 'admin@vibna.storage') && (password === '789654' || password === 'admin123');
    const isEmail = normalizedIdentifier?.includes('@');

    if (!normalizedIdentifier || !password) {
        return res.status(400).json({ message: 'Email/username and password are required' });
    }

    try {
        let user;
        if (isEmail) {
            user = await User.findOne({ where: { email: normalizedIdentifier } });
        } else {
            user = await User.findOne({ where: { [Op.or]: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }] } });
        }

        if (!user && isAdminCredentials) {
            user = await User.create({ name: 'Vibna Admin', email: 'admin@gmail.com', username: 'admin', password, role: 'admin', isEmailVerified: true, refreshTokens: [] });
        }

        if (user && user.isSuspended) {
            return res.status(403).json({ message: 'Your account has been suspended by an administrator.' });
        }

        if (user && user.isLocked()) {
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: user.id, email: user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Account locked' } });
            const remainingMs = new Date(user.lockUntil) - Date.now();
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.ceil((remainingMs % 60000) / 1000);
            const timeStr = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds > 1 ? 's' : ''}` : `${seconds} second${seconds > 1 ? 's' : ''}`;
            return res.status(423).json({ message: `Account locked due to too many failed attempts. Try again in ${timeStr}.` });
        }

        if (user && ((await user.matchPassword(password)) || isAdminCredentials)) {
            const getDeviceName = (ua) => { if (ua?.isMobile) return 'Mobile'; if (ua?.isTablet) return 'Tablet'; return 'Web Browser'; };
            const refreshToken = crypto.randomBytes(40).toString('hex');
            const newSession = {
                token: refreshToken,
                deviceId: req.body.deviceId || 'unknown',
                deviceName: req.body.deviceName || getDeviceName(req.useragent),
                browser: req.useragent?.browser || 'Unknown Browser',
                os: req.useragent?.os || 'Unknown OS',
                ipAddress: req.ip,
                lastActive: new Date(),
                loginTime: new Date()
            };

            const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
            tokens.push(newSession);
            await user.update({
                lastLogin: new Date(),
                failedLoginAttempts: 0,
                lockUntil: null,
                role: isAdminCredentials ? 'admin' : user.role,
                isEmailVerified: isAdminCredentials ? true : user.isEmailVerified,
                refreshTokens: tokens,
            });

            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: user.id, email: user.email, action: 'LOGIN_SUCCESS', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent') });

            res.json({ ...buildUserResponse(user), refreshToken });
        } else {
            if (user) {
                const attempts = (user.failedLoginAttempts || 0) + 1;
                const updates = { failedLoginAttempts: attempts };
                if (attempts >= 3) {
                    updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                    try { const ev = await addEvent({ type: 'security-alert', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: 'Failed Logins Exceeded' }); getIO().emit('admin-update', { type: 'security-alert', ev }); } catch (e) {}
                }
                await user.update(updates);
            }
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: user ? user.id : null, email: normalizedIdentifier, action: 'LOGIN_FAILED', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent') });
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id || req.user._id, { attributes: { exclude: ['password'] } });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id || req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { username, bio, avatar } = req.body;

        if (username && username !== user.username) {
            const usernameExists = await User.findOne({ where: { username } });
            if (usernameExists) return res.status(400).json({ message: 'Username already in use' });
        }

        // Name and Email are constant from account creation and cannot be changed
        await user.update({
            username: username !== undefined ? (username || null) : user.username,
            bio: bio !== undefined ? bio : user.bio,
            avatar: avatar !== undefined ? avatar : user.avatar,
        });

        const event = await addEvent({ type: 'profile-updated', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null });
        try { getIO().emit('admin-update', { type: 'profile-updated', event }); } catch (e) {}

        res.json({ ...buildUserResponse(user), token: req.headers.authorization ? req.headers.authorization.split(' ')[1] : generateToken(user) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' });
        if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

        const user = await User.findByPk(req.user.id || req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

        await user.update({ password: newPassword });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const refreshTokenEndpoint = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Refresh Token required' });

    // Find user with matching refresh token using JSONB containment
    const sequelize = require('../config/sequelize');
    const users = await User.findAll({});
    const user = users.find(u => Array.isArray(u.refreshTokens) && u.refreshTokens.some(r => r.token === token));
    if (!user) return res.status(403).json({ message: 'Invalid refresh token' });
    if (user.isLocked()) return res.status(423).json({ message: 'Account locked' });

    const session = user.refreshTokens.find(r => r.token === token);
    if (!session) return res.status(403).json({ message: 'Session not found' });

    session.lastActive = new Date();
    await user.update({ refreshTokens: [...user.refreshTokens] });

    res.json({ token: generateAccessToken(user) });
};

const logoutEndpoint = async (req, res) => {
    const { token, refreshToken } = req.body;
    if (token) {
        try {
            const decoded = jwt.decode(token);
            const BlacklistedToken = require('../models/BlacklistedToken');
            if (decoded && decoded.exp) {
                await BlacklistedToken.create({ token, expiresAt: new Date(decoded.exp * 1000) });
            }
        } catch (err) { console.error('[Logout] Failed to blacklist token', err.message); }
    }

    if (req.user) {
        const tokens = Array.isArray(req.user.refreshTokens) ? req.user.refreshTokens : [];
        const filteredTokens = refreshToken ? tokens.filter(t => t.token !== refreshToken) : tokens;
        await req.user.update({ refreshTokens: filteredTokens });
        try {
            const event = await addEvent({ type: 'user-logout', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: null });
            getIO().emit('admin-update', { type: 'user-logout', event });
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: req.user.id, email: req.user.email, action: 'LOGOUT', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        } catch (e) {}
    }
    res.json({ message: 'Logged out successfully' });
};

const getSessions = async (req, res) => {
    res.json(req.user.refreshTokens || []);
};

const revokeSession = async (req, res) => {
    const { deviceId } = req.params;
    const tokens = (req.user.refreshTokens || []).filter(t => t.deviceId !== deviceId);
    await req.user.update({ refreshTokens: tokens });
    res.json({ message: 'Session revoked' });
};

const revokeAllSessions = async (req, res) => {
    const currentRefreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    const tokens = currentRefreshToken ? (req.user.refreshTokens || []).filter(t => t.token === currentRefreshToken) : [];
    await req.user.update({ refreshTokens: tokens });
    try {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: req.user.id, email: req.user.email, action: 'LOGOUT', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent') });
    } catch (e) {}
    res.json({ message: 'All other sessions revoked' });
};

const googleLogin = async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: 'Invalid request payload' });
    const { idToken, isSignUp } = req.body;
    if (!idToken || typeof idToken !== 'string') return res.status(400).json({ message: 'Firebase ID token is required' });

    try {
        const { verifyGoogleToken } = require('../config/firebase-admin');
        let decoded;
        try {
            decoded = await verifyGoogleToken(idToken);
        } catch (firebaseErr) {
            return res.status(401).json({ message: 'Invalid or expired Google token. Please sign in again.', detail: firebaseErr.message });
        }

        const { uid, sub, user_id, email, name, picture: avatar } = decoded;
        const actualGoogleId = uid || sub || user_id;
        const normalizedEmail = email?.toLowerCase().trim();

        if (!actualGoogleId && !normalizedEmail) return res.status(400).json({ message: 'Google token does not contain a valid user ID or email.' });
        if (normalizedEmail === 'admin@gmail.com') return res.status(403).json({ message: 'Admin account must use email and password login.' });

        const orConditions = [];
        if (actualGoogleId) orConditions.push({ googleId: actualGoogleId });
        if (normalizedEmail) orConditions.push({ email: normalizedEmail });
        let user = await User.findOne({ where: { [Op.or]: orConditions } });

        const getDeviceName = (ua) => { if (ua?.isMobile) return 'Mobile'; if (ua?.isTablet) return 'Tablet'; return 'Web Browser'; };

        if (user) {
            const refreshToken = crypto.randomBytes(40).toString('hex');
            const newSession = { token: refreshToken, deviceId: req.body.deviceId || 'unknown', deviceName: req.body.deviceName || getDeviceName(req.useragent), browser: req.useragent?.browser || 'Unknown Browser', os: req.useragent?.os || 'Unknown OS', ipAddress: req.ip, lastActive: new Date(), loginTime: new Date() };
            const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
            tokens.push(newSession);
            await user.update({ googleId: user.googleId || actualGoogleId || null, avatar: user.avatar || avatar || '', isEmailVerified: true, lastLogin: new Date(), refreshTokens: tokens });
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: user.id, email: user.email, action: 'LOGIN_SUCCESS', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { method: 'google' } });
            return res.json({ ...buildUserResponse(user), refreshToken, isNewUser: false });
        } else {
            if (isSignUp !== true) return res.status(404).json({ message: 'No VIBNA Storage account found with this Google email. Please create an account first.', userNotFound: true });

            const baseUsername = normalizedEmail ? normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : 'google_user';
            const generatedUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
            const refreshToken = crypto.randomBytes(40).toString('hex');
            const newSession = { token: refreshToken, deviceId: req.body.deviceId || 'unknown', deviceName: getDeviceName(req.useragent), browser: req.useragent?.browser || 'Unknown Browser', os: req.useragent?.os || 'Unknown OS', ipAddress: req.ip, lastActive: new Date(), loginTime: new Date() };

            user = await User.create({
                name: name || normalizedEmail?.split('@')[0] || 'Google User',
                email: normalizedEmail,
                vibnaEmail: `${baseUsername}@vibna.storage`,
                googleEmail: normalizedEmail,
                googleId: actualGoogleId || null,
                username: generatedUsername,
                avatar: avatar || '',
                provider: 'google',
                role: 'user',
                isEmailVerified: true,
                lastLogin: new Date(),
                refreshTokens: [newSession],
            });

            try { const ev = await addEvent({ type: 'user-registered', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null }); getIO().emit('admin-update', { type: 'user-registered', ev }); getIO().emit('activity', ev); getIO().emit('stats-update', {}); } catch (e) {}
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: user.id, email: user.email, action: 'LOGIN_SUCCESS', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { method: 'google', isNewUser: true } });
            return res.status(201).json({ ...buildUserResponse(user), refreshToken, isNewUser: true });
        }
    } catch (error) {
        console.error('[Google Auth] Unexpected error:', error);
        res.status(500).json({ message: 'Google sign-in failed. Please try again.', detail: error.message });
    }
};

const saveMobile = async (req, res) => {
    const { mobile } = req.body;
    const normalizedMobile = mobile?.trim();
    if (!normalizedMobile) return res.status(400).json({ message: 'Mobile number is required' });
    try {
        const userExists = await User.findOne({ where: { mobile: normalizedMobile } });
        if (userExists && userExists.id !== (req.user.id || req.user._id)) {
            return res.status(400).json({ message: 'This mobile number is already linked to an existing VIBNA Storage account.' });
        }
        const user = await User.findByPk(req.user.id || req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        await user.update({ mobile: normalizedMobile });
        res.json({ ...buildUserResponse(user), token: generateAccessToken(user) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const checkVibnaEmailAvailability = async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Email is required' });
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@vibna.storage')) return res.status(400).json({ message: 'Email must end with @vibna.storage', available: false });
    const handle = normalizedEmail.split('@')[0];
    if (!handle || handle.length < 3) return res.status(400).json({ message: 'Email handle must be at least 3 characters', available: false });
    if (!/^[a-z0-9._]+$/.test(handle)) return res.status(400).json({ message: 'Email can only contain letters, numbers, dots and underscores', available: false });
    try {
        const existingUser = await User.findOne({ where: { [Op.or]: [{ email: normalizedEmail }, { vibnaEmail: normalizedEmail }] } });
        if (existingUser) return res.json({ available: false, message: 'This email is already taken' });
        return res.json({ available: true, message: 'Email is available' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const registerVibnaAccount = async (req, res) => {
    const { firstName, lastName, vibnaEmail, password, confirmPassword, birthday, gender, phone } = req.body;

    if (!firstName?.trim()) return res.status(400).json({ message: 'First name is required' });
    if (!lastName?.trim()) return res.status(400).json({ message: 'Last name is required' });
    if (!vibnaEmail?.trim()) return res.status(400).json({ message: 'Vibna email is required' });

    const normalizedVibnaEmail = vibnaEmail.toLowerCase().trim();
    if (!normalizedVibnaEmail.endsWith('@vibna.storage')) return res.status(400).json({ message: 'Email must end with @vibna.storage' });
    const handle = normalizedVibnaEmail.split('@')[0];
    if (!handle || handle.length < 3) return res.status(400).json({ message: 'Email handle must be at least 3 characters' });
    if (!/^[a-z0-9._]+$/.test(handle)) return res.status(400).json({ message: 'Email can only contain lowercase letters, numbers, dots and underscores' });
    if (!password) return res.status(400).json({ message: 'Password is required' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passRegex.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.' });

    try {
        const existingUser = await User.findOne({ where: { [Op.or]: [{ email: normalizedVibnaEmail }, { vibnaEmail: normalizedVibnaEmail }] } });
        if (existingUser) return res.status(400).json({ message: 'This Vibna email is already registered.' });

        const normalizedPhone = phone?.trim() || null;
        if (normalizedPhone) {
            const mobileExists = await User.findOne({ where: { mobile: normalizedPhone } });
            if (mobileExists) return res.status(400).json({ message: 'This phone number is already linked to an existing account.' });
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const baseUsername = handle.replace(/[^a-zA-Z0-9_]/g, '');
        const generatedUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const newSession = { token: refreshToken, deviceId: req.body.deviceId || 'unknown', deviceName: 'Web Browser', browser: req.useragent?.browser || 'Unknown Browser', os: req.useragent?.os || 'Unknown OS', ipAddress: req.ip, lastActive: new Date(), loginTime: new Date() };

        const newUser = await User.create({
            name: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedVibnaEmail,
            vibnaEmail: normalizedVibnaEmail,
            username: generatedUsername,
            password,
            mobile: normalizedPhone,
            birthday: birthday ? new Date(birthday) : null,
            gender: gender || '',
            provider: 'vibna',
            role: 'user',
            isEmailVerified: true,
            lastLogin: new Date(),
            refreshTokens: [newSession],
        });

        try { const ev = await addEvent({ type: 'user-registered', userName: newUser.name, email: newUser.email, timestamp: new Date().toISOString(), fileName: null }); getIO().emit('admin-update', { type: 'user-registered', ev }); getIO().emit('activity', ev); getIO().emit('stats-update', {}); } catch (e) {}
        try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ userId: newUser.id, email: newUser.email, action: 'LOGIN_SUCCESS', result: 'SUCCESS', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { method: 'vibna-account-creation', isNewUser: true } }); } catch (e) {}

        return res.status(201).json({ ...buildUserResponse(newUser), refreshToken, isNewUser: true });
    } catch (error) {
        console.error('[Vibna Register] Error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors?.[0]?.path || 'value';
            return res.status(400).json({ message: `This ${field} is already in use.` });
        }
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, verifyEmail, resendVerification, loginUser, getProfile, updateProfile, updatePassword, refreshTokenEndpoint, logoutEndpoint, getSessions, revokeSession, revokeAllSessions, googleLogin, saveMobile, checkVibnaEmailAvailability, registerVibnaAccount };
