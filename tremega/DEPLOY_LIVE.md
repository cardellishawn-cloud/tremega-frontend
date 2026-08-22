# Tremega Deployment Guide - Railway + Vercel

## Current Status

✅ **Backend code ready**: All commits prepared
✅ **Frontend code ready**: All commits prepared  
✅ **Git remote configured**: `https://github.com/ShawnCardelli/tremega-backend.git`
⚠️ **Authentication needed**: Personal Access Token required for push

---

## Step 1: Push Code to GitHub

### Option A: Use Personal Access Token (Recommended)

1. **Create Token**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name: `Tremega Deployment`
   - Expiration: `90 days`
   - Check: ✅ `repo` and ✅ `workflow`
   - Click "Generate token"
   - **COPY THE TOKEN**

2. **Push Backend**:
   ```powershell
   cd C:\Users\carde\.openclaw\workspace\tremega\backend
   git push -u origin master
   ```
   - Username: `ShawnCardelli`
   - Password: Paste your Personal Access Token

3. **Push Frontend**:
   ```powershell
   cd C:\Users\carde\.openclaw\workspace\tremega\frontend
   git push -u origin master
   ```
   - Username: `ShawnCardelli`
   - Password: Paste your Personal Access Token

### Option B: Use GitHub Desktop (Easiest)

1. Download: https://desktop.github.com/
2. Sign in with GitHub account
3. Add both repositories:
   - File → Add Local Repository → `tremega/backend`
   - File → Add Local Repository → `tremega/frontend`
4. Publish both repositories

---

## Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `ShawnCardelli/tremega-backend`
4. Click "Deploy Now"

### 2.3 Add Environment Variables
In Railway dashboard → Variables tab:

| Key | Value |
|-----|-------|
| `PORT` | `3000` |
| `SUPABASE_URL` | `https://uyuzatzukqumvyrjqlci.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_5FQRQVt8BtwWoJtiQLB_wg_hyR-fL7h` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_IwXhhLrcN-leBzjGJ2aI4g_kt-_QaHN` |
| `JWT_SECRET` | `a7f8d9c2e1b4a5f9d8c7b6a5e4d3c2b1` |

### 2.4 Get Backend URL
1. Wait for deployment (green checkmark)
2. Go to Settings → Domains
3. Copy the URL (e.g., `https://tremega-backend-prod.up.railway.app`)

### 2.5 Test Backend
```bash
curl https://your-backend-url.up.railway.app/api/bids
# Should return 401 (needs auth) - this means it's working!
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account
1. Go to https://vercel.com
2. Click "Sign Up" → "Continue with GitHub"
3. Authorize Vercel

### 3.2 Import Project
1. Click "Add New..." → "Project"
2. Find `ShawnCardelli/tremega-frontend`
3. Click "Import"

### 3.3 Configure Project
- **Framework Preset**: Vite (auto-detected)
- **Root Directory**: `./` (leave as is)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `dist` (auto-detected)

### 3.4 Add Environment Variable
In project settings → Environment Variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-backend-url.up.railway.app` |

**Important**: Replace with your actual Railway backend URL from Step 2.4

### 3.5 Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Copy the frontend URL (e.g., `https://tremega-frontend.vercel.app`)

---

## Step 4: Test the Live App

### 4.1 Open Frontend URL
Go to `https://tremega-frontend.vercel.app`

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

Send Mike this message:

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
- Check that `package.json` has `start` script
- Verify all environment variables are set
- Check Railway logs for errors

**Problem**: API returns 500 error
- Check Railway logs
- Verify Supabase credentials
- Check that database tables exist

### Frontend Issues

**Problem**: Blank page after deployment
- Check browser console for errors
- Verify `VITE_API_URL` is set correctly
- Check that backend URL is correct

**Problem**: API calls fail with CORS error
- Backend already has CORS enabled
- Check that backend URL is correct
- Verify backend is running

**Problem**: Login doesn't work
- Verify backend is running
- Check that JWT_SECRET matches
- Verify test user exists in database

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
1. Railway dashboard → Your project
2. Click "Deployments"
3. Click latest deployment
4. View logs

### View Vercel Logs
1. Vercel dashboard → Your project
2. Click "Deployments"
3. Click latest deployment
4. View "Build Logs"

---

## Success Checklist

- [ ] Code pushed to GitHub
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
1. Check the troubleshooting section
2. View logs in Railway/Vercel dashboards
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

---

## Next Steps After Deployment

1. **Monitor the app**: Check Railway/Vercel dashboards for errors
2. **Test thoroughly**: Try all features with test account
3. **Share with Mike**: Send him the frontend URL and credentials
4. **Gather feedback**: Ask Mike to test and report issues
5. **Iterate**: Fix any bugs and redeploy

---

**Ready to deploy? Start with Step 1: Push code to GitHub!**
