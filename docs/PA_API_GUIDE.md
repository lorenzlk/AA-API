# Amazon Product Advertising API (PA-API) Guide

Complete guide to PA-API 5.0 integration for the Amazon Product Feed Enrichment Tool.

## Overview

The Amazon Product Advertising API allows developers to access Amazon product data programmatically. This tool uses the **GetItems** operation to enrich ASINs with product details.

## Getting Access

### 1. Prerequisites
- Active Amazon Associates account
- At least 3 qualifying sales in the last 180 days (for most markets)
- US Associates: Immediate access
- Other markets: May require approval

### 2. Request Access

1. Visit https://affiliate-program.amazon.com/assoc_credentials/home
2. Navigate to **Tools** → **Product Advertising API**
3. Click **Add to Account**
4. Accept terms and conditions
5. Wait for approval (24-48 hours typically)

### 3. Get Credentials

Once approved:
1. Go to https://affiliate-program.amazon.com/assoc_credentials/home
2. Find **Product Advertising API** section
3. Note your:
   - **Access Key** (e.g., `AKIAI44QH8DHBEXAMPLE`)
   - **Secret Key** (click "Show" to reveal)
   - **Associate Tag** (e.g., `mulapublisher-20`)

## PA-API 5.0 Basics

### Endpoint

```
https://webservices.amazon.com/paapi5/getitems
```

### Marketplaces

| Marketplace | Host | Region |
|-------------|------|--------|
| United States | webservices.amazon.com | us-east-1 |
| United Kingdom | webservices.amazon.co.uk | eu-west-1 |
| Germany | webservices.amazon.de | eu-west-1 |
| France | webservices.amazon.fr | eu-west-1 |
| Japan | webservices.amazon.co.jp | us-west-2 |
| Canada | webservices.amazon.ca | us-east-1 |

### Authentication

**Method:** AWS Signature Version 4

**Headers Required:**
- `Authorization` - AWS4-HMAC-SHA256 signature
- `x-amz-date` - ISO 8601 timestamp
- `host` - API hostname
- `content-type` - `application/json; charset=utf-8`
- `content-encoding` - `amz-1.0`

**Signing Process:**
1. Create canonical request
2. Create string to sign
3. Calculate signing key
4. Calculate signature
5. Build Authorization header

See `src/aws-signature-v4.js` for implementation.

## GetItems Operation

### Request Format

```json
POST /paapi5/getitems
{
  "ItemIds": ["B07PGL2ZSL", "B079QHML21"],
  "PartnerTag": "mulapublisher-20",
  "PartnerType": "Associates",
  "Marketplace": "www.amazon.com",
  "Resources": [
    "Images.Primary.Medium",
    "ItemInfo.Title",
    "Offers.Listings.Price"
  ]
}
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `ItemIds` | Yes | Array of ASINs (max 10) |
| `PartnerTag` | Yes | Your Associate Tag |
| `PartnerType` | Yes | Always "Associates" |
| `Marketplace` | Yes | Target marketplace domain |
| `Resources` | Yes | Data resources to return |

### Resources

Common resources for product feeds:

**Images:**
- `Images.Primary.Small` - Small product image
- `Images.Primary.Medium` - Medium product image (recommended)
- `Images.Primary.Large` - Large product image

**Product Info:**
- `ItemInfo.Title` - Product title
- `ItemInfo.Features` - Bullet points
- `ItemInfo.ByLineInfo` - Brand, manufacturer
- `ItemInfo.ProductInfo` - Dimensions, weight

**Pricing:**
- `Offers.Listings.Price` - Current price
- `Offers.Listings.SavingBasis` - Original price (if on sale)
- `Offers.Listings.Availability` - In stock status

**Browse Node:**
- `BrowseNodeInfo.BrowseNodes` - Category information
- `BrowseNodeInfo.WebsiteSalesRank` - Sales rank

**Full list:** https://webservices.amazon.com/paapi5/documentation/get-items.html#resources-parameter

### Response Format

**Success (200):**
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
              "URL": "https://m.media-amazon.com/images/I/61ED3wKMp9L._AC_SL1000_.jpg",
              "Height": 1000,
              "Width": 1000
            }
          }
        },
        "ItemInfo": {
          "Title": {
            "DisplayValue": "Echo Dot (3rd Gen) - Smart speaker with Alexa - Charcoal"
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

**Partial Success (some ASINs failed):**
```json
{
  "ItemsResult": {
    "Items": [...],  // Successful items
  },
  "Errors": [
    {
      "Code": "ItemNotAccessible",
      "Message": "The item is not accessible through the Product Advertising API.",
      "ASIN": "B0INVALIDASIN"
    }
  ]
}
```

**Failure (4xx/5xx):**
```json
{
  "Errors": [
    {
      "Code": "InvalidClientTokenId",
      "Message": "The security token included in the request is invalid."
    }
  ]
}
```

## Rate Limits

### Free Tier
- **Limit:** 1 request per second (8,640 requests/day)
- **Calculation:** Based on PA-API calls, not individual ASINs
- **Enforcement:** Rolling window (not reset at midnight)

### Paid Tier
- **Limit:** 100 requests per second (8,640,000 requests/day)
- **Cost:** Based on request volume
- **Upgrade:** Contact Amazon Associates support

### Best Practices

1. **Batch requests:** Always send 10 ASINs per request (max allowed)
2. **Respect limits:** Wait 1+ second between requests
3. **Monitor usage:** Track requests in your analytics
4. **Handle throttling:** Implement exponential backoff on 429 errors
5. **Cache results:** Don't re-fetch static data frequently

## Error Codes

### Common Errors

| Code | Meaning | Solution |
|------|---------|----------|
| `InvalidClientTokenId` | Invalid Access Key | Verify credentials |
| `SignatureDoesNotMatch` | Signature error | Check Secret Key and signing process |
| `TooManyRequests` | Rate limit exceeded | Slow down, implement backoff |
| `ItemNotAccessible` | ASIN not available | Skip this ASIN |
| `InvalidPartnerTag` | Invalid Associate Tag | Verify tag is correct |
| `InvalidParameterValue` | Bad request parameter | Check ItemIds format |
| `ResourceNotFound` | Invalid resource name | Verify Resources array |
| `Unauthorized` | Authentication failed | Check credentials and signature |

### Error Handling Strategy

```javascript
try {
  const response = await paApiClient.getItems(asins);
  // Process successful items
} catch (error) {
  if (error.code === 'TooManyRequests') {
    // Wait and retry
    await delay(2000);
    return retry();
  } else if (error.code === 'ItemNotAccessible') {
    // Skip this ASIN
    return null;
  } else {
    // Log and alert
    console.error('PA-API error:', error);
    sendAlert(error);
  }
}
```

## Usage in This Tool

### Workflow

1. **Aggregate ASINs** from AA report
2. **Rank and filter** to top N (default 100)
3. **Batch into groups of 10**
4. **Send PA-API requests** sequentially with 1.1s delay
5. **Extract product data** from responses
6. **Merge with performance metrics**
7. **Generate feed**

### Configuration

```javascript
// In config.js
paApi: {
  accessKey: 'YOUR_ACCESS_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  associateTag: 'yourtag-20',
  region: 'us-east-1',
  marketplace: 'www.amazon.com',
  endpoint: 'https://webservices.amazon.com/paapi5/getitems',
  resources: [
    'Images.Primary.Medium',
    'ItemInfo.Title',
    'Offers.Listings.Price',
    'Offers.Listings.Availability',
  ],
  batchSize: 10,
  maxRequestsPerSecond: 1,
  retryAttempts: 3,
}
```

### Performance

**For 100 ASINs:**
- Batches: 10 (100 ÷ 10)
- Delays: 9 × 1.1s = 9.9s
- Request time: ~1-2s per batch = 10-20s
- **Total:** ~20-30s for enrichment step

## Testing PA-API Access

### Quick Test

```bash
# Using our tool
node src/pa-api-client.js B07PGL2ZSL

# Expected output:
# ✅ Enrichment complete: 1/1 successful
# 1. Echo Dot (3rd Gen)
#    ASIN: B07PGL2ZSL
#    Price: USD 49.99
```

### Manual Test with curl

```bash
# This is complex due to AWS Signature v4
# Use the tool instead, or test in Pipedream
```

### Validate Credentials

1. Visit https://affiliate-program.amazon.com/assoc_credentials/home
2. Check "Product Advertising API" status
3. Verify it says "Approved" or "Active"
4. Test with a known-good ASIN (e.g., B07PGL2ZSL)

## Multi-Marketplace Support (Future)

To support multiple marketplaces:

```javascript
const MARKETPLACES = {
  US: {
    host: 'webservices.amazon.com',
    region: 'us-east-1',
    domain: 'www.amazon.com',
  },
  UK: {
    host: 'webservices.amazon.co.uk',
    region: 'eu-west-1',
    domain: 'www.amazon.co.uk',
  },
  // ... more marketplaces
};

// Use different associate tags per marketplace
const ASSOCIATE_TAGS = {
  US: 'mulapublisher-20',
  UK: 'mulapublisher-21',
};
```

## Best Practices

### 1. Credential Security
- ✅ Store in environment variables
- ✅ Never commit to Git
- ✅ Rotate periodically
- ❌ Don't hardcode in source
- ❌ Don't share in screenshots/logs

### 2. Request Efficiency
- ✅ Always batch 10 ASINs per request
- ✅ Only request resources you need
- ✅ Cache results when appropriate
- ❌ Don't make individual ASIN requests
- ❌ Don't request all resources

### 3. Error Handling
- ✅ Handle partial batch failures
- ✅ Retry transient errors
- ✅ Log all errors for debugging
- ✅ Continue processing on individual ASIN failures
- ❌ Don't fail entire feed on one ASIN

### 4. Monitoring
- Track enrichment success rate
- Monitor PA-API response times
- Log rate limit errors
- Alert on authentication failures

## Resources

### Official Documentation
- PA-API 5.0 Docs: https://webservices.amazon.com/paapi5/documentation/
- GetItems Reference: https://webservices.amazon.com/paapi5/documentation/get-items.html
- AWS Signature v4: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

### Associate Program
- Central: https://affiliate-program.amazon.com/
- Credentials: https://affiliate-program.amazon.com/assoc_credentials/home
- Forums: https://amazonforum.com/

### Tools
- Block Kit Builder: https://app.slack.com/block-kit-builder (for Slack messages)
- ASIN Lookup: Use Amazon search or existing feeds
- JSON Validator: https://jsonlint.com/

---

**Last Updated:** November 7, 2025

Questions? Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue on GitHub.

