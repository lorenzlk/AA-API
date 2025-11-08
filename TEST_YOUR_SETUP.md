# Test Your Setup

Now that your credentials are configured, test the system!

## Quick Test (5 minutes)

### 1. Test PA-API Connection

```bash
# Test with a single ASIN
node src/pa-api-client.js B07PGL2ZSL
```

**Expected output:**
```
✅ Enrichment complete: 1/1 successful

1. Echo Dot (3rd Gen)
   ASIN: B07PGL2ZSL
   Price: USD 49.99
   Image: Available
   Link: https://www.amazon.com/dp/B07PGL2ZSL?tag=mula0f-20
```

If this works, your PA-API credentials are correct! ✅

### 2. Test CSV Parser

```bash
node src/aa-csv-parser.js sample-data/aa-report-sample.csv
```

**Expected output:**
```
✅ CSV Parsed Successfully

Metadata:
  Total Rows: 20
  Valid Products: 20
  Unique ASINs: 20
  Total Ordered Items: 1586
  Total Revenue: $104,533.16
  Total Earnings: $5,226.66
```

### 3. Test Aggregator

```bash
node src/asin-aggregator.js sample-data/aa-report-sample.csv --top-n 10
```

**Expected output:**
```
✅ Products Aggregated and Ranked

Top 10 Products (by ordered_items):
  1. B07PGL2ZSL
     Orders: 156 | Revenue: $7794.44 | CR: 6.66%
  ...
```

### 4. Test Full Pipeline

```bash
# This will test parsing, aggregation, and PA-API enrichment
node src/pa-api-client.js B07PGL2ZSL,B079QHML21,B07WMLJ8TG
```

This tests 3 ASINs (1 batch) to verify the complete flow.

## Common Issues

### "InvalidClientTokenId"
- **Problem:** PA-API credentials are incorrect
- **Solution:** Double-check Access Key in config.js

### "SignatureDoesNotMatch"  
- **Problem:** Secret Key is incorrect
- **Solution:** Double-check Secret Key in config.js (no extra spaces)

### "Module not found"
- **Problem:** Dependencies not installed
- **Solution:** Run `npm install`

## Next Steps

Once all tests pass:

1. **Add your sample AA report:**
   - Place your real AA CSV in `sample-data/your-report.csv`
   - Test: `node src/aa-csv-parser.js sample-data/your-report.csv`

2. **Set up Slack webhook:**
   - Get webhook from https://api.slack.com/messaging/webhooks
   - Add to config.js: `slack.webhookUrl`
   - Test: `node src/slack-notifier.js YOUR_WEBHOOK_URL test-success`

3. **Deploy to Pipedream:**
   - Follow [QUICKSTART.md](./QUICKSTART.md)
   - Copy environment variables from `.env` file
   - Import `pipedream-workflow-template.js`

## Troubleshooting

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for detailed help.

---

**Your Credentials:**
- Access Key: AKPAG6X5YY1759264389
- Associate Tag: mula0f-20
- Region: us-east-1
- Marketplace: www.amazon.com

**Status:** Ready to test! 🚀
