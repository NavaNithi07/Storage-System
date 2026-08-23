const Activity = require('../models/Activity');
const { getIO } = require('./socket');

const addEvent = async ({ type, userName, email, fileName = null, metadata = {}, ipAddress = 'unknown', device = 'unknown', timestamp = new Date() }) => {
    try {
        const payload = {
            type,
            userName,
            email,
            fileName,
            metadata,
            ipAddress,
            device,
            timestamp
        };

        const doc = await Activity.create(payload);
        const eventData = {
            id: doc.id,
            type: doc.type,
            userName: doc.userName,
            email: doc.email,
            fileName: doc.fileName,
            metadata: doc.metadata,
            timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : new Date(doc.timestamp).toISOString(),
        };

        try {
            const io = getIO();
            io.emit('admin-update', { type, event: eventData });
            io.emit('activity', eventData);
            io.emit('stats-update');
        } catch (socketErr) {
            console.warn('[Activity Logger] Socket emit skipped:', socketErr.message);
        }

        return eventData;
    } catch (err) {
        console.error('[Activity Logger] Error logging event:', err.message);
    }
};

const emitAdminEvent = (type, event) => {
    try {
        const io = getIO();
        io.emit('admin-update', { type, event });
    } catch(e) {}
};

module.exports = { addEvent, logEvent: addEvent, emitAdminEvent };
