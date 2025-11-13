# Sales-Only Feed Guide

Complete guide to creating sales-only product feeds using sale detection from PA-API.

## Overview

The Amazon Product Feed Enrichment Tool now supports **automatic sale detection** and can generate **sales-only feeds** that contain only products currently on sale.

## How Sale Detection Works

### PA-API Sale Data

Amazon's PA-API provides sale information through the `Offers.Listings.SavingBasis` resource, which contains the **original/list price** when a product is discounted.

**Sale Detection Logic:**
1. PA-API returns `SavingBasis` (original price) when available
2. Compare `SavingBasis.Amount` with current `Price.Amount`
3. If `SavingBasis > Price`, the product is on sale
4. Calculate discount amount and percentage automatically

### Sale Fields in Feed

Products on sale will include these additional fields:

```json
{
  "asin": "B07PGL2ZSL",
  "title": "Echo Dot (3rd Gen)",
  "price": 29.99,
  "currency": "USD",
  "is_on_sale": true,
  "original_price": 49.99,
  "discount_amount": 20.00,
  "discount_percentage": 40,
  "image_url": "...",
  "link": "..."
}
```

**Field Descriptions:**
- `is_on_sale` (boolean) - True if product is currently discounted
- `original_price` (number) - List price before discount
- `discount_amount` (number) - Amount saved (original_price - price)
- `discount_percentage` (number) - Percentage discount (rounded)

**Note:** These fields are only included when `is_on_sale: true`. Products not on sale won't have these fields.

## Generating Sales-Only Feeds

### Option 1: Filter After Enrichment

Generate a full feed, then filter to sales-only:

```javascript
const feedGen = require('./src/feed-generator');
const { filterSalesOnly } = feedGen;

// After enrichment
const enrichedProducts = await paApi.enrichAsins(asins, config);

// Filter to sales-only
const saleProducts = filterSalesOnly(enrichedProducts.products);

// Generate sales-only feed
await feedGen.generateFeed(saleProducts, {
  salesOnly: true,
  associateTag: 'mula0f-20',
  // ... other options
});
```

### Option 2: Use salesOnly Option

Pass `salesOnly: true` directly to `generateFeed()`:

```javascript
await feedGen.generateFeed(enrichedProducts.products, {
  salesOnly: true,  // Automatically filters to sales-only
  associateTag: 'mula0f-20',
  publisherName: 'mula',
  credentialName: 'primary',
});
```

**Output:**
- Feed file: `top-products-sales.json` (instead of `top-products.json`)
- Only includes products where `is_on_sale: true`
- Metadata includes sale statistics

## Sale Statistics in Metadata

The metadata file (`top-products-meta.json`) now includes sale statistics:

```json
{
  "generated_at": "2025-11-08T10:30:00Z",
  "total_asins": 100,
  "sales": {
    "total_on_sale": 23,
    "sale_percentage": 23.0,
    "average_discount_percentage": 28.5
  },
  "summary": {
    // ... other stats
  }
}
```

**Sale Statistics:**
- `total_on_sale` - Number of products currently on sale
- `sale_percentage` - Percentage of products on sale
- `average_discount_percentage` - Average discount across all sale items

## Example: Complete Sales-Only Feed Workflow

```javascript
const aaParser = require('./src/aa-csv-parser');
const aggregator = require('./src/asin-aggregator');
const paApi = require('./src/pa-api-client');
const feedGen = require('./src/feed-generator');
const config = require('./config');

// 1. Parse AA report
const report = await aaParser.parseReport('report.xlsx');

// 2. Aggregate and rank ASINs
const aggregated = aggregator.aggregateAsins(report.products, {
  topN: 100,
  rankingMetric: 'ordered_items',
});

// 3. Enrich with PA-API (now includes sale detection)
const enriched = await paApi.enrichProducts(aggregated, config.paApi);

// 4. Generate sales-only feed
await feedGen.generateFeed(enriched.products, {
  salesOnly: true,
  associateTag: config.paApi.associateTag,
  publisherName: 'mula',
  credentialName: 'primary',
  enrichmentMetadata: enriched.metadata,
});

console.log(`✅ Sales-only feed generated!`);
console.log(`   Products on sale: ${enriched.products.filter(p => p.is_on_sale).length}`);
```

## Amazon Branding Guidelines for Sale Items

**Important:** Amazon does **NOT** provide a specific logo or branding for sale items.

### What You CAN Use:
- ✅ "Available at Amazon" logo (for product availability, not sales)
- ✅ Your own custom sale badges/logos
- ✅ Text like "On Sale" or "Save X%"

### What You CANNOT Use:
- ❌ Amazon's logos to indicate sales
- ❌ Amazon's UI elements (like price badges)
- ❌ References to Amazon programs for sales

### Best Practices:
1. **Create your own sale branding** - Design custom badges/logos
2. **Use discount percentage** - Display `discount_percentage` prominently
3. **Show savings** - Highlight `discount_amount` or `original_price`
4. **Comply with guidelines** - Review Amazon's brand usage policies

**Resources:**
- Amazon Associates Brand Usage: https://affiliate-program.amazon.com/help/operating/amazonmarks/
- Amazon Advertising Brand Guidelines: https://advertising.amazon.com/resources/ad-policy/brand-usage

## Limitations & Notes

### PA-API Limitations:
- `SavingBasis` is only returned when Amazon has sale data
- Not all discounted products may have `SavingBasis` data
- Sale detection relies on Amazon's data accuracy
- Prices change frequently - sale status may be outdated

### Recommendations:
1. **Refresh feeds regularly** - Sale status changes daily
2. **Handle missing data** - Some products may not have sale info
3. **Verify prices** - Cross-check with Amazon product pages
4. **Monitor discount thresholds** - Filter by minimum discount if needed

## Filtering by Discount Percentage

You can add custom filtering for minimum discount:

```javascript
function filterByMinDiscount(products, minDiscountPercent = 10) {
  return products.filter(p => 
    p.is_on_sale && 
    p.discount_percentage >= minDiscountPercent
  );
}

// Example: Only products with 20%+ discount
const highDiscountProducts = filterByMinDiscount(
  enriched.products, 
  20
);
```

## Testing Sale Detection

Test with a known sale product:

```bash
# Test PA-API sale detection
node src/pa-api-client.js B07PGL2ZSL

# Look for is_on_sale, original_price, discount_percentage in output
```

## FAQ

**Q: Can I request only sale items from PA-API?**  
A: No, PA-API doesn't support filtering by sale status. You must enrich all products and filter afterward.

**Q: How accurate is sale detection?**  
A: Depends on Amazon's data. `SavingBasis` is provided when available, but not all sales may be detected.

**Q: Can I use Amazon's sale badges?**  
A: No, Amazon prohibits using their branding for sale indicators. Create your own.

**Q: How often should I refresh sales feeds?**  
A: Daily or multiple times per day, as prices and sales change frequently.

**Q: What if a product doesn't have SavingBasis?**  
A: It won't be marked as `is_on_sale`, even if it appears discounted. This is a PA-API limitation.

---

**Last Updated:** November 8, 2025

For questions or issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or check the main [README.md](../README.md).

