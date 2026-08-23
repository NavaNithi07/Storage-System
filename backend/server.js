const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { sanitizeInputs } = require('./middleware/validation');

// Load env vars (explicit path so env works regardless of cwd)
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const helmet = require('helmet');
const useragent = require('express-useragent');

// ── Security Middlewares ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));

app.use(useragent.express());

// ── CORS — Environment-driven origin whitelist ────────────────────────────────
// In production: set FRONTEND_URL to your Vercel URL (e.g. https://vibna.vercel.app)
// In development: localhost origins are allowed automatically
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:4173',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Allow any localhost/127.0.0.1 port in development (Vite may pick any free port)
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocalhost) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
  maxAge: 3600,
};

app.use(cors(corsOptions));

// Pre-flight handler for Express v5 compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin || '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Access-Control-Max-Age', '3600');
      return res.sendStatus(200);
    }
  }
  next();
});

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100mb', strict: false }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Catch invalid JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err) {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ message: 'Invalid JSON body' });
    }
  }
  return next(err);
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} - body keys:`, req.body ? Object.keys(req.body) : 'none');
  next();
});

// ── Health Check Endpoint (for Render / uptime monitoring) ───────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(sanitizeInputs);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');

// ── Start Server ──────────────────────────────────────────────────────────────
const startServer = async () => {
    await connectDB();

    // Initialize Backup CRON
    require('./utils/backupManager');

    // Start file controller background tasks once DB is connected
    try {
      const fileController = require('./controllers/fileController');
      if (fileController && typeof fileController.startAutoCleanup === 'function') {
        fileController.startAutoCleanup();
        console.log('[Startup] File auto-cleanup scheduled');
      }
    } catch (e) {
      console.warn('[Startup] Failed to start file auto-cleanup:', e.message);
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Running on port ${PORT}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Initialize Socket.IO
    initSocket(server);

    server.timeout = 0;
    server.headersTimeout = 0;
};

startServer();
