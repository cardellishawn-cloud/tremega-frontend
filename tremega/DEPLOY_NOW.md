# Tremega Deployment Guide

## Prerequisites

Before deploying, you need to:

1. **Create GitHub repositories** for backend and frontend
2. **Push the code** to GitHub
3. **Have accounts** on Railway and Vercel

---

## Step 1: Push Code to GitHub

### Backend Repository

```bash
cd C:\Users\carde\.openclaw\workspace\tremega\backend

# Add remote (replace with your GitHub username)
git remote add origin https://github.com/ShawnCardelli/tremega-backend.git

# Push to GitHub
git push -u origin master
```

### Frontend Repository

```bash
cd C:\Users\carde\.openclaw\workspace\tremega\frontend

# Add remote (replace with your GitHub username)
git remote add origin https://github.com/ShawnCardelli/tremega-frontend.git

# Push to GitHub
git push -u origin master
```

---

## Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your GitHub

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `ShawnCardelli/tremega-backend`
4. Click "Deploy Now"

### 2.3 Add Environment Variables
1. In Railway dashboard, go to your project
2. Click "Variables" tab
3. Add these variables:

| Key | Value |
|-----|-------|
| `PORT` | `3000` |
| `SUPABASE_URL` | `https://uyuzatzukqumvyrjqlci.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_5FQRQVt8BtwWoJtiQLB_wg_hyR-fL7h` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_IwXhhLrcN-leBzjGJ2aI4g_kt-_QaHN` |
| `JWT_SECRET` | `a7f8d9c2e1b4a5f9d8c7b6a5e4d3c2b1` |

### 2.4 Get Backend URL
1. Wait for deployment to complete (green checkmark)
2. Click "Settings" → "Domains"
3. Copy the generated URL (e.g., `https://tremega-backend-prod.up.railway.app`)

### 2.5 Test Backend
```bash
curl https://your-backend-url.up.railway.app/api/bids
# Should return 401 (needs auth token) - this means it's working!
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account
1. Go to https://vercel.com
2. Click "Sign Up" → "Continue with GitHub"
3. Authorize Vercel to access your GitHub

### 3.2 Import Project
1. Click "Add New..." → "Project"
2. Find `ShawnCardelli/tremega-frontend`
3. Click "Import"

### 3.3 Configure Project
1. **Framework Preset**: Vite (auto-detected)
2. **Root Directory**: `./` (leave as is)
3. **Build Command**: `npm run build` (auto-detected)
4. **Output Directory**: `dist` (auto-detected)

### 3.4 Add Environment Variable
1. In project settings, go to "Environment Variables"
2. Add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-backend-url.up.railway.app` |

**Important**: Replace `your-backend-url` with the actual Railway URL from Step 2.4

### 3.5 Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Copy the frontend URL (e.g., `https://tremega-frontend.vercel.app`)

---

## Step 4: Test the Live App

### 4.1 Open Frontend URL
1. Go to `https://tremega-frontend.vercel.app`
2. You should see the login page

### 4.2 Login
- **Email**: `test@tremega.com`
- **Password**: `password123`

### 4.3 Test Features
- ✅ Dashboard loads
- ✅ Bids list displays
- ✅ Create new bid
- ✅ View bid details
- ✅ Edit bid

---

## Step 5: Share with Mike

Send Mike these details:

```
🚀 Tremega App is Live!

Frontend: https://tremega-frontend.vercel.app
Login: test@tremega.com
Password: password123

You can:
- View the dashboard
- See all bids
- Create new bids
- View bid details
- Edit bids

Let me know if you find any issues!
```

---

## Troubleshooting

### Backend Issues

**Problem**: Railway deployment fails
- **Solution**: Check that `package.json` has `start` script
- **Solution**: Verify all environment variables are set

**Problem**: API returns 500 error
- **Solution**: Check Railway logs for errors
- **Solution**: Verify Supabase credentials are correct

### Frontend Issues

**Problem**: Blank page after deployment
- **Solution**: Check browser console for errors
- **Solution**: Verify `VITE_API_URL` is set correctly

**Problem**: API calls fail with CORS error
- **Solution**: Backend already has CORS enabled
- **Solution**: Check that backend URL is correct

**Problem**: Login doesn't work
- **Solution**: Verify backend is running
- **Solution**: Check that JWT_SECRET matches on both

---

## Environment Variables Reference

### Backend (Railway)
```
PORT=3000
SUPABASE_URL=https://uyuzatzukqumvyrjqlci.supabase.co
SUPABASE_ANON_KEY=sb_publishable_5FQRQVt8BtwWoJtiQLB_wg_hyR-fL7h
SUPABASE_SERVICE_ROLE_KEY=sb_secret_IwXhhLrcN-leBzjGJ2aI4g_kt-_QaHN
JWT_SECRET=a7f8d9c2e1b4a5f9d8c7b6a5e4d3c2b1
```

### Frontend (Vercel)
```
VITE_API_URL=https://your-backend-url.up.railway.app
```

---

## Quick Commands

### Check Backend Status
```bash
curl https://your-backend-url.up.railway.app/health
```

### Check Frontend Build
```bash
cd frontend
npm run build
```

### View Railway Logs
1. Go to Railway dashboard
2. Click your project
3. Click "Deployments"
4. Click latest deployment
5. View logs

### View Vercel Logs
1. Go to Vercel dashboard
2. Click your project
3. Click "Deployments"
4. Click latest deployment
5. View "Build Logs" or "Function Logs"

---

## Success Checklist

- [ ] Backend deployed to Railway
- [ ] Backend URL copied
- [ ] Environment variables set in Railway
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` set in Vercel
- [ ] Frontend URL copied
- [ ] Can login with test credentials
- [ ] Dashboard loads
- [ ] Bids list displays
- [ ] Can create new bid
- [ ] Can view bid details
- [ ] URLs shared with Mike

---

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. View logs in Railway/Vercel dashboards
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
