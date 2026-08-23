const User = require('../models/User');
const File = require('../models/File');
const Activity = require('../models/Activity');
const { updateDailyStorage } = require('../utils/storageTracker');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../utils/socket');
const { addEvent } = require('../utils/activityLog');
const cloudinary = require('../config/cloudinary');
const { Op } = require('sequelize');

const extractCloudinaryPublicId = (url) => {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const uploadIndex = segments.indexOf('upload');
        if (uploadIndex < 1) return null;
        const resourceType = segments[uploadIndex - 1];
        let postUploadSegments = segments.slice(uploadIndex + 1);
        if (postUploadSegments.length > 0 && postUploadSegments[0].match(/^v\d+$/)) postUploadSegments.shift();
        return { resourceType, publicId: postUploadSegments.join('/') };
    } catch { return null; }
};

const safeEmit = (event, data) => {
    try { getIO().emit(event, data); }
    catch (e) { console.warn(`[Admin] Socket emit failed (${event}):`, e.message); }
};

// ─── Overview ─────────────────────────────────────────────────────────────────
const getOverview = asyncHandler(async (req, res) => {
    const sequelize = require('../config/sequelize');

    const totalUsers     = await User.count({ where: { role: { [Op.ne]: 'admin' } } });
    const activeUsers    = await User.count({ where: { role: { [Op.ne]: 'admin' }, isSuspended: false } });
    const suspendedUsers = await User.count({ where: { role: { [Op.ne]: 'admin' }, isSuspended: true } });

    const totalFiles     = await File.count({ where: { isDeleted: false } });
    const imagesCount    = await File.count({ where: { category: 'images', isDeleted: false } });
    const videosCount    = await File.count({ where: { category: 'videos', isDeleted: false } });
    const documentsCount = await File.count({ where: { category: 'documents', isDeleted: false } });
    const sharedFilesCount   = await File.count({ where: { isShared: true, isDeleted: false } });
    const trashFilesCount    = await File.count({ where: { isDeleted: true } });
    const favoriteFilesCount = await File.count({ where: { isFavorite: true, isDeleted: false } });

    const totalPlatformStorage = 5 * 1024 * 1024 * 1024; // 5 GB
    const storageResult = await sequelize.query(
        `SELECT COALESCE(SUM(size), 0) as "totalSize" FROM files WHERE "isDeleted" = false`,
        { type: sequelize.QueryTypes.SELECT }
    );
    const usedStorage = parseInt(storageResult[0]?.totalSize) || 0;
    const remainingStorage = Math.max(0, totalPlatformStorage - usedStorage);
    const usagePercentage = parseFloat(((usedStorage / totalPlatformStorage) * 100).toFixed(2));

    const categoryStorageResult = await sequelize.query(
        `SELECT category, COALESCE(SUM(size), 0) as "totalSize" FROM files WHERE "isDeleted" = false GROUP BY category`,
        { type: sequelize.QueryTypes.SELECT }
    );
    const imagesStorage    = parseInt(categoryStorageResult.find(c => c.category === 'images')?.totalSize) || 0;
    const videosStorage    = parseInt(categoryStorageResult.find(c => c.category === 'videos')?.totalSize) || 0;
    const documentsStorage = parseInt(categoryStorageResult.find(c => c.category === 'documents')?.totalSize) || 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const uploadsToday          = await File.count({ where: { isDeleted: false, createdAt: { [Op.gte]: startOfDay } } });
    const deletedFilesToday     = await File.count({ where: { isDeleted: true, deletedAt: { [Op.gte]: startOfDay } } });
    const newRegistrationsToday = await User.count({ where: { role: { [Op.ne]: 'admin' }, createdAt: { [Op.gte]: startOfDay } } });
    const downloadsToday        = await Activity.count({ where: { type: 'file-downloaded', timestamp: { [Op.gte]: startOfDay } } });
    const restoredFilesToday    = await Activity.count({ where: { type: 'file-restored', timestamp: { [Op.gte]: startOfDay } } });
    const sharesToday           = await Activity.count({ where: { type: 'file-shared', timestamp: { [Op.gte]: startOfDay } } });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const onlineUsers = await Activity.count({ where: { type: 'user-login', timestamp: { [Op.gte]: oneHourAgo } } });
    const loginsToday = await Activity.count({ where: { type: 'user-login', timestamp: { [Op.gte]: startOfDay } } });

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const uploadsTrendResult = await sequelize.query(
        `SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, COUNT(*) as count, COALESCE(SUM(size), 0) as size
         FROM files WHERE "isDeleted" = false AND "createdAt" >= :since
         GROUP BY date ORDER BY date ASC`,
        { replacements: { since: ninetyDaysAgo }, type: sequelize.QueryTypes.SELECT }
    );

    const downloadsTrendResult = await sequelize.query(
        `SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') as date, COUNT(*) as count
         FROM activities WHERE type = 'file-downloaded' AND timestamp >= :since
         GROUP BY date ORDER BY date ASC`,
        { replacements: { since: ninetyDaysAgo }, type: sequelize.QueryTypes.SELECT }
    );

    const StorageHistory = require('../models/StorageHistory');
    const storageHistories = await StorageHistory.findAll({ where: { date: { [Op.gte]: ninetyDaysAgo.toISOString().split('T')[0] } } });

    const uploadTrend  = [];
    const downloadTrend = [];
    const storageTrend  = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 89; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const dayName = `${months[d.getMonth()]} ${d.getDate()}`;

        const upMatch = uploadsTrendResult.find(t => t.date === dateString);
        const dlMatch = downloadsTrendResult.find(t => t.date === dateString);
        const shMatch = storageHistories.find(h => h.date === dateString);

        uploadTrend.push({ name: dayName, date: dateString, count: parseInt(upMatch?.count) || 0 });
        downloadTrend.push({ name: dayName, date: dateString, count: parseInt(dlMatch?.count) || 0 });
        storageTrend.push({ name: dayName, date: dateString, size: shMatch ? shMatch.storageUsed : (i === 0 ? usedStorage : null) });
    }

    let runningStorage = usedStorage;
    for (let i = storageTrend.length - 1; i >= 0; i--) {
        if (storageTrend[i].size !== null) {
            runningStorage = storageTrend[i].size;
        } else {
            storageTrend[i].size = runningStorage;
        }
    }

    res.json({
        users: { totalUsers, activeUsers, suspendedUsers, onlineUsers, newRegistrationsToday },
        files: { totalFiles, imagesCount, videosCount, documentsCount, sharedFilesCount, trashFilesCount, favoriteFilesCount },
        storage: { totalCapacity: totalPlatformStorage, usedStorage, remainingStorage, usagePercentage, imagesStorage, videosStorage, documentsStorage },
        activity: { uploadsToday, deletedFilesToday, newRegistrationsToday, downloadsToday, restoredFilesToday, sharesToday, loginsToday },
        trends: { uploadTrend, downloadTrend, storageTrend }
    });
});

// ─── Users List ───────────────────────────────────────────────────────────────
const getUsers = asyncHandler(async (req, res) => {
    const sequelize = require('../config/sequelize');
    const users = await User.findAll({ where: { role: { [Op.ne]: 'admin' } }, attributes: { exclude: ['password'] } });

    const statsResult = await sequelize.query(
        `SELECT "userId", COUNT(*) as "totalFiles", COALESCE(SUM(size), 0) as "totalStorageUsed"
         FROM files WHERE "isDeleted" = false GROUP BY "userId"`,
        { type: sequelize.QueryTypes.SELECT }
    );

    const mappedUsers = users.map(user => {
        const userStat = statsResult.find(s => s.userId === user.id);
        return {
            ...user.toJSON(),
            totalFiles: parseInt(userStat?.totalFiles) || 0,
            totalStorageUsed: parseInt(userStat?.totalStorageUsed) || 0,
        };
    });

    res.json(mappedUsers);
});

// ─── Suspend User ─────────────────────────────────────────────────────────────
const suspendUser = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user)               return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot suspend admin user' });

    await user.update({ isSuspended: true });

    try {
        const event = await addEvent({ type: 'user-suspended', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null });
        safeEmit('admin-update', { type: 'user-suspended', event });
        safeEmit('activity', event);
        safeEmit('stats-update', {});
        safeEmit('user-status-changed', { userId: user.id, isSuspended: true });
    } catch (e) { console.warn('[Admin] addEvent failed:', e.message); }

    res.json({ message: 'User suspended successfully', user });
});

// ─── Activate User ────────────────────────────────────────────────────────────
const activateUser = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ isSuspended: false });

    try {
        const event = await addEvent({ type: 'user-activated', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null });
        safeEmit('admin-update', { type: 'user-activated', event });
        safeEmit('activity', event);
        safeEmit('stats-update', {});
        safeEmit('user-status-changed', { userId: user.id, isSuspended: false });
    } catch (e) { console.warn('[Admin] addEvent failed:', e.message); }

    res.json({ message: 'User activated successfully', user });
});

// ─── Delete User (+ update storage & real-time socket events) ────────────────
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user)               return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete admin' });

    const files = await File.findAll({ where: { userId: user.id } });
    let deletedFileCount = 0;

    for (const file of files) {
        if (file.fileUrl && file.fileUrl.includes('cloudinary.com')) {
            try {
                const parsedId = extractCloudinaryPublicId(file.fileUrl);
                if (parsedId && parsedId.publicId) {
                    await cloudinary.uploader.destroy(parsedId.publicId, { resource_type: parsedId.resourceType || 'auto' });
                }
            } catch (err) { console.error('[Admin DeleteUser] Cloudinary err:', err.message); }
        }
        await file.destroy();
        deletedFileCount++;
    }

    await user.destroy();

    // Recalculate daily storage immediately so StorageHistory reflects freed space
    await updateDailyStorage();

    try {
        const event = await addEvent({ type: 'user-deleted', userName: user.name, email: user.email, timestamp: new Date().toISOString(), fileName: null });
        safeEmit('admin-update', { type: 'user-deleted', event });
        safeEmit('activity', event);
        safeEmit('stats-update', {});
        safeEmit('storageUpdated', {});
        safeEmit('dashboardUpdated', {});
    } catch (e) { console.warn('[Admin] addEvent failed:', e.message); }

    res.json({ message: `User and ${deletedFileCount} file(s) deleted successfully` });
});

// ─── User Details ─────────────────────────────────────────────────────────────
const getUserDetails = asyncHandler(async (req, res) => {
    const sequelize = require('../config/sequelize');
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const totalCapacity = 5 * 1024 * 1024 * 1024;

    const totalFiles     = await File.count({ where: { userId: user.id, isDeleted: false } });
    const imagesCount    = await File.count({ where: { userId: user.id, category: 'images', isDeleted: false } });
    const videosCount    = await File.count({ where: { userId: user.id, category: 'videos', isDeleted: false } });
    const documentsCount = await File.count({ where: { userId: user.id, category: 'documents', isDeleted: false } });
    const favoritesCount = await File.count({ where: { userId: user.id, isFavorite: true, isDeleted: false } });
    const trashCount     = await File.count({ where: { userId: user.id, isDeleted: true } });
    const sharedCount    = await File.count({ where: { userId: user.id, shareToken: { [Op.ne]: null }, isDeleted: false } });

    const storageResult = await sequelize.query(
        `SELECT COALESCE(SUM(size), 0) as "totalSize" FROM files WHERE "userId" = :userId AND "isDeleted" = false`,
        { replacements: { userId: user.id }, type: sequelize.QueryTypes.SELECT }
    );
    const storageUsed      = parseInt(storageResult[0]?.totalSize) || 0;
    const storageRemaining = Math.max(0, totalCapacity - storageUsed);
    const usagePercentage  = parseFloat(((storageUsed / totalCapacity) * 100).toFixed(2));

    const activities = await Activity.findAll({ where: { email: user.email }, order: [['timestamp', 'DESC']], limit: 20 });

    res.json({
        user,
        storage: { totalCapacity, storageUsed, storageRemaining, usagePercentage },
        files: { totalFiles, imagesCount, videosCount, documentsCount, favoritesCount, trashCount, sharedCount },
        activities,
    });
});

// ─── Activities Feed ──────────────────────────────────────────────────────────
const getActivities = asyncHandler(async (req, res) => {
    const activities = await Activity.findAll({ order: [['timestamp', 'DESC']], limit: 100 });
    res.json(activities);
});

// ─── Security Stats ───────────────────────────────────────────────────────────
const getSecurityStats = asyncHandler(async (req, res) => {
    const now = new Date();

    const usersWithSessions = await User.findAll();
    let activeSessionsCount = 0;
    usersWithSessions.forEach(u => {
        if (Array.isArray(u.refreshTokens)) activeSessionsCount += u.refreshTokens.length;
    });

    const lockedAccounts = await User.count({ where: { lockUntil: { [Op.gt]: now } } });

    const usersWithFailures = await User.findAll({ where: { failedLoginAttempts: { [Op.gt]: 0 } }, attributes: ['failedLoginAttempts'] });
    let totalFailedAttempts = 0;
    usersWithFailures.forEach(u => totalFailedAttempts += u.failedLoginAttempts);

    const activeShareLinks  = await File.count({ where: { isShared: true } });
    const expiredShareLinks = 0;

    const alerts = await Activity.findAll({ where: { type: { [Op.in]: ['user-login-failed', 'user-locked'] } }, order: [['timestamp', 'DESC']], limit: 10 });
    const securityFeed = await Activity.findAll({ where: { type: { [Op.in]: ['user-login', 'user-logout', 'user-login-failed', 'user-locked', 'file-shared', 'user-registered'] } }, order: [['timestamp', 'DESC']], limit: 20 });

    res.json({ activeSessions: activeSessionsCount, lockedAccounts, failedLogins: totalFailedAttempts, activeShareLinks, expiredShareLinks, recentAlerts: alerts, securityFeed });
});

module.exports = { getOverview, getUsers, suspendUser, activateUser, deleteUser, getUserDetails, getActivities, getSecurityStats };