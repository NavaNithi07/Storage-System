const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const File = require('../models/File');
const Activity = require('../models/Activity');
const AuditLog = require('../models/AuditLog');

const backupDir = path.join(__dirname, '../../backups');

const createBackupDir = () => {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
};

const performBackup = async (type) => {
    console.log(`[Backup System] Starting ${type} backup...`);
    createBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
        const users = await User.findAll({ attributes: { exclude: ['password'] } });
        const files = await File.findAll();
        const activities = await Activity.findAll();
        const auditLogs = await AuditLog.findAll();

        const backupData = {
            timestamp,
            type,
            users,
            files,
            activities,
            auditLogs,
        };

        const filePath = path.join(backupDir, `postgres-backup-${type}-${timestamp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        console.log(`[Backup System] ${type} backup written to ${filePath}`);
    } catch (err) {
        console.error(`[Backup System] Backup failed:`, err.message);
    }
};

// Daily Backup at 2 AM
cron.schedule('0 2 * * *', () => {
    performBackup('daily');
});

// Weekly Backup at 3 AM on Sundays
cron.schedule('0 3 * * 0', () => {
    performBackup('weekly');
});

module.exports = { performBackup };
