# VIBNA Storage — Backend

Express/Node.js REST API for the VIBNA Storage application. Handles authentication, file management via Cloudinary, PostgreSQL data persistence, real-time notifications via Socket.IO, and Google Sign-In via Firebase Admin.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | REST API server |
| **PostgreSQL (Neon)** | Primary database |
| **Sequelize ORM** | PostgreSQL model/query layer |
| **Cloudinary** | File storage & streaming |
| **Firebase Admin SDK** | Google Sign-In token verification |
| **JWT** | Authentication tokens |
| **Socket.IO** | Real-time notifications |
| **Bcrypt** | Password hashing |
| **Nodemailer** | Email verification & notifications |
| **Helmet + CORS** | Security headers |

---

## Project Structure

```
backend/
├── config/
│   ├── cloudinary.js       # Cloudinary SDK configuration
│   ├── db.js               # PostgreSQL connection + admin seeding
│   ├── firebase-admin.js   # Firebase Admin token verification
│   └── sequelize.js        # Sequelize ORM instance
├── controllers/
│   ├── adminController.js  # Admin dashboard endpoints
│   ├── authController.js   # Auth: register, login, Google, logout
│   └── fileController.js   # File CRUD, upload, preview, share, trash
├── middleware/
│   ├── adminMiddleware.js  # Admin role guard
│   ├── auth.js             # JWT verification middleware
│   ├── rateLimiter.js      # Rate limiting
│   └── validation.js       # Input sanitization
├── models/
│   ├── Activity.js         # User activity log model
│   ├── AuditLog.js         # Admin audit log model
│   ├── BlacklistedToken.js # Revoked JWT tokens
│   ├── File.js             # File record model
│   ├── StorageHistory.js   # Storage usage history
│   └── User.js             # User account model
├── routes/
│   ├── adminRoutes.js      # /api/admin/*
│   ├── authRoutes.js       # /api/auth/*
│   └── fileRoutes.js       # /api/files/*
├── utils/
│   ├── activityLog.js      # Activity logging helper
│   ├── activityLogger.js   # Extended activity logger
│   ├── asyncHandler.js     # Async error wrapper
│   ├── backupManager.js    # Scheduled backup CRON
│   ├── encryption.js       # File encryption utilities
│   ├── fileCategoryConfig.js # File type categories
│   ├── hasher.js           # File hash utilities
│   ├── mailer.js           # Email sending
│   ├── socket.js           # Socket.IO initialization
│   └── storageTracker.js   # Storage quota tracking
├── .env                    # Environment variables (DO NOT COMMIT)
├── .env.example            # Environment variable template
├── package.json
└── server.js               # Express application entry point
```

---

## Prerequisites

- Node.js >= 18
- A [Neon PostgreSQL](https://neon.tech) account and database
- A [Cloudinary](https://cloudinary.com) account
- A [Firebase](https://firebase.google.com) project with Authentication enabled

---

## Installation

```bash
cd backend
npm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | **Yes** | Neon PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | JWT signing secret (min 32 chars) |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | **Yes** | Cloudinary API secret |
| `FRONTEND_URL` | **Yes** | Frontend URL for CORS (e.g. `https://vibna.vercel.app`) |
| `FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | No | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No | Firebase service account private key |

---

## Running Locally

```bash
# Development
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000`.

On first start, Sequelize will auto-create all tables and seed the admin account (`admin@gmail.com`).

---

## API Routes

### Authentication — `/api/auth`

| Method | Route | Description |
|---|---|---|
| POST | `/register` | Register with email/password |
| POST | `/login` | Login with email or username |
| POST | `/google` | Google Sign-In via Firebase ID token |
| POST | `/register-vibna` | Create Vibna account after Google login |
| POST | `/logout` | Logout and revoke tokens |
| POST | `/refresh` | Refresh JWT access token |
| POST | `/send-verification` | Send email verification code |
| POST | `/verify-email` | Verify email with code |
| GET | `/me` | Get current user profile |
| PUT | `/profile` | Update profile |
| PUT | `/change-password` | Change password |
| DELETE | `/account` | Delete account |

### Files — `/api/files`

| Method | Route | Description |
|---|---|---|
| GET | `/` | List user's files |
| POST | `/upload` | Upload file to Cloudinary |
| GET | `/:id` | Get file metadata |
| GET | `/:id/preview` | Stream file preview |
| GET | `/:id/download` | Download file |
| DELETE | `/:id` | Move file to trash |
| DELETE | `/:id/permanent` | Permanently delete file |
| POST | `/:id/restore` | Restore from trash |
| POST | `/:id/share` | Generate share link |
| GET | `/share/:token` | Access shared file |
| PUT | `/:id/favorite` | Toggle favorite |
| PUT | `/:id/rename` | Rename file |
| GET | `/trash` | List trashed files |
| GET | `/stats` | Storage statistics |

### Admin — `/api/admin`

| Method | Route | Description |
|---|---|---|
| GET | `/users` | List all users |
| GET | `/stats` | Platform statistics |
| GET | `/audit-logs` | Audit log entries |
| PUT | `/users/:id/role` | Change user role |
| DELETE | `/users/:id` | Delete user |

---

## Deployment (Render / Railway)

1. Push code to GitHub
2. Create a new **Web Service** on [Render](https://render.com) or [Railway](https://railway.app)
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add all environment variables from `.env.example`
6. Set `FRONTEND_URL` to your Vercel deployment URL
7. Deploy

---

## Default Admin Account

On first start, an admin account is seeded:

- **Email**: `admin@gmail.com`
- **Password**: `789654`

> ⚠️ Change the admin password immediately after first deployment.
