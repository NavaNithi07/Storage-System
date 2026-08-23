# VIBNA Storage 🗄️

A full-stack cloud file storage platform built with the MERN stack (PostgreSQL edition). Upload, organize, preview, and share files securely — with Google Sign-In, real-time notifications, and an admin dashboard.

---

## Features

### User Features
- 📁 **File Management** — Upload, rename, delete, restore, and favorite files
- 👁️ **In-Browser Previews** — PDF, DOCX, XLSX, images, and videos without downloading
- 🔗 **File Sharing** — Generate shareable links with expiry
- 📊 **Dashboard** — Storage usage charts and recent activity
- 🗑️ **Trash** — Soft delete with restore capability
- ⭐ **Favorites** — Mark and filter favorite files
- 📜 **Activity History** — Full upload/download/share history
- 🔒 **Authentication** — Email/password + Google Sign-In
- ✉️ **Email Verification** — Verified account system
- ⚙️ **Settings** — Profile, password, and account management

### Admin Features
- 👥 **User Management** — View, search, and manage all users
- 📈 **Platform Statistics** — Storage, uploads, and user metrics
- 🔍 **Audit Logs** — Full audit trail of admin actions
- 🛡️ **Role Management** — Promote/demote user roles

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion, MUI |
| **Backend** | Node.js, Express 5 |
| **Database** | PostgreSQL (Neon Cloud), Sequelize ORM |
| **File Storage** | Cloudinary |
| **Authentication** | JWT + Firebase (Google Sign-In) |
| **Real-time** | Socket.IO |
| **Email** | Nodemailer |
| **Deployment** | Vercel (frontend) + Render/Railway (backend) |

---

## Project Structure

```
VIBNA-Storage/
├── backend/                # Express REST API
│   ├── config/             # DB, Cloudinary, Firebase config
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth, rate limit, validation
│   ├── models/             # Sequelize models
│   ├── routes/             # API route definitions
│   ├── utils/              # Helpers: mailer, socket, logger
│   ├── .env.example        # Environment variable template
│   ├── package.json
│   ├── README.md
│   └── server.js           # App entry point
│
├── frontend/               # React + Vite SPA
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React context (auth, files, toast)
│   │   ├── pages/          # Route page components
│   │   └── services/       # API client (axios)
│   ├── .env.example        # Environment variable template
│   ├── package.json
│   ├── README.md
│   └── vite.config.js
│
├── docs/                   # Project documentation & notes
├── .gitignore
└── README.md               # This file
```

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A [Neon](https://neon.tech) PostgreSQL database
- A [Cloudinary](https://cloudinary.com) account
- A [Firebase](https://firebase.google.com) project with Google Auth enabled

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-username/vibna-storage.git
cd vibna-storage
```

### 2. Setup the Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Neon DB, Cloudinary, and Firebase credentials
npm run dev
```

Backend runs on: `http://localhost:5000`

### 3. Setup the Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL=http://localhost:5000/api
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FRONTEND_URL` | Frontend URL (for CORS) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API URL |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

See `backend/.env.example` and `frontend/.env.example` for complete templates.

---

## Deployment

### Frontend → Vercel

1. Import the repo in [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Set **Build Command**: `npm run build`
4. Set **Output Directory**: `dist`
5. Add all `frontend/.env.example` variables
6. Set `VITE_API_BASE_URL` → your Render backend URL

### Backend → Render / Railway

1. Create a new **Web Service** from your GitHub repo
2. Set **Root Directory** to `backend`
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add all `backend/.env.example` variables
6. Set `FRONTEND_URL` → your Vercel deployment URL

> On first start, Sequelize auto-creates all database tables and seeds the admin user (`admin@gmail.com` / `789654`). Change the admin password immediately after deployment.

---

## API Overview

Base URL: `https://your-backend.onrender.com/api`

- **Auth**: `/api/auth/*` — register, login, Google, logout, refresh, verify
- **Files**: `/api/files/*` — upload, list, preview, download, share, trash
- **Admin**: `/api/admin/*` — users, stats, audit logs

See [backend/README.md](./backend/README.md) for full API reference.

---

## License

MIT
