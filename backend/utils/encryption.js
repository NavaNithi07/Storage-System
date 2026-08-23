const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.FILE_ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES

const encrypt = (text) => {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption error:', e.message);
        return text;
    }
};

const decrypt = (text) => {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        // If it doesn't have an IV prefix, assume it's unencrypted legacy data
        if (textParts.length !== 2) return text;
        
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // Fallback for legacy data if decryption fails
        return text;
    }
};

module.exports = { encrypt, decrypt };
