# VIBNA Storage — Frontend

React + Vite frontend for the VIBNA Storage application. Provides the user dashboard, file management UI, admin panel, Google Sign-In, and real-time file previews.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 8** | Build tool & dev server |
| **React Router v7** | Client-side routing |
| **Axios** | HTTP client for API calls |
| **Firebase SDK** | Google Sign-In (client-side) |
| **Socket.IO Client** | Real-time notifications |
| **Tailwind CSS v4** | Utility-first styling |
| **Framer Motion** | Animations |
| **MUI (Material UI)** | UI component library |
| **Recharts** | Dashboard charts |
| **pdf.js / docx-preview** | In-browser file previews |
| **xlsx** | Spreadsheet preview |
| **Lucide React** | Icons |

---

## Project Structure

```
frontend/
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images, fonts, static files
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.jsx  # Authenticated app shell
│   │   │   └── Sidebar.jsx          # Navigation sidebar
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   └── Input.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── GoogleAccountSignInModal.jsx
│   │   ├── HistoryItem.jsx
│   │   ├── Layout.jsx
│   │   ├── ScrollRestoration.jsx
│   │   ├── ShareModal.jsx
│   │   ├── Sidebar.jsx
│   │   └── UploadContainer.jsx
│   ├── context/
│   │   ├── AuthContext.jsx         # Auth context definition
│   │   ├── AuthContextProvider.jsx # Auth state + API calls
│   │   ├── FileContext.jsx         # File list state
│   │   ├── ToastContext.jsx        # Toast notification system
│   │   └── authUtils.js            # localStorage helpers
│   ├── pages/
│   │   ├── AdminDashboard.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DocumentViewer.jsx      # File preview page
│   │   ├── GoogleAccountCreation.jsx
│   │   ├── History.jsx
│   │   ├── Login.jsx
│   │   ├── MyFiles.jsx
│   │   ├── Register.jsx
│   │   ├── Settings.jsx
│   │   ├── Trash.jsx
│   │   └── VerifyEmail.jsx
│   ├── services/
│   │   ├── api.js                  # Axios instance + interceptors
│   │   └── firebase.js             # Firebase service export
│   ├── App.jsx                     # Routes + auth guards
│   ├── App.css
│   ├── firebase.js                 # Firebase app initialization
│   ├── index.css
│   └── main.jsx                    # React entry point
├── .env                        # Environment variables (DO NOT COMMIT)
├── .env.example                # Environment variable template
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## Prerequisites

- Node.js >= 18
- A running VIBNA Storage backend (see `../backend/README.md`)
- A [Firebase](https://firebase.google.com) project with Google Authentication enabled

---

## Installation

```bash
cd frontend
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
| `VITE_API_BASE_URL` | **Yes** | Backend API URL (e.g. `http://localhost:5000/api`) |
| `VITE_APP_URL` | No | Frontend app URL |
| `VITE_FIREBASE_API_KEY` | **Yes** | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Yes** | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Yes** | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | **Yes** | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Firebase Analytics measurement ID |

---

## Running Locally

```bash
# Start dev server (with HMR)
npm run dev
```

Frontend starts on `http://localhost:5173`.

> Make sure the backend is running on `http://localhost:5000` (or update `VITE_API_BASE_URL` in `.env`).

---

## Building for Production

```bash
npm run build
```

Output is placed in `dist/`. Deploy this directory to Vercel or any static host.

---

## Deployment (Vercel)

1. Push code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set **Root Directory** to `frontend`
4. Set **Build Command**: `npm run build`
5. Set **Output Directory**: `dist`
6. Add all environment variables from `.env.example`
7. Set `VITE_API_BASE_URL` to your Render/Railway backend URL
8. Deploy

---

## Routes

| Route | Page | Auth Required |
|---|---|---|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/create-google-account` | Google account setup | Public |
| `/verify-email` | Email verification | Public |
| `/dashboard` | User dashboard | ✓ User |
| `/my-files` | All files | ✓ User |
| `/images` | Image files | ✓ User |
| `/videos` | Video files | ✓ User |
| `/documents` | Document files | ✓ User |
| `/history` | Activity history | ✓ User |
| `/favorites` | Favorited files | ✓ User |
| `/trash` | Deleted files | ✓ User |
| `/settings` | User settings | ✓ User |
| `/viewer/:id` | File preview | Public/Auth |
| `/admin/dashboard` | Admin panel | ✓ Admin |
