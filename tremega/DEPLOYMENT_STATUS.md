# Tremega Deployment Status

## Current Status

### Backend (Ready for Railway)
- ✅ Node.js/Express backend
- ✅ All API endpoints working
- ✅ Authentication (JWT)
- ✅ Database (Supabase)
- ✅ .gitignore configured
- ✅ Ready to deploy

### Frontend (Ready for Vercel)
- ✅ React/Vite frontend
- ✅ All components working
- ✅ API integration configured
- ✅ Environment variable support added
- ✅ .gitignore configured
- ✅ Ready to deploy

---

## Deployment Instructions

### Part 1: Deploy Backend to Railway

1. **Go to https://railway.app** and sign up/login

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select the `tremega-backend` repository

3. **Add Environment Variables** (in Railway dashboard → Variables):
   ```
   PORT=3000
   SUPABASE_URL=https://uyuzatzukqumvyrjqlci.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_5FQRQVt8BtwWoJtiQLB_wg_hyR-fL7h
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_IwXhhLrcN-leBzjGJ2aI4g_kt-_QaHN
   JWT_SECRET=a7f8d9c2e1b4a5f9d8c7b6a5e4d3c2b1
   ```

4. **Deploy**
   - Railway auto-detects Node.js
   - Wait for deployment
   - Copy the URL (e.g., `https://tremega-backend-prod.railway.app`)

5. **Verify Backend**
   ```bash
   curl https://your-backend-url.railway.app/api/bids \
     -H "Authorization: Bearer <token>"
   ```

---

### Part 2: Deploy Frontend to Vercel

1. **Go to https://vercel.com** and sign up/login

2. **Import Project**
   - Click "Add New..." → "Project"
   - Import `tremega-frontend` repository
   - Vercel auto-detects Vite

3. **Add Environment Variable** (in Vercel dashboard → Settings → Environment Variables):
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build
   - Copy the URL (e.g., `https://tremega-frontend.vercel.app`)

5. **Test Frontend**
   - Open the frontend URL
   - Login: `test@tremega.com` / `password123`
   - Verify dashboard and bids load

---

## Test Credentials

| Field | Value |
|-------|-------|
| Email | `test@tremega.com` |
| Password | `password123` |
| Role | contractor |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bids` | List all bids |
| POST | `/api/bids` | Create bid |
| GET | `/api/bids/:id` | Get bid details |
| PUT | `/api/bids/:id` | Update bid |
| DELETE | `/api/bids/:id` | Delete bid |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

---

## Files Ready for Deployment

### Backend
- `server.js` - Main server file
- `routes/` - API routes (auth, bids, email)
- `lib/` - Utilities (supabase, email)
- `middleware/` - Auth middleware
- `package.json` - Dependencies

### Frontend
- `src/` - React source code
- `src/lib/api.ts` - API client (uses VITE_API_URL)
- `src/components/` - UI components
- `src/pages/` - Page components
- `package.json` - Dependencies

---

## Next Steps

1. **Push code to GitHub** (if not already done)
2. **Deploy backend to Railway** → Get backend URL
3. **Deploy frontend to Vercel** → Add backend URL as env var
4. **Test the live app** with test credentials
5. **Share URLs with Mike** for testing

---

## Notes

- The frontend is configured to use `VITE_API_URL` environment variable
- If not set, it defaults to `/api` (for local development with proxy)
- Both repos have `.gitignore` configured to exclude `node_modules` and `.env`
- The backend uses CommonJS (not TypeScript) as requested
