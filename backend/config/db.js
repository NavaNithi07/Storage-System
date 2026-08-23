const sequelize = require('./sequelize');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// Seed the default admin account on first start
// ─────────────────────────────────────────────────────────────────────────────
const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@gmail.com';
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });
        if (!existingAdmin) {
            await User.create({
                name: 'Vibna Admin',
                email: adminEmail,
                password: '789654',
                role: 'admin',
                username: 'admin',
                isEmailVerified: true,
            });
            console.log('[DB] Admin user seeded successfully.');
        } else {
            if (existingAdmin.role !== 'admin') {
                await existingAdmin.update({ role: 'admin' });
                console.log('[DB] Updated existing user to admin role.');
            }
        }
    } catch (err) {
        console.error('[DB] Error seeding admin user:', err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Connect to PostgreSQL (Neon or local) with retry logic
// ─────────────────────────────────────────────────────────────────────────────
const connectDB = async () => {
    const connectWithRetry = async (retries = 3) => {
        try {
            console.log('[DB] Attempting to connect to PostgreSQL...');
            await sequelize.authenticate();
            console.log('[DB] PostgreSQL connected successfully.');

            // Sync models to PostgreSQL tables (creates tables if they don't exist)
            await sequelize.sync();
            console.log('[DB] PostgreSQL models synchronized.');

            // Seed admin user
            await seedAdmin();
        } catch (error) {
            console.error('[DB] PostgreSQL connection failed:', error.message);

            if (retries > 0) {
                console.log(`[DB] Retrying in 5 seconds... (${retries} attempt(s) remaining)`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                return connectWithRetry(retries - 1);
            } else {
                console.error('[DB] Could not connect to PostgreSQL. Check DATABASE_URL in .env');
                if (!process.env.VERCEL) {
                    process.exit(1);
                }
            }
        }
    };

    await connectWithRetry();
};

module.exports = connectDB;
