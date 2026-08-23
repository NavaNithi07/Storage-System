const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const sendVerificationEmail = async (email, name, token) => {
    const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendOrigin}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    
    // Always log to local debug file for testing/dev ease
    const logDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'sent-emails.log');
    const logEntry = `[${new Date().toISOString()}] Email: ${email} | Name: ${name} | Verification URL: ${verifyUrl}\n`;
    fs.appendFileSync(logFile, logEntry);
    
    console.log(`[Verification Mail] Target: ${email}`);
    console.log(`[Verification Mail] Link: ${verifyUrl}`);

    // If SMTP credentials are configured, try sending
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: `"VIBNA Storage" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Verify Your Email Address - VIBNA Storage',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #d4af37; border-radius: 10px; background-color: #111; color: #fff;">
                        <h2 style="color: #d4af37; border-bottom: 1px solid #d4af37; padding-bottom: 10px;">VIBNA STORAGE</h2>
                        <p>Hello ${name},</p>
                        <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verifyUrl}" style="background-color: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email</a>
                        </div>
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; color: #d4af37;">${verifyUrl}</p>
                        <hr style="border-color: #d4af37; margin: 20px 0;">
                        <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                    </div>
                `,
            });
            console.log('[Verification Mail] SMTP email sent successfully');
        } catch (err) {
            console.error('[Verification Mail] SMTP delivery failed:', err.message);
        }
    }
};

module.exports = { sendVerificationEmail };
