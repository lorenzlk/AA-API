# Update Checklist & Testing Guide

## ✅ What Needs Updating

### 1. **Update Your `config.js`** ⚠️ REQUIRED

Your `config.js` needs to include `SavingBasis` in the resources array:

```javascript
paApi: {
  // ... other config ...
  resources: [
    'Images.Primary.Medium',
    'ItemInfo.Title',
    'Offers.Listings.Price',
    'Offers.Listings.SavingBasis', // ← ADD THIS LINE
    'Offers.Listings.Availability'
  ],
}
```

**Quick check:**
```bash
grep -A 5 "resources:" config.js
```

If you don't see `SavingBasis`, add it!

### 2. **Pipedream/Workflow Updates** (If Applicable)

If you're using Pipedream or any automation:
- No changes required - sale detection works automatically
- Optional: Add `salesOnly: true` to generate sales-only feeds
- Optional: Use `filterSalesOnly()` to filter products

### 3. **Test Harness** (Optional)

The test harness (`test-harness/server.js`) will automatically work with sale detection - no changes needed. It will return sale fields in the enriched products.

## 🧪 How to Test

### Quick Test (Recommended)

Run the automated test script:

```bash
# Test with default ASINs
node test-sales-detection.js

# Or test with your own ASINs
node test-sales-detection.js B07PGL2ZSL,B079QHML21,B08XYZ1234
```

This will:
1. ✅ Test PA-API sale detection
2. ✅ Show which products are on sale
3. ✅ Generate test feeds (regular + sales-only)
4. ✅ Verify all functionality

### Manual Test

```bash
# 1. Test PA-API sale detection
node src/pa-api-client.js B07PGL2ZSL

# Look for these fields in output:
# - is_on_sale: true
# - original_price
# - discount_percentage
```

### Full Pipeline Test

```bash
# 1. Parse your AA report
node src/aa-csv-parser.js your-report.xlsx

# 2. Aggregate & rank
node src/asin-aggregator.js your-report.xlsx --top-n 50

# 3. Enrich (now includes sale detection automatically)
# Use the test script or your workflow
```

## ✅ Verification Checklist

After updating `config.js`, verify:

- [ ] `config.js` includes `Offers.Listings.SavingBasis` in resources
- [ ] Test script runs without errors
- [ ] Products on sale show `is_on_sale: true`
- [ ] Sale products include `original_price`, `discount_amount`, `discount_percentage`
- [ ] Regular feed still works (backward compatible)
- [ ] Sales-only feed generates when `salesOnly: true`
- [ ] Metadata includes sale statistics

## 📝 Expected Test Output

```
🧪 Testing Sale Detection Feature

Testing 2 ASIN(s): B07PGL2ZSL, B079QHML21

📡 Enriching products via PA-API...

Enriching 2 ASINs in 1 batches...
Processing batch 1/1 (2 ASINs)...
✅ Enrichment complete: 2/2 successful (100.0%)

📊 Results:

   Total products: 2
   ✅ On sale: 1
   💰 Regular price: 1

🏷️  Products ON SALE:

   1. Echo Dot (3rd Gen)
      ASIN: B07PGL2ZSL
      Current Price: $29.99 USD
      Original Price: $49.99 USD
      Discount: 40% off ($20.00)

💰 Products at Regular Price:

   1. Some Other Product
      ASIN: B079QHML21
      Price: $99.99 USD

📦 Testing feed generation...

   filterSalesOnly() returned: 1 products
   ✅ Filter function works correctly

📁 Generating test feeds...

   ✅ Regular feed: ./test-feeds/test/test/20251108/top-products.json
      Products: 2
   ✅ Sales-only feed: ./test-feeds/test/test/20251108/top-products-sales.json
      Products: 1 (should be 1)
   ✅ Sales-only feed count matches!

📊 Checking metadata...

   Sale Statistics:
      Total on sale: 1
      Sale percentage: 50.0%
      Avg discount: 40.0%
   ✅ Sale statistics included in metadata

============================================================
✅ TEST COMPLETE!

Summary:
   • Enriched: 2/2 products
   • On sale: 1
   • Regular: 1
   • Feeds generated: 2

Check ./test-feeds/test/test/ directory for output files
============================================================
```

## 🐛 Troubleshooting

### "SavingBasis not found in config.resources"

**Fix:** Update `config.js`:
```javascript
resources: [
  'Images.Primary.Medium',
  'ItemInfo.Title',
  'Offers.Listings.Price',
  'Offers.Listings.SavingBasis', // ← Add this
  'Offers.Listings.Availability'
],
```

### No products showing as on sale

**This is normal!** Not all products are on sale. PA-API only returns sale data when:
- Amazon has the original/list price
- Product is actually discounted
- Sale data is available

**To test with sale products:**
1. Visit Amazon.com
2. Find products with crossed-out "List Price"
3. Use those ASINs in your test

### Test script fails

**Check:**
1. `config.js` exists and has valid PA-API credentials
2. Node.js version is 18+
3. Dependencies installed: `npm install`

## 📚 Documentation

- **Full Guide:** [docs/SALES_FEED.md](./docs/SALES_FEED.md)
- **Testing Details:** [TESTING_SALES.md](./TESTING_SALES.md)
- **PA-API Guide:** [docs/PA_API_GUIDE.md](./docs/PA_API_GUIDE.md)

## 🚀 Next Steps

1. ✅ Update `config.js` (add SavingBasis)
2. ✅ Run test script: `node test-sales-detection.js`
3. ✅ Verify sale detection works
4. ✅ Update workflows (optional - add salesOnly option)
5. ✅ Monitor sale statistics in your feeds

---

**Questions?** Check the documentation or run the test script for detailed output.

