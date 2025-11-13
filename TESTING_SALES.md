# Testing Sale Detection Feature

Quick guide to test the new sale detection functionality.

## ✅ What Was Updated

1. **PA-API Client** (`src/pa-api-client.js`)
   - Now requests `Offers.Listings.SavingBasis` resource
   - Extracts sale information automatically
   - Adds `is_on_sale`, `original_price`, `discount_amount`, `discount_percentage` fields

2. **Feed Generator** (`src/feed-generator.js`)
   - Includes sale fields in feed output
   - Added `filterSalesOnly()` function
   - Added `salesOnly` option to `generateFeed()`
   - Added sale statistics to metadata

3. **Config Template** (`config.template.js`)
   - Updated to include `SavingBasis` in resources

## 🧪 Quick Test: Single ASIN

Test sale detection on a single product:

```bash
# Test with a known ASIN (replace with real ASIN)
node src/pa-api-client.js B07PGL2ZSL
```

**What to look for:**
- Check if product has `is_on_sale: true`
- Look for `original_price`, `discount_amount`, `discount_percentage` fields
- If product is not on sale, these fields won't appear (that's normal)

## 🧪 Test 1: Verify Sale Detection Works

### Step 1: Test PA-API Sale Detection

```bash
# Make sure config.js has SavingBasis in resources
node src/pa-api-client.js B07PGL2ZSL,B079QHML21,B08XYZ1234
```

**Expected Output:**
```json
{
  "asin": "B07PGL2ZSL",
  "title": "Product Name",
  "price": 29.99,
  "currency": "USD",
  "is_on_sale": true,           // ← NEW
  "original_price": 49.99,      // ← NEW
  "discount_amount": 20.00,     // ← NEW
  "discount_percentage": 40,     // ← NEW
  "image_url": "...",
  "link": "...",
  "availability": "Now"
}
```

**If product is NOT on sale:**
- `is_on_sale` field won't appear
- `original_price`, `discount_amount`, `discount_percentage` won't appear
- This is expected behavior

### Step 2: Test Feed Generation with Sales

Create a test script:

```javascript
// test-sales.js
const paApi = require('./src/pa-api-client');
const feedGen = require('./src/feed-generator');
const config = require('./config');

async function testSales() {
  // Test with a few ASINs
  const testAsins = ['B07PGL2ZSL', 'B079QHML21', 'B08XYZ1234'];
  
  console.log('🔍 Testing sale detection...\n');
  
  // Enrich products
  const result = await paApi.enrichAsins(testAsins, config.paApi);
  
  // Check sale status
  const saleProducts = result.products.filter(p => p.is_on_sale);
  const regularProducts = result.products.filter(p => !p.is_on_sale);
  
  console.log(`\n📊 Results:`);
  console.log(`   Total products: ${result.products.length}`);
  console.log(`   On sale: ${saleProducts.length}`);
  console.log(`   Regular price: ${regularProducts.length}\n`);
  
  // Show sale products
  if (saleProducts.length > 0) {
    console.log('🏷️  Products on sale:');
    saleProducts.forEach(p => {
      console.log(`   ${p.title}`);
      console.log(`   Price: $${p.price} (was $${p.original_price})`);
      console.log(`   Discount: ${p.discount_percentage}% off\n`);
    });
  }
  
  // Generate regular feed
  console.log('📦 Generating regular feed...');
  await feedGen.generateFeed(result.products, {
    outputPath: './test-feeds',
    associateTag: config.paApi.associateTag,
    publisherName: 'test',
    credentialName: 'test',
  });
  
  // Generate sales-only feed
  if (saleProducts.length > 0) {
    console.log('📦 Generating sales-only feed...');
    await feedGen.generateFeed(result.products, {
      salesOnly: true,
      outputPath: './test-feeds',
      associateTag: config.paApi.associateTag,
      publisherName: 'test',
      credentialName: 'test',
    });
  }
  
  console.log('\n✅ Test complete!');
}

testSales().catch(console.error);
```

Run it:
```bash
node test-sales.js
```

## 🧪 Test 2: Full Pipeline with Sales

### Option A: Using Test Harness

1. **Start test harness:**
```bash
npm run test-harness
```

2. **Upload your AA report** (CSV/XLSX)

3. **Check the enriched products** - look for sale fields in the JSON output

4. **Manually test sales-only filter:**
   - Open browser console on test harness page
   - Run: `filterSalesOnly(enrichedProducts)`

### Option B: Command Line Full Pipeline

```bash
# 1. Parse report
node src/aa-csv-parser.js your-report.xlsx

# 2. Aggregate & rank
node src/asin-aggregator.js your-report.xlsx --top-n 50

# 3. Enrich (now includes sale detection)
# Create enrich-test.js:
```

```javascript
// enrich-test.js
const aggregator = require('./src/asin-aggregator');
const paApi = require('./src/pa-api-client');
const feedGen = require('./src/feed-generator');
const config = require('./config');
const fs = require('fs').promises;

async function runPipeline() {
  // Step 1: Parse (you already did this)
  // Step 2: Aggregate (you already did this)
  // For testing, let's use aggregated result
  
  // Step 3: Enrich with sale detection
  const aggregated = {
    success: true,
    products: [
      { asin: 'B07PGL2ZSL', ordered_items: 100 },
      { asin: 'B079QHML21', ordered_items: 50 },
      // Add more ASINs from your aggregator output
    ],
    metadata: { totalProducts: 2 }
  };
  
  console.log('🔄 Enriching products...');
  const enriched = await paApi.enrichProducts(aggregated, config.paApi);
  
  // Check sales
  const sales = enriched.products.filter(p => p.is_on_sale);
  console.log(`\n📊 Found ${sales.length} products on sale out of ${enriched.products.length}`);
  
  // Step 4: Generate feeds
  console.log('\n📦 Generating feeds...');
  
  // Regular feed
  await feedGen.generateFeed(enriched.products, {
    associateTag: config.paApi.associateTag,
    publisherName: 'test',
    credentialName: 'test',
    enrichmentMetadata: enriched.metadata,
  });
  
  // Sales-only feed
  if (sales.length > 0) {
    await feedGen.generateFeed(enriched.products, {
      salesOnly: true,
      associateTag: config.paApi.associateTag,
      publisherName: 'test',
      credentialName: 'test',
      enrichmentMetadata: enriched.metadata,
    });
  }
  
  console.log('\n✅ Done! Check ./feeds/test/test/ directory');
}

runPipeline().catch(console.error);
```

## 🧪 Test 3: Verify Config Update

Make sure your `config.js` includes `SavingBasis`:

```bash
# Check config.js
cat config.js | grep -A 5 "resources:"
```

Should see:
```javascript
resources: [
  'Images.Primary.Medium',
  'ItemInfo.Title',
  'Offers.Listings.Price',
  'Offers.Listings.SavingBasis', // ← Should be here
  'Offers.Listings.Availability'
],
```

If not, update it:
```bash
# Edit config.js and add SavingBasis to resources array
```

## 🧪 Test 4: Sales-Only Feed Generation

Test the `salesOnly` filter:

```javascript
// test-sales-filter.js
const feedGen = require('./src/feed-generator');

// Mock products (some on sale, some not)
const mockProducts = [
  {
    asin: 'B001',
    title: 'Product 1',
    price: 29.99,
    is_on_sale: true,
    original_price: 49.99,
    discount_percentage: 40,
  },
  {
    asin: 'B002',
    title: 'Product 2',
    price: 99.99,
    is_on_sale: false, // Not on sale
  },
  {
    asin: 'B003',
    title: 'Product 3',
    price: 19.99,
    is_on_sale: true,
    original_price: 39.99,
    discount_percentage: 50,
  },
];

// Test filter
const salesOnly = feedGen.filterSalesOnly(mockProducts);
console.log(`Filtered: ${salesOnly.length} products`);
console.log('Should be 2 products (B001 and B003)');

// Test feed generation with salesOnly option
feedGen.generateFeed(mockProducts, {
  salesOnly: true,
  outputPath: './test-feeds',
  associateTag: 'test-20',
  publisherName: 'test',
  credentialName: 'test',
}).then(result => {
  console.log(`\n✅ Sales-only feed generated: ${result.feedPath}`);
  console.log(`   Products: ${result.productCount} (should be 2)`);
});
```

## ✅ Verification Checklist

After testing, verify:

- [ ] PA-API requests include `SavingBasis` resource
- [ ] Products on sale have `is_on_sale: true`
- [ ] Sale products include `original_price`, `discount_amount`, `discount_percentage`
- [ ] Products NOT on sale don't have sale fields (expected)
- [ ] `filterSalesOnly()` works correctly
- [ ] `salesOnly: true` option generates `top-products-sales.json`
- [ ] Metadata includes sale statistics
- [ ] Regular feeds still work (backward compatible)

## 🐛 Troubleshooting

### No sale data appearing?

1. **Check if products are actually on sale:**
   - Visit Amazon product page
   - Look for "List Price" vs "Price"
   - PA-API only returns sale data when Amazon provides it

2. **Verify config.js has SavingBasis:**
   ```bash
   grep -A 5 "resources:" config.js
   ```

3. **Check PA-API response:**
   ```javascript
   // Add debug logging in pa-api-client.js
   console.log('PA-API Response:', JSON.stringify(item.Offers?.Listings?.[0], null, 2));
   ```

### Sale fields missing in feed?

- Make sure you're using the updated `feed-generator.js`
- Check that enriched products have `is_on_sale: true`
- Verify `formatProduct()` includes sale fields

### Test with Real Sale Products

Find products currently on sale:
1. Visit Amazon.com
2. Look for products with "List Price" crossed out
3. Use those ASINs in your test

## 📝 Example Test Output

```
🔍 Testing sale detection...

Enriching 3 ASINs in 1 batches...
Processing batch 1/1 (3 ASINs)...
✅ Enrichment complete: 3/3 successful (100.0%)

📊 Results:
   Total products: 3
   On sale: 1
   Regular price: 2

🏷️  Products on sale:
   Echo Dot (3rd Gen)
   Price: $29.99 (was $49.99)
   Discount: 40% off

📦 Generating regular feed...
✅ Feed generated successfully
   Feed: ./feeds/test/test/20251108/top-products.json

📦 Generating sales-only feed...
📊 Filtering to sales-only: 1/3 products
✅ Feed generated successfully
   Feed: ./feeds/test/test/20251108/top-products-sales.json

✅ Test complete!
```

## 🚀 Next Steps

Once testing is complete:

1. **Update Pipedream workflow** (if using):
   - Add `salesOnly: true` option when generating feeds
   - Or generate both regular and sales-only feeds

2. **Update any automation scripts** to use new sale fields

3. **Monitor sale statistics** in metadata files

---

**Need help?** Check [docs/SALES_FEED.md](./docs/SALES_FEED.md) for detailed documentation.

