const StorageHistory = require('../models/StorageHistory');
const File = require('../models/File');
const sequelize = require('../config/sequelize');

const updateDailyStorage = async () => {
    try {
        const d = new Date();
        const dateStr = d.toISOString().split('T')[0];
        
        const totalFiles = await File.count({ where: { isDeleted: false } });
        
        const storageResult = await sequelize.query(
            `SELECT COALESCE(SUM(size), 0) as "total" FROM files WHERE "isDeleted" = false`,
            { type: sequelize.QueryTypes.SELECT }
        );
        const storageUsed = parseInt(storageResult[0]?.total) || 0;
        const totalPlatformStorage = 5 * 1024 * 1024 * 1024; // 5 GB
        const storageRemaining = Math.max(0, totalPlatformStorage - storageUsed);

        const existingRecord = await StorageHistory.findOne({ where: { date: dateStr } });
        if (existingRecord) {
            await existingRecord.update({ storageUsed, storageRemaining, totalFiles });
        } else {
            await StorageHistory.create({ date: dateStr, storageUsed, storageRemaining, totalFiles });
        }
    } catch (err) {
        console.error('Error updating daily storage history:', err);
    }
};

module.exports = { updateDailyStorage };
