# Product Requirements Document: Amazon Product Feed Enrichment Tool

**Version:** 1.0  
**Date:** November 7, 2025  
**Status:** Implementation Phase

## Executive Summary

Our current Amazon product feeds rely on keyword-based searches, which often mismatch the top-performing products from Amazon Associates (AA) reports. This tool will build feeds directly from ASIN performance data, enriching them via the Product Advertising API (PA-API) and outputting clean, JSON-ready feeds for publisher integration.

## Problem Statement

### Current State
- Product feeds generated using keyword searches
- Keyword drift causes misalignment with actual high-performing products
- Manual feed curation is time-consuming and error-prone
- No direct connection between AA performance data and published feeds

### Pain Points
1. Top revenue-generating ASINs not appearing in feeds
2. Keyword searches return irrelevant or low-performing products
3. Feed refresh cycles disconnected from performance data
4. Limited product metadata quality

## Goals & Objectives

### Primary Goal
Eliminate keyword drift and produce high-converting, automatically refreshed feeds based on real purchase data.

### Success Metrics
| Metric | Target | Current |
|--------|--------|---------|
| ASIN Enrichment Success Rate | 95% | N/A |
| Average API Latency | <1.5s per batch | N/A |
| Feed Update Frequency | Within 24h of new AA data | Manual |
| CTR Improvement | +15% vs keyword feeds | Baseline TBD |

### Business Impact
- Higher CTR → More clicks → More revenue
- Automated process saves ~5 hours/week
- Data-driven feed composition
- Scalable to multiple publishers/accounts

## Solution Overview

### High-Level Process

```
┌─────────────────┐
│  AA CSV Report  │
│  (Manual/Auto)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse ASINs    │
│  + Metrics      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Aggregate &     │
│ Rank ASINs      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Enrich via      │
│ PA-API (Batch)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate JSON   │
│ Feed Output     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Slack Notify    │
└─────────────────┘
```

## Detailed Requirements

### 1. Data Ingestion

**Input: Amazon Associates CSV Report**

Required columns:
- `ASIN` - Product identifier
- `Ordered Items` - Number of items purchased
- `Shipped Revenue` - Total revenue from shipped items
- `Earnings` - Publisher earnings
- `Clicks` - Number of clicks

**Acceptance Criteria:**
- ✅ Parse CSV with flexible column ordering
- ✅ Handle missing/malformed ASINs gracefully
- ✅ Support both manual upload and automated AA scraper output
- ✅ Validate data types (numeric fields, ASIN format)

### 2. Aggregation & Ranking

**Process:**
- Group by ASIN (deduplicate multiple entries)
- Sum metrics: ordered_items, shipped_revenue, earnings, clicks
- Rank by configurable metric (default: ordered_items)
- Select top N ASINs (default: 100)

**Ranking Options:**
1. `ordered_items` - Most purchased (default)
2. `shipped_revenue` - Highest revenue
3. `earnings` - Best earnings
4. `conversion_rate` - Best orders/clicks ratio

**Acceptance Criteria:**
- ✅ Accurate aggregation across duplicate ASINs
- ✅ Configurable ranking metric
- ✅ Configurable output size (top N)
- ✅ Handle edge cases (ties, zero values)

### 3. PA-API Enrichment

**API Details:**
- Endpoint: `https://webservices.amazon.com/paapi5/getitems`
- Authentication: AWS Signature Version 4
- Rate Limits: 1 request/second (free tier)
- Batch Size: 10 ASINs per request

**Resources Requested:**
```javascript
[
  "Images.Primary.Medium",
  "ItemInfo.Title",
  "Offers.Listings.Price",
  "Offers.Listings.Availability"
]
```

**Enrichment Fields:**
- `title` - Product name
- `price` - Current price (numeric)
- `currency` - Price currency (USD, etc.)
- `image_url` - Primary product image (medium size)
- `availability` - In stock status

**Error Handling:**
- Invalid ASINs → Skip and log
- API errors → Retry with exponential backoff (3 attempts)
- Rate limiting → Respect 1req/sec limit with delays
- Partial batch failures → Continue with available data

**Acceptance Criteria:**
- ✅ Batch requests (10 ASINs/request)
- ✅ Proper AWS Signature v4 authentication
- ✅ Retry logic with exponential backoff
- ✅ 95%+ successful enrichment rate
- ✅ <1.5s average latency per batch
- ✅ Graceful handling of unavailable products

### 4. Feed Generation

**Output Format:** JSON

**File Path Structure:**
```
/feeds/{publisher}/{credential}/YYYYMMDD/top-products.json
```

**Feed Schema:**
```json
[
  {
    "asin": "B07PGL2ZSL",
    "title": "Echo Dot (3rd Gen) - Smart speaker with Alexa",
    "price": 49.99,
    "currency": "USD",
    "image_url": "https://m.media-amazon.com/images/I/61ED3wKMp9L._AC_SL1000_.jpg",
    "link": "https://www.amazon.com/dp/B07PGL2ZSL?tag=mulapublisher-20",
    "rank": 1,
    "ordered_items": 156,
    "shipped_revenue": 7794.44,
    "earnings": 389.72,
    "clicks": 2341,
    "conversion_rate": 0.0666,
    "cluster": "home"
  }
]
```

**Metadata File:** `top-products-meta.json`
```json
{
  "generated_at": "2025-11-07T10:30:00Z",
  "report_date": "2025-11-06",
  "total_asins": 100,
  "enrichment_success_rate": 0.97,
  "ranking_metric": "ordered_items",
  "publisher": "mula",
  "associate_tag": "mulapublisher-20"
}
```

**Acceptance Criteria:**
- ✅ Valid JSON output
- ✅ Organized by publisher/credential/date
- ✅ Includes performance metrics alongside enrichment data
- ✅ Affiliate links with correct associate tag
- ✅ Metadata file for tracking

### 5. Notifications

**Slack Message Format:**

```
🎯 Feed Generated Successfully

📊 Summary
• Total ASINs: 100
• Enriched: 97 (97%)
• Failed: 3
• Report Date: Nov 6, 2025

🏆 Top 5 Products
1. Echo Dot (3rd Gen) - $49.99 (156 orders)
2. Fire TV Stick 4K - $39.99 (142 orders)
3. Kindle Paperwhite - $129.99 (128 orders)
4. Ring Video Doorbell - $99.99 (118 orders)
5. Blink Mini Camera - $34.99 (112 orders)

💰 Performance
• Avg Price: $67.82
• Total Revenue: $45,234.56
• Total Earnings: $2,261.73

📂 Feed Location
/feeds/mula/primary/20251106/top-products.json

⏱️ Processing Time: 12.3s
```

**Acceptance Criteria:**
- ✅ Real-time notification on completion
- ✅ Summary stats (total, success rate, errors)
- ✅ Top 5 products with key metrics
- ✅ Average price and totals
- ✅ Feed location and timestamp
- ✅ Error details if enrichment <95%

## Technical Specifications

### Technology Stack
- **Runtime:** Node.js (Pipedream environment)
- **Trigger:** Google Drive file upload OR manual execution
- **API:** Amazon Product Advertising API 5.0
- **Auth:** AWS Signature Version 4
- **Notifications:** Slack Webhook
- **Storage:** Pipedream data stores OR Google Drive

### Dependencies
- `crypto-js` - AWS Signature v4 generation
- `papaparse` - CSV parsing
- `axios` - HTTP requests

### Configuration
```javascript
{
  // PA-API Credentials (single seat)
  pa_api: {
    access_key: "AKIAIOSFODNN7EXAMPLE",
    secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    associate_tag: "mulapublisher-20",
    region: "us-east-1",
    marketplace: "www.amazon.com"
  },
  
  // Feed Settings
  feed: {
    top_n: 100,
    ranking_metric: "ordered_items",
    output_path: "/feeds"
  },
  
  // Slack
  slack_webhook_url: "https://hooks.slack.com/services/..."
}
```

### Rate Limits & Costs
- **PA-API Free Tier:** 8,640 requests/day (1 req/sec)
- **Our Usage:** ~10 requests/day (100 ASINs ÷ 10 per batch)
- **Pipedream:** Free tier (sufficient for daily feeds)
- **Total Cost:** $0/month

## Non-Functional Requirements

### Performance
- Feed generation completes in <60 seconds for 100 ASINs
- 95%+ uptime
- Handles up to 500 ASINs per run

### Reliability
- Retry failed API calls (3 attempts)
- Continue processing if individual ASINs fail
- Log all errors for debugging

### Security
- PA-API credentials stored in Pipedream secrets
- No credentials in code or logs
- AWS Signature v4 for all API requests

### Maintainability
- Modular code structure (separate files per function)
- Comprehensive error logging
- Clear variable naming and comments
- Documentation for all modules

## Future Enhancements

### Phase 2 (Q1 2026)
- 🏷️ **Discount Detection:** Prioritize products on sale
- 📊 **Trending Analysis:** Week-over-week performance changes
- 🎨 **Smart Clustering:** Auto-categorize products (home, electronics, etc.)

### Phase 3 (Q2 2026)
- 🌍 **Multi-Marketplace:** Support CA, UK, DE, JP
- 💾 **Caching Layer:** Firestore or Google Sheets for product data
- 🔄 **Incremental Updates:** Only re-enrich changed ASINs
- 📧 **Email Reports:** Alternative to Slack notifications

### Backlog Ideas
- API endpoint for real-time feed access
- Publisher-specific filtering rules
- Price drop alerts
- Inventory monitoring
- A/B testing different ranking strategies

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| PA-API rate limiting | High | Medium | Implement 1req/sec throttling, use batch requests |
| Invalid ASINs from AA reports | Medium | Medium | Validate ASIN format, skip invalid, log errors |
| PA-API credential expiration | High | Low | Monitor error rates, alert on auth failures |
| CSV format changes | Medium | Low | Flexible column parsing, validate headers |

## Success Criteria

### Launch Checklist
- [ ] All modules tested with sample data
- [ ] Pipedream workflow deployed and tested
- [ ] PA-API credentials validated
- [ ] Slack notifications working
- [ ] Documentation complete
- [ ] Error handling verified
- [ ] Sample feed generated successfully

### Post-Launch (Week 1)
- [ ] 95%+ enrichment success rate
- [ ] Zero credential/auth errors
- [ ] Feeds updating daily
- [ ] Slack notifications reliable

### Post-Launch (Month 1)
- [ ] +10% CTR improvement demonstrated
- [ ] Zero critical bugs
- [ ] Positive team feedback
- [ ] Consider phase 2 features

## Appendix

### Sample AA CSV Structure
```csv
ASIN,Ordered Items,Shipped Revenue,Earnings,Clicks
B07PGL2ZSL,156,7794.44,389.72,2341
B079QHML21,142,5680.00,284.00,1998
B07WMLJ8TG,128,16639.72,831.99,2876
```

### Sample PA-API Response
```json
{
  "ItemsResult": {
    "Items": [
      {
        "ASIN": "B07PGL2ZSL",
        "DetailPageURL": "https://www.amazon.com/dp/B07PGL2ZSL?tag=mulapublisher-20",
        "Images": {
          "Primary": {
            "Medium": {
              "URL": "https://m.media-amazon.com/images/I/61ED3wKMp9L._AC_SL1000_.jpg"
            }
          }
        },
        "ItemInfo": {
          "Title": {
            "DisplayValue": "Echo Dot (3rd Gen)"
          }
        },
        "Offers": {
          "Listings": [
            {
              "Price": {
                "Amount": 49.99,
                "Currency": "USD"
              },
              "Availability": {
                "Type": "Now"
              }
            }
          ]
        }
      }
    ]
  }
}
```

## Approval

**Product Owner:** [Name]  
**Engineering Lead:** [Name]  
**Approved Date:** [Date]

