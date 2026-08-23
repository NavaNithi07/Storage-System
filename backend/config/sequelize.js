const { Sequelize } = require('sequelize');

// ─────────────────────────────────────────────────────────────────────────────
// Sequelize PostgreSQL Configuration
//
// Priority order:
//   1. DATABASE_URL  — Neon/cloud connection string (production + local dev)
//   2. POSTGRES_URI  — Legacy fallback
//   3. Local defaults — for development without a cloud DB
//
// SSL is always enabled for cloud URLs.
// Set POSTGRES_SSL=false explicitly to disable for local dev without SSL.
// ─────────────────────────────────────────────────────────────────────────────

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URI;

// Detect cloud/Neon URL — these always need SSL
const isCloudUrl = databaseUrl && (
  databaseUrl.includes('neon.tech') ||
  databaseUrl.includes('supabase') ||
  databaseUrl.includes('render.com') ||
  databaseUrl.includes('railway.app') ||
  databaseUrl.includes('amazonaws.com')
);

// SSL: force-enabled for cloud URLs; can be disabled locally via POSTGRES_SSL=false
const sslEnabled = isCloudUrl || process.env.POSTGRES_SSL === 'true';

let sequelize;

if (databaseUrl) {
  // Strip channel_binding parameter — not supported by node-postgres < 8.12
  const cleanUrl = databaseUrl.replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?$/, '');

  sequelize = new Sequelize(cleanUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: sslEnabled
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  });
} else {
  // Local fallback without SSL
  const host     = process.env.POSTGRES_HOST || 'localhost';
  const port     = process.env.POSTGRES_PORT || 5432;
  const user     = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const database = process.env.POSTGRES_DB || 'vibna';

  sequelize = new Sequelize(database, user, password, {
    host,
    port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {},
  });
}

module.exports = sequelize;
