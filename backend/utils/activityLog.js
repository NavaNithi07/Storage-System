const Activity = require('../models/Activity');

const MAX_EVENTS = 120;

const addEvent = async (event) => {
    const payload = {
        ...event,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    };

    const doc = await Activity.create(payload);
    return {
        id: doc.id,
        type: doc.type,
        userName: doc.userName,
        email: doc.email,
        fileName: doc.fileName,
        metadata: doc.metadata,
        timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : new Date(doc.timestamp).toISOString(),
    };
};

const getRecentEvents = async () => {
    const events = await Activity.findAll({
        order: [['timestamp', 'DESC']],
        limit: MAX_EVENTS,
    });
    return events.map((event) => ({
        id: event.id,
        type: event.type,
        userName: event.userName,
        email: event.email,
        fileName: event.fileName,
        metadata: event.metadata,
        timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : new Date(event.timestamp).toISOString(),
    }));
};

module.exports = { addEvent, getRecentEvents };