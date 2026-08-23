const File = require('../models/File');
const { normalizeCategory, isAllowedMime, CATEGORY_CONFIG } = require('../utils/fileCategoryConfig');
const { calculateFileHash } = require('../utils/hasher');
const asyncHandler = require('../utils/asyncHandler');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');
const { getIO } = require('../utils/socket');
const { addEvent } = require('../utils/activityLog');
const { updateDailyStorage } = require('../utils/storageTracker');
const { Op, fn, col, literal } = require('sequelize');

// Helper: emit socket events without crashing if IO not yet ready
const safeEmit = (eventName, data) => {
    try { getIO().emit(eventName, data); }
    catch (e) { console.warn(`[Socket] emit '${eventName}' skipped:`, e.message); }
};

// Convenience: emit all admin-relevant events at once
const emitAdminEvent = (type, event) => {
    safeEmit('admin-update', { type, event });
    safeEmit('activity', event);
    safeEmit('stats-update', {});
};

// Map file extensions to correct MIME types (for Office documents especially)
const getMimeTypeFromExtension = (filename) => {
    if (!filename) return 'application/octet-stream';
    const ext = filename.toLowerCase().split('.').pop();
    const mimeMap = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'docm': 'application/vnd.ms-word.document.macroEnabled.12',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
    };
    return mimeMap[ext] || 'application/octet-stream';
};

const getUserId = (req) => (req && req.user ? (req.user.id || req.user._id) : null);

// Upload handler used by category-specific routes.
const uploadFileByCategory = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const categoryFromRoute = (() => {
        const parts = req.originalUrl.split('/').filter(Boolean);
        const idx = parts.indexOf('upload');
        if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
        return null;
    })();

    const category = normalizeCategory(categoryFromRoute);
    if (!category) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        return res.status(400).json({ message: 'Invalid category' });
    }

    if (!isAllowedMime(category, req.file.mimetype, req.file.originalname)) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        return res.status(400).json({ message: 'Invalid file type for category' });
    }

    const tempFilePath = req.file.path;
    let sha256Hash;
    try {
        sha256Hash = await calculateFileHash(tempFilePath);
    } catch (err) {
        try { fs.unlinkSync(tempFilePath); } catch(e) {}
        return res.status(500).json({ message: 'Error hashing file', error: err.message });
    }

    let fileUrl = '';
    
    // Store all uploads locally for speed and reliability
    const categoryDir = path.join(__dirname, '../uploads', category);
    fs.mkdirSync(categoryDir, { recursive: true });
    const finalPath = path.join(categoryDir, path.basename(tempFilePath));
    // Use copy + unlink instead of rename to avoid EBUSY errors on Windows
    try { fs.copyFileSync(tempFilePath, finalPath); } catch (e) { try { fs.unlinkSync(tempFilePath); } catch (e2) {} throw e; }
    try { fs.unlinkSync(tempFilePath); } catch (e) { /* non-critical */ }
    const backendDir = path.resolve(__dirname, '..');
    fileUrl = path.relative(backendDir, finalPath).replace(/\\/g, '/');

    const newFile = await File.create({
        filename: req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype,
        category,
        size: req.file.size,
        userId: getUserId(req),
        sha256Hash
    });

    try {
        const event = await addEvent({
            type: 'file-uploaded',
            userName: req.user.name,
            email: req.user.email,
            timestamp: new Date().toISOString(),
            fileName: newFile.filename,
        });
        emitAdminEvent('file-uploaded', event);
        await updateDailyStorage();
    } catch (e) {
        console.warn('[File] Socket emission skipped - socket not ready', e.message);
    }

    res.status(201).json(newFile);
});

const getHistory = asyncHandler(async (req, res) => {
    const {
        search = '',
        category = 'all',
        sort = 'latest',
        page = '1',
        limit = '24',
        favoritesOnly = 'false',
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);

    const where = { userId: getUserId(req), isDeleted: false };

    if (category !== 'all') {
        const normalized = normalizeCategory(category);
        if (!normalized) return res.status(400).json({ message: 'Invalid category filter' });
        where.category = normalized;
    }

    if (search) {
        where.filename = { [Op.iLike]: `%${search}%` };
    }

    if (favoritesOnly === 'true' || favoritesOnly === true) {
        where.isFavorite = true;
    }

    const sortMap = {
        latest: [['createdAt', 'DESC']],
        oldest: [['createdAt', 'ASC']],
        largest: [['size', 'DESC']],
        name: [['filename', 'ASC']],
    };

    const { count, rows: files } = await File.findAndCountAll({
        where,
        order: sortMap[sort] || sortMap.latest,
        offset: (pageNum - 1) * limitNum,
        limit: limitNum,
    });

    res.json({
        items: files,
        total: count,
        page: pageNum,
        limit: limitNum,
        hasMore: pageNum * limitNum < count,
    });
});

const renameFile = asyncHandler(async (req, res) => {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ message: 'filename is required' });
    }

    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: getUserId(req), email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Rename unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }

    await file.update({ filename: filename.trim() });
    res.json(file);
});

const deleteFile = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    if (file.userId !== getUserId(req)) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: getUserId(req), email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Delete unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }

    await file.update({ isDeleted: true, deletedAt: new Date() });

    safeEmit('fileDeleted', file.id);
    safeEmit('storageUpdated', {});
    safeEmit('dashboardUpdated', {});

    try {
        const event = await addEvent({ type: 'file-deleted', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: file.filename });
        emitAdminEvent('file-deleted', event);
        await updateDailyStorage();
    } catch (e) {
        console.warn('[File] Socket emission skipped - socket not ready', e.message);
    }

    res.json({ message: 'File moved to trash' });
});

const getShareLink = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json({ shareUrl: file.fileUrl });
});

const getFileById = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const currentUserId = getUserId(req);
    if (!req.user || !currentUserId) {
        return res.status(401).json({ message: 'Not authorized, please log in' });
    }

    if (file.userId !== currentUserId) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: currentUserId, email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'GetFileById unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }

    const data = file.toJSON ? file.toJSON() : { ...file };
    data.isOwner = true;
    res.json(data);
});

const extractCloudinaryPublicId = (url) => {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const uploadIndex = segments.indexOf('upload');
        if (uploadIndex < 1) return null;
        const resourceType = segments[uploadIndex - 1];
        let postUploadSegments = segments.slice(uploadIndex + 1);
        if (postUploadSegments.length > 0 && postUploadSegments[0].match(/^v\d+$/)) {
            postUploadSegments.shift();
        }
        const publicId = postUploadSegments.join('/');
        return { resourceType, publicId };
    } catch (err) {
        return null;
    }
};

const followRedirects = (url, maxRedirects = 5, timeoutMs = 60000, requestHeaders = {}) => {
    return new Promise((resolve, reject) => {
        const fetch = (currentUrl, redirectsLeft) => {
            const parsed = new URL(currentUrl);
            const client = parsed.protocol === 'http:' ? require('http') : require('https');
            const headers = { ...requestHeaders };
            delete headers.host;
            const req = client.get(currentUrl, { headers }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirectsLeft === 0) return reject(new Error('Too many redirects'));
                    fetch(res.headers.location, redirectsLeft - 1);
                } else {
                    resolve(res);
                }
            });
            req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Storage request timed out after ${timeoutMs/1000} seconds`)); });
            req.on('error', reject);
        };
        fetch(url, maxRedirects);
    });
};

const downloadFile = asyncHandler(async (req, res) => {
    const requestedFileId = req.params.id;
    const file = await File.findByPk(requestedFileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const shareToken = req.query.share;
    let isAuthorized = false;

    if (shareToken) {
        if (file.shareToken === shareToken) { isAuthorized = true; }
        else return res.status(401).json({ message: 'Invalid share token' });
    } else if (req.user) {
        if (file.userId === getUserId(req)) { isAuthorized = true; }
        else {
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({ userId: getUserId(req), email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Download unauthorized', fileId: file.id } });
            return res.status(403).json({ message: 'Forbidden' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized' });
    }

    if (!isAuthorized) return res.status(403).json({ message: 'Forbidden' });

    const isActualDownload = req.query && (req.query.dl === '1' || req.query.download === 'true' || req.headers['x-force-download'] === '1');
    if (req.user && file.userId === getUserId(req) && isActualDownload) {
        await file.update({ downloadCount: (file.downloadCount || 0) + 1 });
        try {
            const event = await addEvent({ type: 'file-downloaded', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: file.filename });
            emitAdminEvent('file-downloaded', event);
        } catch (e) {}
    }

    const mimeType = getMimeTypeFromExtension(file.filename) || file.fileType || 'application/octet-stream';
    const filename = file.filename || 'download';
    const safeFilename = filename.replace(/[\r\n"]/g, '').replace(/"/g, "'");

    try {
        const wantAttachment = req.query && (req.query.dl === '1' || req.query.download === 'true' || req.headers['x-force-download'] === '1');

        if (file.fileUrl && !file.fileUrl.startsWith('http')) {
            const localPath = path.resolve(__dirname, '..', file.fileUrl);
            if (fs.existsSync(localPath)) {
                if (file.sha256Hash) {
                    const currentHash = await calculateFileHash(localPath);
                    if (currentHash !== file.sha256Hash) {
                        const AuditLog = require('../models/AuditLog');
                        await AuditLog.create({ userId: req.user ? getUserId(req) : null, email: req.user ? req.user.email : 'anonymous', action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'File tampering detected', fileId: file.id } });
                        return res.status(400).json({ message: 'File is corrupted or tampered. Download blocked.' });
                    }
                }
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Content-Disposition', `${wantAttachment ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
                const stat = fs.statSync(localPath);
                const range = req.headers.range;
                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                    const chunksize = (end - start) + 1;
                    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': chunksize });
                    fs.createReadStream(localPath, { start, end }).pipe(res);
                } else {
                    res.setHeader('Content-Length', stat.size);
                    fs.createReadStream(localPath).pipe(res);
                }
                return;
            } else {
                return res.status(404).json({ message: 'File not found on disk' });
            }
        }

        const proxyUrl = file.fileUrl;
        if (!proxyUrl) return res.status(404).json({ message: 'Storage URL missing' });

        let publicId = null;
        let isCloudinary = false;

        const generateSignedCloudinaryUrl = (resourceType) => cloudinary.url(publicId, { resource_type: resourceType, secure: true, sign_url: true });
        const getCategoryResourceType = (cat) => { if (cat === 'documents') return 'raw'; if (cat === 'videos') return 'video'; return 'image'; };

        if (proxyUrl.includes('cloudinary.com')) {
            const parsedId = extractCloudinaryPublicId(proxyUrl);
            if (parsedId && parsedId.publicId) { isCloudinary = true; publicId = parsedId.publicId; }
        }

        const requestHeaders = {};
        if (req.headers.range) requestHeaders['range'] = req.headers.range;

        let remoteRes = null;

        if (isCloudinary && publicId) {
            const primaryResourceType = getCategoryResourceType(file.category);
            const signedUrl = generateSignedCloudinaryUrl(primaryResourceType);
            try { remoteRes = await followRedirects(signedUrl, 5, 60000, requestHeaders); } catch (err) {}

            if (!remoteRes || (remoteRes.statusCode !== 200 && remoteRes.statusCode !== 206)) {
                remoteRes?.destroy?.();
                const fallbackTypes = ['raw', 'image', 'video', 'auto'].filter(t => t !== primaryResourceType);
                for (const type of fallbackTypes) {
                    try {
                        const fallbackRes = await followRedirects(generateSignedCloudinaryUrl(type), 5, 60000, requestHeaders);
                        if (fallbackRes.statusCode === 200 || fallbackRes.statusCode === 206) { remoteRes = fallbackRes; break; }
                        fallbackRes.destroy?.();
                    } catch (e) {}
                }
            }
        } else {
            try { remoteRes = await followRedirects(proxyUrl, 5, 60000, requestHeaders); } catch (err) {
                return res.status(504).json({ message: err.message || 'Storage request failed' });
            }
        }

        if (!remoteRes) return res.status(502).json({ message: 'Unable to retrieve file from storage.' });
        if (remoteRes.statusCode !== 200 && remoteRes.statusCode !== 206) return res.status(remoteRes.statusCode).end();

        if (remoteRes.statusCode === 206) {
            res.status(206);
            if (remoteRes.headers['content-range']) res.setHeader('Content-Range', remoteRes.headers['content-range']);
        } else {
            res.status(200);
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `${wantAttachment ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        if (remoteRes.headers['content-length']) res.setHeader('Content-Length', remoteRes.headers['content-length']);
        remoteRes.pipe(res);
        remoteRes.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve file from storage' });
    }
});

const previewFile = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const shareToken = req.query.share;
    let isAuthorized = false;

    if (shareToken) {
        if (file.shareToken === shareToken) isAuthorized = true;
    } else if (req.user) {
        if (file.userId === getUserId(req)) isAuthorized = true;
    }

    if (!isAuthorized) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: req.user ? getUserId(req) : null, email: req.user ? req.user.email : 'anonymous', action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Preview unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }

    const mimeType = getMimeTypeFromExtension(file.filename) || file.fileType || 'application/octet-stream';
    const filename = file.filename || 'preview';
    const safeFilename = filename.replace(/[\r\n"]/g, '').replace(/"/g, "'");

    try {
        if (file.fileUrl && !file.fileUrl.startsWith('http')) {
            const localPath = path.resolve(__dirname, '..', file.fileUrl);
            if (fs.existsSync(localPath)) {
                const stat = fs.statSync(localPath);
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Content-Length', stat.size);
                const fileStream = fs.createReadStream(localPath);
                fileStream.pipe(res);
                fileStream.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
                return;
            } else {
                return res.status(404).json({ message: 'File not found on disk' });
            }
        }

        let proxyUrl = file.fileUrl;
        if (!proxyUrl) return res.status(404).json({ message: 'Storage URL missing' });

        let publicId = null;
        let initialResourceType = null;
        let isCloudinary = false;

        if (proxyUrl.includes('cloudinary.com')) {
            const parsedId = extractCloudinaryPublicId(proxyUrl);
            if (parsedId && parsedId.publicId) {
                isCloudinary = true;
                publicId = parsedId.publicId;
                initialResourceType = parsedId.resourceType;
            }
        }

        let remoteRes = null;
        try {
            remoteRes = await followRedirects(proxyUrl, 5, 60000);
        } catch (err) {
            return res.status(504).json({ message: err.message || 'Storage request failed' });
        }

        if (isCloudinary && publicId && remoteRes.statusCode !== 200) {
            remoteRes.destroy?.();
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;

            if (cloudName && apiKey && apiSecret) {
                const resourceTypes = [initialResourceType, 'raw', 'image', 'video', 'auto'].filter((v, i, a) => v && a.indexOf(v) === i);
                for (const resType of resourceTypes) {
                    try {
                        const adminUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resType}/upload/${publicId}`;
                        const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
                        const adminFetch = await new Promise((resolve, reject) => {
                            const https = require('https');
                            const parsed = new URL(adminUrl);
                            const req = https.get({ hostname: parsed.hostname, path: parsed.pathname, headers: { 'Authorization': authHeader } }, (res) => resolve(res));
                            req.setTimeout(15000, () => { req.destroy(); reject(new Error('Admin API timeout')); });
                            req.on('error', reject);
                        });

                        if (adminFetch.statusCode === 200) {
                            const chunks = [];
                            for await (const chunk of adminFetch) { chunks.push(chunk); }
                            const adminData = JSON.parse(Buffer.concat(chunks).toString());
                            const signedUrl = cloudinary.url(publicId, { resource_type: resType, secure: true, sign_url: true, type: 'authenticated' });
                            try {
                                const authRes = await followRedirects(signedUrl, 5, 60000);
                                if (authRes.statusCode === 200) { remoteRes = authRes; break; }
                                authRes.destroy?.();
                            } catch(e) {}
                        } else {
                            adminFetch.destroy?.();
                        }
                    } catch (e) {}
                }
            }
        }

        if (isCloudinary && publicId && (!remoteRes || remoteRes.statusCode !== 200)) {
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;
            if (cloudName && apiKey && apiSecret) {
                const resourceTypes = [initialResourceType, 'raw', 'image', 'video'].filter((v, i, a) => v && a.indexOf(v) === i);
                for (const resType of resourceTypes) {
                    try {
                        const timestamp = Math.round(Date.now() / 1000);
                        const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp }, apiSecret);
                        const downloadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resType}/upload/${publicId}?timestamp=${timestamp}&api_key=${apiKey}&signature=${signature}`;
                        const sdkRes = await followRedirects(downloadUrl, 5, 60000);
                        if (sdkRes.statusCode === 200 && !(sdkRes.headers['content-type'] || '').includes('json')) {
                            remoteRes = sdkRes; break;
                        }
                        sdkRes.destroy?.();
                    } catch(e) {}
                }
            }
        }

        if (isCloudinary && publicId && (!remoteRes || remoteRes.statusCode !== 200)) {
            try {
                const resourceTypes = [initialResourceType, 'raw', 'image', 'video'].filter(Boolean);
                for (const resType of resourceTypes) {
                    const privateUrl = cloudinary.utils.private_download_url(publicId, '', { resource_type: resType, type: 'upload', expires_at: Math.floor(Date.now() / 1000) + 3600 });
                    try {
                        const privRes = await followRedirects(privateUrl, 5, 60000);
                        if (privRes.statusCode === 200) { remoteRes = privRes; break; }
                        privRes.destroy?.();
                    } catch(e) {}
                }
            } catch (e) {}
        }

        if (!remoteRes || remoteRes.statusCode !== 200) {
            if (isCloudinary && publicId) {
                try {
                    const localDir = path.join(__dirname, '..', 'uploads', 'documents');
                    fs.mkdirSync(localDir, { recursive: true });
                    const ext = path.extname(file.filename) || '.pdf';
                    const localFileName = `migrated-${file.id}${ext}`;
                    const localFilePath = path.join(localDir, localFileName);
                    const resourceTypes = [initialResourceType, 'raw'].filter(Boolean);
                    let downloaded = false;
                    for (const resType of resourceTypes) {
                        try {
                            const privUrl = cloudinary.utils.private_download_url(publicId, ext.replace('.', ''), { resource_type: resType });
                            const dlRes = await followRedirects(privUrl, 5, 60000);
                            if (dlRes.statusCode === 200) {
                                const writeStream = fs.createWriteStream(localFilePath);
                                await new Promise((resolve, reject) => { dlRes.pipe(writeStream); writeStream.on('finish', resolve); writeStream.on('error', reject); });
                                await file.update({ fileUrl: `uploads/documents/${localFileName}` });
                                downloaded = true;
                                const stat = fs.statSync(localFilePath);
                                res.setHeader('Content-Type', mimeType);
                                res.setHeader('Cache-Control', 'public, max-age=3600');
                                res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
                                res.setHeader('Content-Length', stat.size);
                                fs.createReadStream(localFilePath).pipe(res);
                                return;
                            }
                            dlRes.destroy?.();
                        } catch(e) {}
                    }
                    if (!downloaded) return res.status(502).json({ message: 'This PDF is stored on Cloudinary which has PDF delivery restricted.' });
                } catch(e) {
                    return res.status(502).json({ message: 'This PDF is stored on Cloudinary which has PDF delivery restricted.' });
                }
            }
            return res.status(502).json({ message: 'Failed to retrieve file from cloud storage' });
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
        if (remoteRes.headers['content-length']) res.setHeader('Content-Length', remoteRes.headers['content-length']);
        remoteRes.pipe(res);
        remoteRes.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve file from storage' });
    }
});

const getDashboardStats = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const sequelize = require('../config/sequelize');

    const statsResult = await sequelize.query(
        `SELECT 
            COUNT(*) as "totalFiles",
            COALESCE(SUM(size), 0) as "totalSize",
            COUNT(*) FILTER (WHERE category = 'images') as "imagesCount",
            COUNT(*) FILTER (WHERE category = 'videos') as "videosCount",
            COUNT(*) FILTER (WHERE category = 'documents') as "documentsCount"
         FROM files WHERE "userId" = :userId AND "isDeleted" = false`,
        { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
    );

    const resultStats = statsResult[0] ? {
        totalFiles: parseInt(statsResult[0].totalFiles) || 0,
        totalSize: parseInt(statsResult[0].totalSize) || 0,
        imagesCount: parseInt(statsResult[0].imagesCount) || 0,
        videosCount: parseInt(statsResult[0].videosCount) || 0,
        documentsCount: parseInt(statsResult[0].documentsCount) || 0,
    } : { totalFiles: 0, totalSize: 0, imagesCount: 0, videosCount: 0, documentsCount: 0 };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trendResult = await sequelize.query(
        `SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, COUNT(*) as count
         FROM files
         WHERE "userId" = :userId AND "isDeleted" = false AND "createdAt" >= :since
         GROUP BY date ORDER BY date ASC`,
        { replacements: { userId, since: sevenDaysAgo }, type: sequelize.QueryTypes.SELECT }
    );

    const trendData = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const dayName = daysOfWeek[d.getDay()];
        const match = trendResult.find(t => t.date === dateString);
        trendData.push({ name: dayName, date: dateString, uploads: match ? parseInt(match.count) : 0 });
    }

    res.json({ stats: resultStats, trend: trendData });
});

const findSharedFileByToken = async (shareToken, fileId = null) => {
    if (!shareToken && !fileId) return null;

    // 1. Direct SQL lookup by shareToken
    if (shareToken) {
        const file = await File.findOne({ where: { shareToken, isShared: true, isDeleted: false } });
        if (file) return file;
    }

    // 2. Lookup by file ID (UUID) if shareToken or fileId is a file ID
    const possibleId = fileId || shareToken;
    if (possibleId) {
        try {
            const file = await File.findByPk(possibleId);
            if (file && !file.isDeleted) {
                return file;
            }
        } catch (e) {
            // Ignore UUID format error if possibleId is not a valid UUID
        }
    }

    // 3. Fallback for legacy encrypted DB entries or token matches
    if (shareToken) {
        const activeShares = await File.findAll({ where: { isShared: true, isDeleted: false } });
        const legacyMatch = activeShares.find(f => f.shareToken === shareToken || f.id === shareToken);
        if (legacyMatch) return legacyMatch;
    }

    return null;
};

const generateShareToken = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) return res.status(401).json({ message: 'Not authorized' });
    if (file.isDeleted) return res.status(400).json({ message: 'Cannot share a deleted file' });

    const { viewLimit, downloadLimit, sharePassword } = req.body || {};
    let shareToken = file.shareToken;
    const isNewPayload = viewLimit !== undefined || downloadLimit !== undefined || sharePassword !== undefined;

    // If file is not yet shared or new parameters were provided, generate/update token & settings
    if (!file.isShared || !shareToken || isNewPayload) {
        shareToken = shareToken || require('crypto').randomBytes(32).toString('hex');
        const updates = {
            shareToken,
            isShared: true,
        };

        if (viewLimit !== undefined) updates.shareViewLimit = viewLimit ? parseInt(viewLimit, 10) : null;
        if (downloadLimit !== undefined) updates.shareDownloadLimit = downloadLimit ? parseInt(downloadLimit, 10) : null;

        if (sharePassword) {
            const bcrypt = require('bcrypt');
            const salt = await bcrypt.genSalt(10);
            updates.sharePassword = await bcrypt.hash(sharePassword, salt);
        }

        await file.update(updates);
    }

    // Build the share URL using the live frontend origin.
    // Priority order (highest → lowest):
    //   1. req.headers.origin — the actual domain the browser sent the request from (always correct)
    //   2. req.headers.referer — fallback when Origin is absent (e.g. some non-browser clients)
    //   3. FRONTEND_URL env var — set in .env for production deployments
    //   4. VITE_APP_URL env var — legacy build-time env var
    // Build the share URL using the live frontend origin.
    let frontendOrigin = '';

    const requestOrigin = req.headers.origin || '';
    const requestReferer = req.headers.referer || '';

    if (requestOrigin) {
        frontendOrigin = requestOrigin;
    } else if (requestReferer) {
        try {
            frontendOrigin = new URL(requestReferer).origin;
        } catch (_) {
            frontendOrigin = requestReferer;
        }
    } else {
        const envFrontend = process.env.FRONTEND_URL || '';
        const envVite = process.env.VITE_APP_URL || '';
        if (envFrontend) {
            frontendOrigin = envFrontend;
        } else if (envVite) {
            frontendOrigin = envVite;
        } else {
            frontendOrigin = 'http://localhost:5173';
        }
    }

    frontendOrigin = frontendOrigin.replace(/\/+$/, '');
    if (!frontendOrigin.startsWith('http://') && !frontendOrigin.startsWith('https://')) {
        frontendOrigin = `https://${frontendOrigin}`;
    }
    const shareUrl = `${frontendOrigin}/viewer/${shareToken}`;
    console.log('[Share] Generated share URL:', shareUrl, '(from origin:', req.headers.origin || 'none', ')');

    try {
        const event = await addEvent({ type: 'file-shared', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: file.filename });
        emitAdminEvent('file-shared', event);
    } catch (e) {}

    res.json({ shareUrl, shareToken });
});

// Update share settings on an existing share (password / download limit) without regenerating token
const updateShareSettings = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) return res.status(401).json({ message: 'Not authorized' });
    if (!file.isShared || !file.shareToken) return res.status(400).json({ message: 'File is not shared yet. Generate a share link first.' });

    const { downloadLimit, sharePassword, clearPassword, clearDownloadLimit, resetDownloads } = req.body || {};
    console.log('[updateShareSettings] body:', { downloadLimit, sharePassword: !!sharePassword, clearPassword, clearDownloadLimit, resetDownloads });

    const updates = {};

    // Handle download limit
    if (clearDownloadLimit) {
        updates.shareDownloadLimit = null;
    } else if (downloadLimit !== undefined && downloadLimit !== '' && downloadLimit !== null) {
        const parsed = parseInt(downloadLimit, 10);
        if (isNaN(parsed) || parsed < 1) return res.status(400).json({ message: 'Download limit must be a positive number' });
        updates.shareDownloadLimit = parsed;
    }

    // Reset download counter if requested
    if (resetDownloads) {
        updates.shareDownloads = 0;
    }

    // Handle password
    if (clearPassword) {
        updates.sharePassword = null;
    } else if (sharePassword) {
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        updates.sharePassword = await bcrypt.hash(sharePassword, salt);
    }

    console.log('[updateShareSettings] applying updates:', Object.keys(updates));

    if (Object.keys(updates).length > 0) {
        await file.update(updates);
    }

    // Reload to return fresh state
    await file.reload();

    res.json({
        message: 'Share settings updated successfully',
        shareDownloadLimit: file.shareDownloadLimit,
        shareDownloads: file.shareDownloads,
        hasPassword: !!file.sharePassword,
    });
});

const getFileByShareToken = asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const tokenParam = req.params.shareToken || req.query.share || req.params.id;
    const fileIdParam = req.params.id;
    const { password } = req.query;

    if (!tokenParam) return res.status(400).json({ message: 'Share token required' });

    const file = await findSharedFileByToken(tokenParam, fileIdParam);
    if (!file) return res.status(404).json({ message: 'Invalid share token' });

    const currentUserId = getUserId(req);
    const isOwner = !!(currentUserId && file.userId === currentUserId);

    if (!isOwner) {
        if (file.shareViewLimit && file.shareViews >= file.shareViewLimit) return res.status(410).json({ message: 'Share link view limit reached' });

        if (file.sharePassword) {
            if (!password) return res.status(401).json({ message: 'Password required', requiresPassword: true });
            const bcrypt = require('bcrypt');
            const isMatch = await bcrypt.compare(password, file.sharePassword);
            if (!isMatch) return res.status(401).json({ message: 'Invalid password', requiresPassword: true });
        }

        await file.update({ shareViews: (file.shareViews || 0) + 1 });
    }

    const downloadLimitReached = !isOwner && !!(file.shareDownloadLimit && file.shareDownloads >= file.shareDownloadLimit);

    const safeData = {
        id: file.id,
        userId: file.userId,
        filename: file.filename,
        size: file.size,
        category: file.category,
        fileType: file.fileType,
        createdAt: file.createdAt,
        isShared: true,
        shareToken: file.shareToken,
        shareExpiresAt: file.shareExpiresAt,
        shareViewLimit: file.shareViewLimit,
        shareDownloadLimit: file.shareDownloadLimit,
        shareDownloads: file.shareDownloads,
        downloadLimitReached,
        hasPassword: !!file.sharePassword,
        isOwner,
    };

    res.json(safeData);
});

const downloadFileByShareToken = asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const tokenParam = req.params.shareToken || req.query.share;
    const fileIdParam = req.params.id;
    const { password } = req.query;

    if (!tokenParam) return res.status(400).json({ message: 'Share token required' });
    
    const file = await findSharedFileByToken(tokenParam, fileIdParam);
    if (!file) return res.status(404).json({ message: 'Invalid share token' });

    const currentUserId = getUserId(req);
    const isOwner = !!(currentUserId && file.userId === currentUserId);

    if (!isOwner) {
        if (file.shareExpiresAt && new Date() > new Date(file.shareExpiresAt)) return res.status(410).json({ message: 'Share link has expired' });
        if (file.shareDownloadLimit && file.shareDownloads >= file.shareDownloadLimit) return res.status(410).json({ message: 'Share link download limit reached. No more downloads are allowed.' });

        if (file.sharePassword) {
            if (!password) return res.status(401).json({ message: 'Password required', requiresPassword: true });
            const bcrypt = require('bcrypt');
            const isMatch = await bcrypt.compare(password, file.sharePassword);
            if (!isMatch) return res.status(401).json({ message: 'Invalid password', requiresPassword: true });
        }
    }

    // Only count actual download button clicks (dl=1 or download=true), NOT inline preview/streaming
    const isActualDownload = req.query && (req.query.dl === '1' || req.query.download === 'true');

    if (isActualDownload && !isOwner) {
        // Re-check limit right before incrementing to prevent race where count was at limit
        if (file.shareDownloadLimit && file.shareDownloads >= file.shareDownloadLimit) {
            return res.status(410).json({ message: 'Share link download limit reached. No more downloads are allowed.' });
        }
        await file.update({ shareDownloads: (file.shareDownloads || 0) + 1 });
    }

    const mimeType = getMimeTypeFromExtension(file.filename) || file.fileType || 'application/octet-stream';
    const filename = file.filename || 'download';
    const safeFilename = filename.replace(/[\r\n"]/g, '').replace(/"/g, "'");

    try {
        let proxyUrl = file.fileUrl;
        if (!proxyUrl) return res.status(404).json({ message: 'Storage URL missing' });

        if (proxyUrl && !proxyUrl.startsWith('http')) {
            const localPath = path.resolve(__dirname, '..', proxyUrl);
            if (fs.existsSync(localPath)) {
                if (file.sha256Hash) {
                    const currentHash = await calculateFileHash(localPath);
                    if (currentHash !== file.sha256Hash) {
                        const AuditLog = require('../models/AuditLog');
                        await AuditLog.create({ userId: null, email: 'anonymous', action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'File tampering detected via share', fileId: file.id } });
                        return res.status(400).json({ message: 'File is corrupted or tampered. Download blocked.' });
                    }
                }
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Content-Type', mimeType);
                const wantAttachment = req.query && (req.query.dl === '1' || req.query.download === 'true');
                res.setHeader('Content-Disposition', `${wantAttachment ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
                const stat = fs.statSync(localPath);
                res.setHeader('Content-Length', stat.size);
                fs.createReadStream(localPath).pipe(res);
                return;
            } else {
                return res.status(404).json({ message: 'File not found on disk' });
            }
        }

        let publicId = null;
        let isCloudinary = false;
        const generateSignedCloudinaryUrl = (resourceType) => cloudinary.url(publicId, { resource_type: resourceType, secure: true, sign_url: true });

        if (proxyUrl.includes('cloudinary.com')) {
            const parsedId = extractCloudinaryPublicId(proxyUrl);
            if (parsedId && parsedId.publicId) { isCloudinary = true; publicId = parsedId.publicId; }
        }

        let remoteRes = null;
        try { remoteRes = await followRedirects(proxyUrl, 5, 60000); }
        catch(err) { return res.status(504).json({ message: err.message || 'Storage request failed' }); }

        if (isCloudinary && publicId && remoteRes.statusCode !== 200) {
            remoteRes.destroy?.();
            for (let type of ['auto', 'raw', 'image', 'video']) {
                try {
                    const signedRes = await followRedirects(generateSignedCloudinaryUrl(type), 5, 60000);
                    if (signedRes.statusCode === 200) { remoteRes = signedRes; break; }
                    signedRes.destroy?.();
                } catch (e) {}
            }
        }

        if (remoteRes.statusCode !== 200) return res.status(remoteRes.statusCode).end();

        res.setHeader('Content-Type', mimeType);
        const wantAttachment2 = req.query && (req.query.dl === '1' || req.query.download === 'true');
        res.setHeader('Content-Disposition', `${wantAttachment2 ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        if (remoteRes.headers['content-length']) res.setHeader('Content-Length', remoteRes.headers['content-length']);
        remoteRes.pipe(res);
        remoteRes.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
    } catch (err) {
        console.error('[Download Share] Error retrieving file:', err);
        res.status(500).json({ message: 'Failed to retrieve file from storage', error: err.message });
    }
});

// ── Trash / Soft-delete helpers ────────────────────────────────────────────

const getTrash = asyncHandler(async (req, res) => {
    const files = await File.findAll({ where: { userId: getUserId(req), isDeleted: true }, order: [['deletedAt', 'DESC']] });
    res.json({ items: files, total: files.length });
});

const restoreFile = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: getUserId(req), email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Restore unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }
    await file.update({ isDeleted: false, deletedAt: null });

    try {
        const event = await addEvent({ type: 'file-restored', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: file.filename });
        emitAdminEvent('file-restored', event);
        await updateDailyStorage();
    } catch (e) {}

    res.json({ message: 'File restored', file });
});

const permanentDeleteFile = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({ userId: getUserId(req), email: req.user.email, action: 'UNAUTHORIZED_ACCESS', result: 'FAILURE', ipAddress: req.ip, userAgent: req.get('User-Agent'), details: { reason: 'Permanent delete unauthorized', fileId: file.id } });
        return res.status(403).json({ message: 'Forbidden' });
    }

    const fileId = file.id;
    const fileName = file.filename;

    if (file.fileUrl && file.fileUrl.includes('cloudinary.com')) {
        try {
            const parsedId = extractCloudinaryPublicId(file.fileUrl);
            if (parsedId && parsedId.publicId) {
                const resourceType = file.category === 'videos' ? 'video' : (parsedId.resourceType || 'image');
                await cloudinary.uploader.destroy(parsedId.publicId, { resource_type: resourceType });
            }
        } catch (err) { console.error('[Trash] Cloudinary delete error (continuing):', err.message); }
    }

    if (file.category === 'documents' && file.fileUrl && !file.fileUrl.startsWith('http')) {
        try {
            const localPath = path.resolve(__dirname, '..', file.fileUrl);
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } catch (err) { console.error('[Trash] Local file delete error (continuing):', err.message); }
    }

    await file.destroy();

    try {
        const Activity = require('../models/Activity');
        await Activity.destroy({ where: { fileName } });
    } catch (err) { console.warn('[Trash] Activity log cleanup failed (non-blocking):', err.message); }

    await updateDailyStorage();

    safeEmit('fileDeleted', fileId);
    safeEmit('trashUpdated', fileId);
    safeEmit('storageUpdated', {});
    safeEmit('dashboardUpdated', {});

    try {
        const event = await addEvent({ type: 'file-permanently-deleted', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName });
        emitAdminEvent('file-permanently-deleted', event);
    } catch (e) {}

    res.json({ message: 'File permanently deleted', fileId });
});

const autoCleanupTrash = async () => {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const expiredFiles = await File.findAll({ where: { isDeleted: true, deletedAt: { [Op.lte]: cutoff } } });

        for (const file of expiredFiles) {
            if (file.fileUrl && file.fileUrl.includes('cloudinary.com')) {
                try {
                    const parsedId = extractCloudinaryPublicId(file.fileUrl);
                    if (parsedId && parsedId.publicId) {
                        await cloudinary.uploader.destroy(parsedId.publicId, { resource_type: parsedId.resourceType || 'auto' });
                    }
                } catch (e) {}
            }
            await file.destroy();
            await updateDailyStorage();
            console.log(`[Trash Cleanup] Permanently deleted file ${file.id} (expired after 30 days)`);
        }

        if (expiredFiles.length > 0) console.log(`[Trash Cleanup] Cleaned up ${expiredFiles.length} expired file(s).`);
    } catch (err) {
        console.error('[Trash Cleanup] Error during auto-cleanup:', err.message);
    }
};

const startAutoCleanup = () => {
    autoCleanupTrash();
    setInterval(autoCleanupTrash, 24 * 60 * 60 * 1000);
};

module.exports.startAutoCleanup = startAutoCleanup;

const mergeChunksStreaming = (tempDir, totalChunks, finalPath) => {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(finalPath);
        let currentChunk = 0;
        const pipeNextChunk = () => {
            if (currentChunk >= totalChunks) { writeStream.end(); return; }
            const chunkPath = path.join(tempDir, `chunk-${currentChunk}`);
            const readStream = fs.createReadStream(chunkPath);
            readStream.on('error', (err) => { writeStream.destroy(); reject(err); });
            readStream.on('end', () => { try { fs.unlinkSync(chunkPath); } catch (e) {} currentChunk++; pipeNextChunk(); });
            readStream.pipe(writeStream, { end: false });
        };
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        pipeNextChunk();
    });
};

const chunkUploadHandler = asyncHandler(async (req, res) => {
    const requestStart = Date.now();
    const { chunkIndex, totalChunks, fileId, filename } = req.body;
    const category = normalizeCategory(req.body.category);

    if (!req.file) return res.status(400).json({ message: 'No chunk file uploaded' });
    if (!category) return res.status(400).json({ message: `Invalid or missing category: "${req.body.category}". Must be images, videos, or documents.` });

    const tempDir = path.join(__dirname, '../uploads/temp-chunks', fileId);
    fs.mkdirSync(tempDir, { recursive: true });
    const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
    // Use copy + unlink instead of rename to avoid EBUSY errors on Windows
    try { fs.copyFileSync(req.file.path, chunkPath); } catch (e) { throw e; }
    try { fs.unlinkSync(req.file.path); } catch (e) { /* non-critical */ }

    const uploadedChunks = fs.readdirSync(tempDir);
    if (uploadedChunks.length === parseInt(totalChunks, 10)) {
        const mergedDir = category === 'documents'
            ? path.join(__dirname, '../uploads/documents')
            : path.join(__dirname, '../uploads/temp-merged');
        fs.mkdirSync(mergedDir, { recursive: true });

        const ext = filename.split('.').pop().toLowerCase();
        const finalName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const finalPath = path.join(mergedDir, finalName);

        try {
            await mergeChunksStreaming(tempDir, parseInt(totalChunks, 10), finalPath);
        } catch (err) {
            try { fs.rmdirSync(tempDir, { recursive: true }); } catch (e) {}
            return res.status(500).json({ message: 'File merge failed', error: err.message });
        }

        if (!fs.existsSync(finalPath)) {
            try { fs.rmdirSync(tempDir, { recursive: true }); } catch (e) {}
            return res.status(500).json({ message: 'Merge failed: merged file not found' });
        }

        const size = fs.statSync(finalPath).size;
        const shouldHash = category !== 'videos';
        const hashPromise = shouldHash ? calculateFileHash(finalPath).catch(() => '') : Promise.resolve('');

        try { fs.rmdirSync(tempDir, { recursive: true }); } catch (e) {}

    if (category === 'documents') {
            const backendDir = path.resolve(__dirname, '..');
            const fileUrl = path.relative(backendDir, finalPath).replace(/\\/g, '/');
            const newFile = await File.create({
                filename,
                fileUrl,
                fileType: getMimeTypeFromExtension(filename),
                category,
                size,
                userId: getUserId(req),
                sha256Hash: ''
            });
            safeEmit('fileUploaded', newFile);
            res.status(201).json(newFile);

            (async () => {
                try {
                    const sha256Hash = await hashPromise;
                    if (sha256Hash) await File.update({ sha256Hash }, { where: { id: newFile.id } });
                    const event = await addEvent({ type: 'file-uploaded', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: newFile.filename });
                    emitAdminEvent('file-uploaded', event);
                    await updateDailyStorage();
                } catch (e) {}
            })();
            return;
    } else {
            // Store locally for speed and reliability
            const categoryDir = path.join(__dirname, '../uploads', category);
            fs.mkdirSync(categoryDir, { recursive: true });
            const localFinalPath = path.join(categoryDir, finalName);
            try { fs.renameSync(finalPath, localFinalPath); } catch (e) {
                // If rename across devices fails, copy and delete
                fs.copyFileSync(finalPath, localFinalPath);
                fs.unlinkSync(finalPath);
            }
            const backendDir = path.resolve(__dirname, '..');
            const fileUrl = path.relative(backendDir, localFinalPath).replace(/\\/g, '/');

            const newFile = await File.create({
                filename,
                fileUrl,
                fileType: getMimeTypeFromExtension(filename),
                category,
                size,
                userId: getUserId(req),
                sha256Hash: ''
            });
            safeEmit('fileUploaded', newFile);
            res.status(201).json(newFile);

            (async () => {
                try {
                    const sha256Hash = await hashPromise;
                    if (sha256Hash) await File.update({ sha256Hash }, { where: { id: newFile.id } });
                    const event = await addEvent({ type: 'file-uploaded', userName: req.user.name, email: req.user.email, timestamp: new Date().toISOString(), fileName: newFile.filename });
                    emitAdminEvent('file-uploaded', event);
                    await updateDailyStorage();
                } catch (e) {}
            })();
            return;
    }
    } else {
        res.status(200).json({ message: `Chunk ${chunkIndex} received` });
    }
});

const revokeShareToken = asyncHandler(async (req, res) => {
    const file = await File.findByPk(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.userId !== getUserId(req)) return res.status(403).json({ message: 'Forbidden' });
    await file.update({
        shareToken: null,
        isShared: false,
        shareExpiresAt: null,
        sharePassword: null,
        shareViewLimit: null,
        shareDownloadLimit: null,
    });
    res.json({ message: 'Share link revoked successfully.' });
});

module.exports = {
    uploadFileByCategory,
    getHistory,
    renameFile,
    deleteFile,
    getShareLink,
    downloadFile,
    previewFile,
    getDashboardStats,
    getFileById,
    generateShareToken,
    revokeShareToken,
    updateShareSettings,
    getFileByShareToken,
    downloadFileByShareToken,
    getTrash,
    restoreFile,
    permanentDeleteFile,
    chunkUploadHandler,
};
