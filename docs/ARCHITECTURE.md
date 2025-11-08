# Architecture Overview

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AMAZON ASSOCIATES REPORT                  │
│                         (CSV Export)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Manual Upload / Automated Scraper
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     TRIGGER (Pipedream)                      │
│                  Google Drive File Watcher                  │
│                     or HTTP Webhook                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  PROCESSING PIPELINE                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. CSV PARSER (aa-csv-parser.js)                     │ │
│  │     - Flexible column detection                       │ │
│  │     - ASIN validation                                 │ │
│  │     - Metric extraction                               │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  2. AGGREGATOR (asin-aggregator.js)                   │ │
│  │     - Group by ASIN                                   │ │
│  │     - Calculate metrics                               │ │
│  │     - Rank by performance                             │ │
│  │     - Select top N                                    │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  3. PA-API CLIENT (pa-api-client.js)                  │ │
│  │     - AWS Signature v4 auth                           │ │
│  │     - Batch requests (10 ASINs)                       │ │
│  │     - Rate limiting (1 req/sec)                       │ │
│  │     - Retry logic                                     │ │
│  │     - Extract product data                            │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  4. FEED GENERATOR (feed-generator.js)                │ │
│  │     - Format products                                 │ │
│  │     - Generate metadata                               │ │
│  │     - Output JSON                                     │ │
│  └──────────────────────┬────────────────────────────────┘ │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  5. SLACK NOTIFIER (slack-notifier.js)                │ │
│  │     - Format rich message                             │ │
│  │     - Top 5 products                                  │ │
│  │     - Performance stats                               │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────┬──────────────────────┬───────────────┐
│   JSON FEED FILES    │   SLACK CHANNEL      │  GOOGLE DRIVE │
│   /feeds/...         │   Notification       │   (Optional)  │
└──────────────────────┴──────────────────────┴───────────────┘
```

## Component Details

### 1. CSV Parser (`aa-csv-parser.js`)

**Purpose:** Parse Amazon Associates reports with flexible column detection

**Input:**
- CSV file or string content
- Column mappings configuration

**Processing:**
1. Parse CSV with PapaParse
2. Detect column names (case-insensitive)
3. Validate ASIN format (10 alphanumeric)
4. Extract metrics (ordered items, revenue, earnings, clicks)
5. Clean and normalize data types

**Output:**
```javascript
{
  success: true,
  products: [
    {
      asin: "B07PGL2ZSL",
      ordered_items: 156,
      shipped_revenue: 7794.44,
      earnings: 389.72,
      clicks: 2341
    }
  ],
  metadata: { totalRows, validProducts, uniqueAsins, ... }
}
```

**Error Handling:**
- Invalid ASINs → Skip row or log error
- Missing columns → Throw descriptive error
- Malformed data → Skip or coerce to 0

### 2. ASIN Aggregator (`asin-aggregator.js`)

**Purpose:** Aggregate duplicate ASINs and rank by performance

**Input:**
- Array of product objects from parser
- Ranking metric and options

**Processing:**
1. Group by ASIN (sum metrics for duplicates)
2. Calculate derived metrics:
   - Conversion rate = orders / clicks
   - Revenue per click = revenue / clicks
   - EPC = earnings / clicks
   - Average order value = revenue / orders
3. Sort by ranking metric
4. Assign rank positions
5. Select top N products

**Ranking Strategies:**
- `ordered_items` - Most purchased (default)
- `shipped_revenue` - Highest revenue
- `earnings` - Best commission
- `conversion_rate` - Best order rate
- `revenue_per_click` - Best RPC

**Output:**
```javascript
{
  success: true,
  products: [...], // Top N ranked products
  metadata: {
    totalProducts: 1234,
    returnedProducts: 100,
    rankingMetric: "ordered_items",
    summary: { totalRevenue, avgConversionRate, ... }
  }
}
```

### 3. PA-API Client (`pa-api-client.js`)

**Purpose:** Enrich ASINs with Amazon Product Advertising API

**Dependencies:**
- `aws-signature-v4.js` - Request signing
- `axios` - HTTP requests

**Authentication:**
- AWS Signature Version 4
- Components: AccessKey, SecretKey, Region, Service
- Timestamp-based signing
- HMAC-SHA256 signature

**Batching:**
- Max 10 ASINs per request (PA-API limit)
- Sequential processing (respect rate limits)
- 1.1 second delay between batches
- Progress logging

**API Request:**
```javascript
POST /paapi5/getitems
{
  ItemIds: ["B07PGL2ZSL", ...],
  PartnerTag: "mulapublisher-20",
  PartnerType: "Associates",
  Marketplace: "www.amazon.com",
  Resources: [
    "Images.Primary.Medium",
    "ItemInfo.Title",
    "Offers.Listings.Price",
    "Offers.Listings.Availability"
  ]
}
```

**Retry Logic:**
- 3 attempts with exponential backoff
- Initial delay: 1 second
- Backoff multiplier: 2x
- Continue on individual ASIN failures

**Extracted Data:**
- Title
- Price (amount + currency)
- Image URL (medium size)
- Availability status
- Affiliate link

**Output:**
```javascript
{
  success: true,
  products: [...], // Enriched products
  metadata: {
    totalAsins: 100,
    enrichedCount: 97,
    failedCount: 3,
    successRate: 0.97
  },
  failed: ["B0123...", ...],
  errors: [{ asin, code, message }, ...]
}
```

### 4. Feed Generator (`feed-generator.js`)

**Purpose:** Generate JSON product feeds with metadata

**Input:**
- Enriched products array
- Configuration options

**Processing:**
1. Format products for output
2. Add affiliate links with associate tag
3. Generate metadata file
4. Calculate summary statistics
5. Write JSON files (or return strings)

**Output Structure:**

**Feed File:** `/feeds/{publisher}/{credential}/YYYYMMDD/top-products.json`
```javascript
[
  {
    asin: "B07PGL2ZSL",
    title: "Echo Dot (3rd Gen)",
    price: 49.99,
    currency: "USD",
    image_url: "https://...",
    link: "https://amazon.com/dp/B07PGL2ZSL?tag=...",
    rank: 1,
    ordered_items: 156,
    shipped_revenue: 7794.44,
    earnings: 389.72,
    clicks: 2341,
    conversion_rate: 0.0666
  }
]
```

**Metadata File:** `top-products-meta.json`
```javascript
{
  generated_at: "2025-11-07T10:30:00Z",
  report_date: "2025-11-06",
  total_asins: 100,
  ranking_metric: "ordered_items",
  enrichment_success_rate: 0.97,
  summary: {
    total_revenue: 45234.56,
    total_earnings: 2261.73,
    average_price: 67.82
  }
}
```

### 5. Slack Notifier (`slack-notifier.js`)

**Purpose:** Send rich Slack notifications

**Message Types:**
- Success notification (with stats)
- Error notification (with details)
- Simple text message

**Slack Block Format:**
- Header with emoji (🎯 success / ❌ error)
- Summary fields (ASINs, enrichment rate)
- Top 5 products list
- Performance metrics (revenue, earnings)
- Feed location
- Processing time

**Rich Formatting:**
- Markdown for emphasis
- Code blocks for product lists
- Context sections for metadata
- Color-coded by status

### 6. AWS Signature V4 (`aws-signature-v4.js`)

**Purpose:** Sign PA-API requests

**Process:**
1. Create canonical request
   - Method, path, query string
   - Canonical headers
   - Payload hash
2. Create string to sign
   - Algorithm (AWS4-HMAC-SHA256)
   - Timestamp
   - Credential scope
   - Request hash
3. Calculate signing key
   - HMAC(date, HMAC(region, HMAC(service, secret)))
4. Generate signature
   - HMAC(signing_key, string_to_sign)
5. Build Authorization header

**Output:**
```javascript
{
  'content-encoding': 'amz-1.0',
  'content-type': 'application/json',
  'host': 'webservices.amazon.com',
  'x-amz-date': '20251107T103045Z',
  'Authorization': 'AWS4-HMAC-SHA256 Credential=...'
}
```

## Data Flow

### Complete Flow Example

```
1. AA Report CSV (1000 rows)
   └─> Parser extracts 980 valid products
       └─> Aggregator combines to 234 unique ASINs
           └─> Rank by ordered_items, select top 100
               └─> PA-API enriches in 10 batches
                   └─> 97 successful, 3 failed
                       └─> Feed generator creates JSON
                           └─> Slack notification sent
```

### Performance Characteristics

- **CSV Parsing:** <1 second for 10,000 rows
- **Aggregation:** <100ms for 1,000 ASINs
- **PA-API Enrichment:** ~11 seconds for 100 ASINs (10 batches × 1.1s)
- **Feed Generation:** <500ms
- **Slack Notification:** <1 second
- **Total:** ~15-20 seconds for 100-product feed

## Scalability Considerations

### Current Limits
- **PA-API Free Tier:** 8,640 requests/day (1 req/sec)
- **Pipedream Free Tier:** Unlimited workflows, 333 credits/month
- **Practical Limit:** ~860 ASINs/day (86 batches × 10 ASINs)

### Scaling Strategies
1. **Multiple Accounts:** Rotate PA-API credentials
2. **Caching:** Store product data, only re-enrich on changes
3. **Incremental Updates:** Only process new/changed ASINs
4. **Paid Tiers:** PA-API paid tier = 864,000 requests/day

## Security

### Credentials Storage
- **Pipedream:** Environment variables (encrypted at rest)
- **Local Development:** config.js (gitignored)
- **Never:** Hardcoded in source files

### Data Handling
- ASINs and public product data only
- No customer PII
- No order details beyond aggregates
- Temporary storage in Pipedream (cleared after run)

### API Security
- AWS Signature v4 (industry standard)
- HTTPS only
- Timestamp validation prevents replay attacks
- Scoped credentials (read-only PA-API access)

## Error Handling Strategy

### Levels
1. **Fail Fast:** Invalid config, missing credentials
2. **Skip and Log:** Invalid ASINs, malformed rows
3. **Retry:** PA-API errors, network failures
4. **Continue:** Individual ASIN enrichment failures
5. **Alert:** Low success rate (<95%), critical errors

### Recovery
- Partial results always returned
- Failed ASINs tracked for manual review
- Slack notifications include error details
- Pipedream execution logs for debugging

## Monitoring

### Success Metrics
- Enrichment success rate (target: 95%+)
- Processing time (target: <60s for 100 ASINs)
- Feed generation frequency (daily)

### Alert Conditions
- Enrichment rate <90%
- Processing time >120s
- PA-API authentication failures
- Missing required columns in CSV

## Future Architecture Changes

### Phase 2
- Add caching layer (Firestore or Redis)
- Support multiple marketplaces
- Implement incremental updates

### Phase 3
- Real-time API endpoint for feed access
- Webhook notifications beyond Slack
- Machine learning for product clustering
- A/B testing framework for ranking strategies

