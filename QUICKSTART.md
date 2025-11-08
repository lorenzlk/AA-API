# Quick Start Guide - 15 Minutes to Your First Feed

Get the Amazon Product Feed Enrichment Tool running in 15 minutes.

## Prerequisites

- [ ] Amazon Associates account
- [ ] Amazon Product Advertising API credentials ([Get them here](https://affiliate-program.amazon.com/assoc_credentials/home))
- [ ] Pipedream account ([Sign up free](https://pipedream.com))
- [ ] Slack workspace ([Create webhook](https://api.slack.com/messaging/webhooks))

## Step 1: Clone Repository (1 min)

```bash
git clone https://github.com/lorenzlk/AA-API.git
cd AA-API
```

## Step 2: Configure Credentials (3 min)

```bash
# Copy template
cp config.template.js config.js

# Edit config.js with your credentials
nano config.js  # or use your favorite editor
```

**Required values:**
- `paApi.accessKey` - Your PA-API Access Key
- `paApi.secretKey` - Your PA-API Secret Key
- `paApi.associateTag` - Your Associate Tag (e.g., "mulapublisher-20")
- `slack.webhookUrl` - Your Slack webhook URL

## Step 3: Test Locally (5 min)

```bash
# Create test directory
mkdir -p sample-data

# Download sample AA report or use your own
# Copy your AA CSV export to sample-data/

# Test CSV parser
node src/aa-csv-parser.js sample-data/your-report.csv

# You should see parsed ASINs and metrics
```

## Step 4: Deploy to Pipedream (5 min)

### Option A: Via Pipedream UI

1. Go to [Pipedream](https://pipedream.com) and sign in
2. Click **New Workflow**
3. Copy contents of `pipedream-workflow-template.js`
4. Click **Import Code**
5. Paste code and click **Import**
6. Configure environment variables:
   - `PA_API_ACCESS_KEY`
   - `PA_API_SECRET_KEY`
   - `PA_API_ASSOCIATE_TAG`
   - `SLACK_WEBHOOK_URL`
7. Click **Deploy**

### Option B: Via Pipedream CLI

```bash
# Install Pipedream CLI
npm install -g @pipedream/cli

# Login
pd login

# Deploy workflow
pd deploy pipedream-workflow-template.js
```

## Step 5: Set Up Trigger (1 min)

### Google Drive Trigger (Recommended)

1. In your Pipedream workflow, add a **Google Drive** trigger
2. Select **New File in Folder**
3. Choose/create folder: `Amazon Associates/Reports`
4. Save trigger

### Manual Trigger (Alternative)

1. Use **HTTP Webhook** trigger
2. Send POST request with CSV data to trigger URL

## Step 6: Test End-to-End (<1 min)

```bash
# Upload AA CSV to your Google Drive trigger folder
# OR
# Trigger manually via Pipedream UI

# Check:
# 1. Pipedream execution logs
# 2. Slack notification
# 3. Generated feed in /feeds/ directory
```

## Expected Output

### In Slack:
```
🎯 Feed Generated Successfully

📊 Summary
• Total ASINs: 100
• Enriched: 97 (97%)
• Failed: 3

🏆 Top 5 Products
1. Echo Dot (3rd Gen) - $49.99 (156 orders)
...

📂 Feed Location
/feeds/mula/primary/20251107/top-products.json
```

### In `/feeds/` directory:
```json
[
  {
    "asin": "B07PGL2ZSL",
    "title": "Echo Dot (3rd Gen)",
    "price": 49.99,
    "currency": "USD",
    "image_url": "https://m.media-amazon.com/...",
    "link": "https://www.amazon.com/dp/B07PGL2ZSL?tag=mulapublisher-20",
    "rank": 1,
    "ordered_items": 156,
    "shipped_revenue": 7794.44
  }
]
```

## Troubleshooting

### "PA-API Authentication Failed"
- Verify credentials in config.js or Pipedream secrets
- Check if PA-API access is enabled in your Amazon Associates account
- Ensure Associate Tag matches your account

### "No ASINs found in CSV"
- Check CSV column names match expectations
- Verify CSV is not empty
- Check file encoding (should be UTF-8)

### "Rate limit exceeded"
- Free tier = 1 request/second
- Default batch delay is 1100ms (safe)
- Reduce concurrent requests if needed

### "Feed not generated"
- Check Pipedream execution logs
- Verify all steps completed
- Look for error messages in Slack notification

## Next Steps

✅ **You're done!** Your feed enrichment is now automated.

**Optional enhancements:**
- Schedule daily AA report exports (see main AA scraper project)
- Add multiple publisher configurations
- Customize ranking metrics
- Set up monitoring/alerts

## Support

- **Documentation:** See [docs/](./docs/) folder
- **Common issues:** [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- **Architecture:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

**Total setup time:** ~15 minutes  
**Ongoing maintenance:** ~0 minutes (fully automated)

