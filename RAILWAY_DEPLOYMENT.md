# 🚂 Railway.app Deployment Guide

Complete guide to deploy the Amazon Product Feed Enrichment Tool to Railway.app.

## Prerequisites

- ✅ Railway.app account (sign up at https://railway.app)
- ✅ GitHub repository (your code should be pushed)
- ✅ PA-API credentials ready

## Quick Deploy (5 minutes)

### Option 1: Deploy from GitHub (Recommended)

1. **Login to Railway:**
   - Go to https://railway.app
   - Sign in with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `AA-API` repository
   - Railway will auto-detect it's a Node.js app

3. **Set Environment Variables:**
   - Go to your project → "Variables" tab
   - Add these variables:

   ```
   PA_API_ACCESS_KEY=your_access_key_here
   PA_API_SECRET_KEY=your_secret_key_here
   PA_API_ASSOCIATE_TAG=mula0f-20
   PA_API_REGION=us-east-1
   PA_API_MARKETPLACE=www.amazon.com
   NODE_ENV=production
   ```

4. **Deploy:**
   - Railway will automatically build and deploy
   - Wait for deployment to complete (~2-3 minutes)
   - Click "Generate Domain" to get your public URL

5. **Test:**
   - Visit your Railway URL
   - Upload a test CSV/XLSX file
   - Verify it works!

### Option 2: Deploy via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to existing project (or create new)
railway link

# Set environment variables
railway variables set PA_API_ACCESS_KEY=your_key
railway variables set PA_API_SECRET_KEY=your_secret
railway variables set PA_API_ASSOCIATE_TAG=mula0f-20
railway variables set PA_API_REGION=us-east-1
railway variables set PA_API_MARKETPLACE=www.amazon.com

# Deploy
railway up
```

## Environment Variables

Railway will use environment variables instead of `config.js`. The server automatically reads from env vars.

**Required Variables:**
- `PA_API_ACCESS_KEY` - Your PA-API access key
- `PA_API_SECRET_KEY` - Your PA-API secret key
- `PA_API_ASSOCIATE_TAG` - Your associate tag (e.g., `mula0f-20`)
- `PA_API_REGION` - AWS region (default: `us-east-1`)
- `PA_API_MARKETPLACE` - Marketplace domain (default: `www.amazon.com`)

**Optional Variables:**
- `PORT` - Server port (Railway sets this automatically)
- `NODE_ENV` - Set to `production` for production

## Updating the Server for Railway

The server already supports environment variables! It will:
1. Try to load `config.js` (for local development)
2. Fall back to environment variables (for Railway)
3. Use defaults if neither is available

## File Upload Limits

Railway has a default body size limit. The server is configured for:
- **Max file size:** 50MB
- **Max body size:** 50MB

This should be sufficient for most AA reports. If you need larger files, Railway Pro plans support up to 100MB.

## Custom Domain

1. Go to your Railway project
2. Click "Settings" → "Domains"
3. Click "Generate Domain" (free subdomain)
4. Or add your own custom domain

## Monitoring & Logs

- **View Logs:** Railway dashboard → Your service → "Logs" tab
- **Metrics:** Railway dashboard → Your service → "Metrics" tab
- **Deployments:** Railway dashboard → "Deployments" tab

## Troubleshooting

### Build Fails

**Issue:** Build fails with dependency errors
**Fix:** 
- Check `package.json` has all dependencies
- Ensure Node.js version is 18+ (set in `package.json` engines)

### Server Won't Start

**Issue:** Server crashes on startup
**Fix:**
- Check environment variables are set correctly
- View logs: `railway logs` or Railway dashboard
- Verify PA-API credentials are correct

### File Uploads Fail

**Issue:** "Request entity too large" error
**Fix:**
- Check file size is under 50MB
- Verify `multer` limits in `server.js` match Railway limits

### Images Not Loading

**Issue:** Product images show as broken
**Fix:**
- PA-API image URLs should work fine
- Check if CORS issues (unlikely with PA-API)
- Verify `image_url` field is being returned

## Cost

**Railway Free Tier:**
- $5 credit/month
- ~500 hours runtime/month
- Perfect for this app (runs on-demand)

**Estimated Usage:**
- Server runs only when processing requests
- ~$0-2/month for typical usage
- Free tier should cover it!

## Auto-Deploy from GitHub

Railway automatically deploys when you push to GitHub:

1. Push to `main` branch
2. Railway detects changes
3. Builds and deploys automatically
4. Your site updates in ~2-3 minutes

## Security Notes

✅ **DO:**
- Use Railway environment variables for secrets
- Keep `config.js` out of Git (already in `.gitignore`)
- Rotate PA-API keys regularly

❌ **DON'T:**
- Commit `config.js` to Git
- Share Railway environment variables
- Expose PA-API credentials in logs

## Next Steps

After deployment:

1. ✅ Test with a sample CSV/XLSX file
2. ✅ Verify sale detection works
3. ✅ Check logs for any errors
4. ✅ Share the URL with your team!

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: https://github.com/lorenzlk/AA-API/issues

---

**Ready to deploy?** Follow the Quick Deploy steps above! 🚀

