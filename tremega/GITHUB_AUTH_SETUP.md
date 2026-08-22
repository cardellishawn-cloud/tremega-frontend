# GitHub Authentication Setup

## Current Status

✅ **Git remote configured**: `origin https://github.com/ShawnCardelli/tremega-backend.git`
✅ **Credential helper set**: `wincred` (Windows Credential Manager)
✅ **Commits ready**: 5 commits ready to push

## The Issue

The `git push` command hangs because it needs GitHub authentication. Since you have 2FA enabled (which is good!), you need to use a **Personal Access Token** instead of your password.

---

## Solution: Create and Use Personal Access Token

### Step 1: Create Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in:
   - **Note**: `Tremega Deployment`
   - **Expiration**: `90 days` (or custom)
   - **Select scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
4. Click **"Generate token"**
5. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

### Step 2: Push Using the Token

Open PowerShell and run:

```powershell
cd C:\Users\carde\.openclaw\workspace\tremega\backend

# Push to GitHub
git push -u origin master
```

When prompted:
- **Username**: `ShawnCardelli`
- **Password**: Paste your Personal Access Token (not your GitHub password)

### Step 3: Verify

After pushing, check:
1. Go to https://github.com/ShawnCardelli/tremega-backend
2. You should see all your backend code
3. Look for "Latest commit" with your recent changes

---

## Alternative: Use GitHub Desktop (Easier)

If the command line is tricky, use GitHub Desktop:

1. **Download**: https://desktop.github.com/
2. **Install and sign in** with your GitHub account
3. **Add repository**:
   - File → Add Local Repository
   - Choose: `C:\Users\carde\.openclaw\workspace\tremega\backend`
4. **Publish**:
   - Click "Publish repository"
   - Name: `tremega-backend`
   - Click "Publish Repository"

This handles all authentication automatically!

---

## Alternative: Use GitHub CLI

1. **Install GitHub CLI**:
   ```powershell
   winget install --id GitHub.cli
   ```

2. **Login**:
   ```powershell
   gh auth login
   ```
   - Choose "GitHub.com"
   - Choose "HTTPS"
   - Choose "Login with a web browser"
   - Copy the code and authorize in browser

3. **Push**:
   ```powershell
   cd C:\Users\carde\.openclaw\workspace\tremega\backend
   git push -u origin master
   ```

---

## Troubleshooting

### "Authentication failed"
- Make sure you're using the **Personal Access Token**, not your password
- Check that the token has `repo` scope
- Try generating a new token

### "Repository not found"
- Check that the repository exists: https://github.com/ShawnCardelli/tremega-backend
- Verify the remote URL: `git remote -v`
- Make sure you're pushing to the correct repository

### "Permission denied"
- Check that you're logged in as `ShawnCardelli`
- Verify the token has the correct permissions
- Try using GitHub Desktop instead

---

## Next Steps After Successful Push

Once the code is on GitHub:

1. **Deploy Backend to Railway**:
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select `tremega-backend`
   - Add environment variables
   - Deploy

2. **Deploy Frontend to Vercel**:
   - Go to https://vercel.com
   - Import `tremega-frontend`
   - Add `VITE_API_URL` environment variable
   - Deploy

---

## Quick Commands Reference

```powershell
# Check remote
git remote -v

# Check status
git status

# Check commits
git log --oneline -5

# Push (will prompt for credentials)
git push -u origin master

# Force push (if needed)
git push -u origin master --force
```

---

## Need Help?

If you're still stuck:
1. Try GitHub Desktop (easiest option)
2. Generate a new Personal Access Token
3. Check that 2FA is properly set up
4. Verify the repository exists on GitHub
