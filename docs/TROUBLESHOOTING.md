# Troubleshooting Guide

Common issues and solutions for the Amazon Product Feed Enrichment Tool.

## Table of Contents
1. [PA-API Authentication Issues](#pa-api-authentication-issues)
2. [CSV Parsing Errors](#csv-parsing-errors)
3. [Enrichment Problems](#enrichment-problems)
4. [Feed Generation Failures](#feed-generation-failures)
5. [Slack Notification Issues](#slack-notification-issues)
6. [Pipedream Workflow Errors](#pipedream-workflow-errors)
7. [Performance Issues](#performance-issues)

---

## PA-API Authentication Issues

### Error: "InvalidClientTokenId" or "SignatureDoesNotMatch"

**Symptoms:**
- PA-API requests fail with 401/403 errors
- Error message mentions invalid credentials or signature

**Causes:**
- Incorrect Access Key or Secret Key
- Credentials not active yet (PA-API access pending)
- Incorrect region configuration
- Timestamp/clock skew issues

**Solutions:**

1. **Verify credentials:**
   ```javascript
   console.log('Access Key:', process.env.PA_API_ACCESS_KEY.substring(0, 8) + '...');
   console.log('Associate Tag:', process.env.PA_API_ASSOCIATE_TAG);
   ```
   
2. **Check PA-API access status:**
   - Visit https://affiliate-program.amazon.com/assoc_credentials/home
   - Verify "Product Advertising API" is enabled
   - Wait 24-48 hours if just requested

3. **Verify region:**
   - US marketplace → region: `us-east-1`
   - UK marketplace → region: `eu-west-1`
   - Check config matches your marketplace

4. **Test credentials manually:**
   ```bash
   node src/pa-api-client.js B07PGL2ZSL
   ```

### Error: "Too Many Requests" or Rate Limiting

**Symptoms:**
- 429 status code
- "Request throttled" error

**Solutions:**
- Verify `requestDelayMs` is ≥1100ms (1.1 seconds)
- Check you're not running multiple workflows simultaneously
- Free tier limit: 1 request/second
- Consider paid tier if needing higher throughput

---

## CSV Parsing Errors

### Error: "Missing required columns"

**Symptoms:**
```
Missing required columns: asin, orderedItems
Available columns: Product ID, Orders, Revenue
```

**Cause:**
Column names in CSV don't match expected mappings

**Solutions:**

1. **Check CSV headers:**
   - Open CSV in text editor
   - Compare to `COLUMN_MAPPINGS` in `aa-csv-parser.js`

2. **Add custom mapping:**
   Edit `aa-csv-parser.js`:
   ```javascript
   const COLUMN_MAPPINGS = {
     asin: ['asin', 'product asin', 'Product ID'], // Add your column name
     orderedItems: ['ordered items', 'Orders'],    // Add your column name
     // ...
   };
   ```

3. **Standardize export format:**
   - Always use same AA report template
   - Document which report type you're using

### Error: "No valid products found"

**Symptoms:**
- CSV parses but 0 products returned
- All rows skipped

**Causes:**
- Invalid ASIN format
- All values are zero/empty
- Column mismatch

**Solutions:**

1. **Check ASIN format:**
   - Valid: `B07PGL2ZSL` (10 alphanumeric, starts with B or digit)
   - Invalid: `07PGL2ZSL` (missing B), `B07-PGL-2ZSL` (dashes)

2. **Inspect first few rows:**
   ```bash
   head -5 your-report.csv
   ```

3. **Test with sample data:**
   ```bash
   node src/aa-csv-parser.js sample-data/aa-report-sample.csv
   ```

---

## Enrichment Problems

### Low Success Rate (<95%)

**Symptoms:**
- Only 60-80% of ASINs enriched
- Many "ItemNotAccessible" errors

**Causes:**
- ASINs not available in selected marketplace
- ASINs for digital/restricted products
- Outdated/invalid ASINs

**Solutions:**

1. **Filter invalid ASINs:**
   Review `failed` list in enrichment results
   
2. **Check marketplace:**
   - Ensure ASINs are from same marketplace (US/UK/etc.)
   - Set correct `marketplace` in config

3. **Accept some failures:**
   - 95%+ success rate is normal
   - Some ASINs legitimately unavailable
   - Focus on top performers

### Error: "Resource not supported"

**Symptoms:**
- PA-API returns 400 error
- Message about unsupported resource

**Solution:**
- Check `resources` array in config
- Valid resources listed at: https://webservices.amazon.com/paapi5/documentation/get-items.html
- Ensure you have access (some require approval)

### Slow Enrichment (>2 minutes for 100 ASINs)

**Symptoms:**
- Processing takes much longer than expected
- No errors, just slow

**Causes:**
- Network latency
- API response times
- Insufficient batch delay

**Solutions:**

1. **Check batch delay:**
   - Should be 1100ms minimum
   - Increase if getting throttled

2. **Monitor API response times:**
   - Add timing logs
   - Check Pipedream execution logs

3. **Reduce batch size (not recommended):**
   - Default: 10 ASINs per request
   - Can reduce to 5 if needed

---

## Feed Generation Failures

### Error: "Cannot create directory"

**Symptoms:**
- Feed generation fails
- Permission denied or path errors

**Causes:**
- Invalid output path
- Insufficient permissions
- Path doesn't exist

**Solutions (Pipedream):**
- Use `generateFeedStrings()` instead of `generateFeed()`
- Store in Pipedream data stores
- Or upload to Google Drive

**Solutions (Local):**
- Check output path exists: `mkdir -p /feeds`
- Verify write permissions
- Use absolute paths

### Feed is Empty or Invalid JSON

**Symptoms:**
- JSON parse errors
- Empty array `[]`
- Missing expected fields

**Causes:**
- No products reached feed generation
- Enrichment completely failed
- Format error in code

**Solutions:**

1. **Check previous steps:**
   - How many products from parser?
   - How many after aggregation?
   - How many after enrichment?

2. **Validate JSON:**
   ```bash
   node -c feed.json  # Check syntax
   jq . feed.json     # Pretty print
   ```

3. **Review logs:**
   - Check Pipedream execution logs
   - Look for errors in earlier steps

---

## Slack Notification Issues

### No Notification Received

**Symptoms:**
- Workflow completes successfully
- No Slack message appears

**Causes:**
- Invalid webhook URL
- Slack app permissions revoked
- Webhook deleted
- Wrong channel

**Solutions:**

1. **Test webhook directly:**
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"text":"Test from AA Feed Tool"}' \
     YOUR_WEBHOOK_URL
   ```

2. **Check Slack app:**
   - Visit https://api.slack.com/apps
   - Verify webhook is active
   - Regenerate if needed

3. **Verify URL:**
   - Should start with `https://hooks.slack.com/services/`
   - Check for typos
   - Ensure no spaces or line breaks

### Notification Format Broken

**Symptoms:**
- Message appears but formatting is wrong
- Missing sections or garbled text

**Causes:**
- Invalid Slack Block Kit syntax
- Special characters not escaped
- Missing required fields

**Solutions:**

1. **Test format:**
   - Use Slack Block Kit Builder: https://app.slack.com/block-kit-builder
   - Paste message JSON and preview

2. **Check for special characters:**
   - Product titles with emojis or special chars
   - Escape backticks in code blocks

---

## Pipedream Workflow Errors

### Error: "Module not found"

**Symptoms:**
```
Cannot find module 'papaparse'
```

**Cause:**
Module not auto-installed by Pipedream

**Solution:**
- Pipedream auto-installs most modules
- Use `require('papaparse')` at top of step
- Check module name spelling

### Workflow Times Out

**Symptoms:**
- Execution exceeds time limit
- Workflow stops mid-process

**Causes:**
- Too many ASINs to process
- Slow PA-API responses
- Infinite loop or hang

**Solutions:**

1. **Reduce batch size:**
   - Process top 50 instead of 100
   - Split into multiple workflows

2. **Optimize delays:**
   - Use exactly 1100ms, not more
   - Remove unnecessary delays

3. **Check for hangs:**
   - Add timeout to axios requests
   - Review execution logs

### Error: "Insufficient credits"

**Symptoms:**
- Workflow fails to run
- Message about Pipedream credits

**Solution:**
- Check credit usage in Pipedream dashboard
- Free tier: 333 credits/month
- Optimize workflow to use fewer credits
- Consider upgrading plan

---

## Performance Issues

### Processing Takes >2 Minutes

**Expected:** ~15-20 seconds for 100 ASINs

**Causes:**
- Too many ASINs
- Slow API responses
- Excessive delays
- Large CSV file

**Solutions:**

1. **Profile each step:**
   Add timing to each step:
   ```javascript
   const start = Date.now();
   // ... do work
   console.log(`Step took ${Date.now() - start}ms`);
   ```

2. **Optimize bottlenecks:**
   - CSV parsing should be <1s
   - Aggregation should be <1s
   - PA-API enrichment: ~1.1s per batch
   - Feed generation should be <1s

3. **Reduce scope:**
   - Process top 50 instead of 100
   - Filter low-performing products earlier

### High Memory Usage

**Symptoms:**
- Workflow crashes
- Out of memory errors

**Causes:**
- Very large CSV files
- Accumulating data in memory

**Solutions:**

1. **Stream large files:**
   - Process CSV in chunks
   - Don't load entire file at once

2. **Clean up variables:**
   - Delete large objects when done
   - Use `null` to free memory

---

## Getting Help

### Self-Service

1. **Check logs:**
   - Pipedream execution logs (most detailed)
   - Slack error notifications
   - Browser console (if local)

2. **Test components individually:**
   - Run each module standalone
   - Isolate the failing step

3. **Review documentation:**
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - How it works
   - [PA_API_GUIDE.md](./PA_API_GUIDE.md) - PA-API details
   - [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - Deployment

### Contact Support

If still stuck:

1. **GitHub Issues:**
   - https://github.com/lorenzlk/AA-API/issues
   - Include error messages, logs, anonymized data

2. **Information to Include:**
   - Error message (full text)
   - Which step failed
   - Pipedream execution ID
   - CSV file structure (first few rows, no real data)
   - Environment (Pipedream vs local)
   - What you've tried so far

---

## Common Error Messages Reference

| Error | Meaning | Solution |
|-------|---------|----------|
| `InvalidClientTokenId` | PA-API credentials wrong | Verify Access Key |
| `SignatureDoesNotMatch` | Signature calculation error | Check Secret Key and region |
| `TooManyRequests` | Rate limit exceeded | Increase delay between requests |
| `ItemNotAccessible` | ASIN not available | Normal, skip this ASIN |
| `Missing required columns` | CSV format mismatch | Add column mapping |
| `ENOTFOUND` | Network/DNS error | Check internet connection |
| `ETIMEDOUT` | Request timeout | Increase timeout, check PA-API status |
| `Insufficient credits` | Pipedream quota exceeded | Upgrade or wait for reset |

---

**Last Updated:** November 7, 2025

For additional help, review the documentation or open an issue on GitHub.

