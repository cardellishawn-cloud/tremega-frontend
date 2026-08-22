# Tremega Backend Deployment Guide

## Railway Deployment

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub or email

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select the `tremega-backend` repository

### Step 3: Configure Environment Variables
Add these in Railway dashboard → Variables:

```
PORT=3000
SUPABASE_URL=https://uyuzatzukqumvyrjqlci.supabase.co
SUPABASE_ANON_KEY=sb_publishable_5FQRQVt8BtwWoJtiQLB_wg_hyR-fL7h
SUPABASE_SERVICE_ROLE_KEY=sb_secret_IwXhhLrcN-leBzjGJ2aI4g_kt-_QaHN
JWT_SECRET=a7f8d9c2e1b4a5f9d8c7b6a5e4d3c2b1
```

### Step 4: Deploy
1. Railway auto-detects Node.js
2. It will run `npm install` and `npm start`
3. Wait for deployment to complete
4. Copy the generated URL (e.g., https://tremega-backend-prod.railway.app)

### Step 5: Verify
```bash
curl https://your-backend-url.railway.app/api/bids \
  -H "Authorization: Bearer <token>"
```

---

## Vercel Frontend Deployment

### Step 1: Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub

### Step 2: Import Project
1. Click "Add New..." → "Project"
2. Import `tremega-frontend` repository
3. Vercel auto-detects Vite

### Step 3: Configure Environment Variables
Add in Vercel dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://your-backend-url.railway.app
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Copy the generated URL (e.g., https://tremega-frontend.vercel.app)

### Step 5: Test
1. Open the frontend URL
2. Login with: test@tremega.com / password123
3. Verify dashboard and bids load

---

## Local Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

- `GET /api/bids` - List all bids
- `POST /api/bids` - Create bid
- `GET /api/bids/:id` - Get bid details
- `PUT /api/bids/:id` - Update bid
- `DELETE /api/bids/:id` - Delete bid
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
