# VIBNA Storage — Application Context

This document provides a comprehensive technical overview of the VIBNA Storage application for developers, AI assistants, and onboarding engineers.

---

## Application Overview

VIBNA Storage is a cloud file storage platform similar to Google Drive. Users can upload files (stored on Cloudinary), manage them through a dashboard, preview them in-browser, and share them via public links. An admin can manage all users and view platform statistics.

---

## Architecture

```
┌───────────────────────────────────┐       ┌─────────────────────────────────┐
│         Frontend (Vercel)         │       │       Backend (Render/Railway)  │
│     React 19 + Vite + Tailwind    │◄─────►│     Node.js + Express 5        │
│                                   │ HTTPS │                                 │
│  Routes: /dashboard, /my-files,   │       │  REST API: /api/auth            │
│  /viewer/:id, /admin/dashboard    │       │            /api/files           │
│                                   │       │            /api/admin           │
└───────────────────────────────────┘       └────────────┬────────────────────┘
                                                         │
                 ┌───────────────────────────────────────┼──────────────────┐
                 │                                       │                  │
        ┌────────▼────────┐                   ┌──────────▼──────┐  ┌───────▼──────┐
        │  Neon PostgreSQL │                   │   Cloudinary    │  │   Firebase   │
        │  (via Sequelize) │                   │ (file storage)  │  │  (Google     │
        │                  │                   │                 │  │   Auth only) │
        └──────────────────┘                   └─────────────────┘  └──────────────┘
```

---

## Authentication Flow

### Email / Password
1. User submits email/username + password via `/login`
2. Backend verifies credentials against PostgreSQL (`User` model, bcrypt)
3. Backend issues `accessToken` (JWT, 7d expiry) + `refreshToken` (JWT, 30d)
4. Frontend stores both in `localStorage`
5. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
6. On 401 response, interceptor tries to refresh using `refreshToken` automatically

### Google Sign-In
1. Frontend: `signInWithPopup(auth, googleProvider)` via Firebase SDK
2. Firebase returns an `idToken` (a signed JWT)
3. Frontend sends `idToken` to `POST /api/auth/google`
4. Backend (`firebase-admin.js`) verifies the token:
   - **Fast path**: JWT decode check (instant, no network)
   - **Admin SDK path**: If service account configured, uses `verifyIdToken()`
   - **Fallback path**: Verifies against Google's public certificates
5. Backend finds or creates the user in PostgreSQL
6. Issues own JWT access/refresh token pair
7. If the email already exists as an email/password account, backend returns `ACCOUNT_LINK_REQUIRED` — user can confirm linking

---

## File Upload Flow

```
Frontend UploadContainer.jsx
    │
    ▼
POST /api/files/upload   (multipart/form-data)
    │
    ▼
Multer (multer-storage-cloudinary)
    │
    ▼
Cloudinary API   ──►  Returns: public_id, secure_url, resource_type
    │
    ▼
File record saved to PostgreSQL (File model)
    │
    ▼
StorageHistory updated (storage quota tracking)
    │
    ▼
Socket.IO event emitted: 'file:uploaded'  (real-time dashboard update)
```

---

## Database Models

### User
```
id            UUID (PK)
name          STRING
email         STRING (unique)
username      STRING (unique)
password      STRING (bcrypt hashed, nullable for Google-only users)
role          ENUM('user', 'admin')
mobile        STRING
isEmailVerified BOOLEAN
googleId      STRING (for Google-linked accounts)
avatar        STRING (URL)
storageUsed   BIGINT (bytes)
storageLimit  BIGINT (bytes, default 5GB)
createdAt     TIMESTAMP
updatedAt     TIMESTAMP
```

### File
```
id            UUID (PK)
userId        UUID (FK → User)
name          STRING
originalName  STRING
cloudinaryId  STRING (public_id)
url           STRING (secure_url)
mimeType      STRING
size          BIGINT (bytes)
category      ENUM('image', 'video', 'document', 'other')
isTrashed     BOOLEAN
isFavorite    BOOLEAN
shareToken    STRING (nullable, for shared links)
shareExpiry   TIMESTAMP (nullable)
createdAt     TIMESTAMP
updatedAt     TIMESTAMP
```

### Activity
```
id            UUID (PK)
userId        UUID (FK → User)
action        STRING (e.g. 'upload', 'download', 'share')
fileId        UUID (nullable)
metadata      JSONB
createdAt     TIMESTAMP
```

### AuditLog
```
id            UUID (PK)
adminId       UUID (FK → User)
action        STRING
targetUserId  UUID (nullable)
metadata      JSONB
createdAt     TIMESTAMP
```

### BlacklistedToken
```
id            UUID (PK)
token         STRING
expiresAt     TIMESTAMP
createdAt     TIMESTAMP
```

### StorageHistory
```
id            UUID (PK)
userId        UUID (FK → User)
storageUsed   BIGINT
recordedAt    TIMESTAMP
```

---

## Key Components

### Frontend

| Component | File | Purpose |
|---|---|---|
| `AuthContextProvider` | `context/AuthContextProvider.jsx` | Manages user auth state, login/logout/Google methods |
| `FileContext` | `context/FileContext.jsx` | Shared file list state across pages |
| `ToastContext` | `context/ToastContext.jsx` | Global toast notification system |
| `api.js` | `services/api.js` | Axios instance with JWT injection + auto-refresh interceptor |
| `DashboardLayout` | `components/layout/DashboardLayout.jsx` | Authenticated app shell with sidebar |
| `UploadContainer` | `components/UploadContainer.jsx` | Drag-and-drop file uploader |
| `ShareModal` | `components/ShareModal.jsx` | Share link generation UI |
| `DocumentViewer` | `pages/DocumentViewer.jsx` | In-browser file preview (PDF, DOCX, XLSX, images, video) |
| `AdminDashboard` | `pages/AdminDashboard.jsx` | Admin user/stats management panel |
| `ErrorBoundary` | `components/ErrorBoundary.jsx` | Top-level React error boundary |

### Backend

| File | Purpose |
|---|---|
| `server.js` | Express app, CORS, middleware, route registration, startup |
| `config/db.js` | PostgreSQL connection + admin seeding |
| `config/sequelize.js` | Sequelize instance with Neon SSL config |
| `config/cloudinary.js` | Cloudinary SDK with keep-alive agent |
| `config/firebase-admin.js` | Google token verification (3-tier: fast/SDK/certs) |
| `middleware/auth.js` | JWT verification middleware |
| `middleware/rateLimiter.js` | Route-level rate limiting |
| `utils/socket.js` | Socket.IO setup and event helpers |
| `utils/backupManager.js` | Scheduled DB backup CRON |
| `utils/activityLogger.js` | Records user activity to DB |
| `utils/storageTracker.js` | Updates user storage usage |
| `utils/mailer.js` | Nodemailer email sending |

---

## Route Guards (Frontend)

```
PrivateRoute  — requires authenticated user (non-admin only)
AdminRoute    — requires user.role === 'admin'
PublicRoute   — redirects authenticated users to /dashboard
```

---

## Real-time (Socket.IO)

- Backend initializes Socket.IO in `utils/socket.js`
- Events emitted by `fileController` after upload/delete/restore operations
- Frontend listens in `Dashboard.jsx` and `MyFiles.jsx` to refresh file lists without polling

---

## File Categories

Defined in `utils/fileCategoryConfig.js`:

| Category | MIME Types / Extensions |
|---|---|
| `image` | jpeg, png, gif, webp, svg, bmp, ico |
| `video` | mp4, avi, mov, mkv, webm, flv |
| `document` | pdf, docx, xlsx, pptx, txt, csv, zip |
| `other` | Everything else |

---

## Security

| Concern | Implementation |
|---|---|
| Password storage | bcrypt (cost factor 10) |
| Auth tokens | JWT with short-lived access + long-lived refresh |
| Token revocation | `BlacklistedToken` table for logged-out tokens |
| Input sanitization | `middleware/validation.js` (xss-clean + custom sanitizer) |
| Rate limiting | `express-rate-limit` on auth endpoints |
| Security headers | `helmet` with COEP/CORP config |
| CORS | Strict origin whitelist via `FRONTEND_URL` env var |
| File uploads | Multer + Cloudinary (no local storage in production) |

---

## Deployment Environment Variables

### Backend must set in production:
- `DATABASE_URL` — Neon PostgreSQL connection string (with `sslmode=require`)
- `JWT_SECRET` — Strong random string (32+ chars)
- `CLOUDINARY_*` — All three Cloudinary variables
- `FRONTEND_URL` — Vercel deployment URL (for CORS)
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `NODE_ENV=production`

### Frontend must set in production (Vercel):
- `VITE_API_BASE_URL` — Render/Railway backend URL + `/api`
- All `VITE_FIREBASE_*` variables

---

## Known Limitations / Future Work

- File encryption (`utils/encryption.js`) is implemented but not yet wired to the upload flow
- `backupManager.js` creates a CRON job but backup destination is not yet configured for cloud
- `activityLog.js` and `activityLogger.js` are both present — consolidation opportunity
- The `socket.js` file in the backend root (`backend/socket.js`) appears to be an older version — the active one is `backend/utils/socket.js`
