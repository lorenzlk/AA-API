# Amazon Product Feed Enrichment Tool

**Transform Amazon Associates performance data into high-converting product feeds**

## Overview

This tool eliminates keyword drift by building product feeds directly from your Amazon Associates (AA) ASIN performance data. It enriches ASINs via the Amazon Product Advertising API (PA-API) and outputs clean, JSON-ready feeds for publisher integration.

## Key Features

- 📊 **Performance-Based**: Feeds built from actual purchase data, not keyword guesses
- 🔄 **Automated Enrichment**: Fetches product details, pricing, and images via PA-API
- 🎯 **Smart Ranking**: Rank by ordered items, revenue, or custom metrics
- 📦 **Batch Processing**: Efficient PA-API calls (10 ASINs per request)
- 🔔 **Slack Notifications**: Real-time feed generation summaries
- 💰 **Cost Effective**: ~$0/month (Pipedream free tier + existing PA-API access)

## How It Works

```
AA CSV Report → Parse ASINs → Aggregate & Rank → Enrich via PA-API → Generate JSON Feed → Slack Alert
```

1. **Import AA Data**: Parse CSV with ASIN, Ordered Items, Shipped Revenue, Earnings, Clicks
2. **Aggregate & Rank**: Group by ASIN, rank by performance (default: ordered items)
3. **Enrich Products**: Batch fetch titles, prices, images, availability via PA-API
4. **Generate Feeds**: Output ranked JSON feeds organized by publisher/credential/date
5. **Notify Team**: Post summary to Slack with top performers and stats

## Quick Start

```bash
# 1. Clone and setup
cd "AA Api"

# 2. Configure credentials (copy from template)
cp config.template.js config.js
# Edit config.js with your PA-API credentials

# 3. Deploy to Pipedream
# - Import pipedream-workflow-template.js
# - Connect Google Drive trigger (for AA CSV uploads)
# - Add Slack webhook
# - Test with sample AA report

# 4. Upload AA CSV to trigger folder
# Feed generation happens automatically!
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed 15-minute setup guide.

## Project Structure

```
/AA Api/
├── README.md                          # This file
├── QUICKSTART.md                      # 15-min setup guide
├── PROJECT_SUMMARY.md                 # Technical overview
├── config.template.js                 # Credentials template
├── src/
│   ├── aa-csv-parser.js              # Parse Amazon Associates reports
│   ├── asin-aggregator.js            # Aggregate and rank ASINs
│   ├── pa-api-client.js              # Amazon PA-API integration
│   ├── aws-signature-v4.js           # AWS auth for PA-API
│   ├── feed-generator.js             # JSON feed builder
│   └── slack-notifier.js             # Slack message formatter
├── pipedream-workflow-template.js     # Complete Pipedream workflow
├── docs/
│   ├── PRD.md                        # Product Requirements
│   ├── ARCHITECTURE.md               # System design
│   ├── SETUP_CHECKLIST.md            # Deployment checklist
│   ├── TROUBLESHOOTING.md            # Common issues
│   └── PA_API_GUIDE.md               # PA-API reference
└── sample-data/
    ├── aa-report-sample.csv          # Example AA export
    └── expected-output.json          # Example feed output
```

## Output Format

Feeds are saved as: `/feeds/{publisher}/{credential}/YYYYMMDD/top-products.json`

```json
[
  {
    "asin": "B07PGL2ZSL",
    "title": "Echo Dot (3rd Gen)",
    "price": 49.99,
    "currency": "USD",
    "image_url": "https://m.media-amazon.com/images/I/...",
    "link": "https://www.amazon.com/dp/B07PGL2ZSL?tag=mulapublisher-20",
    "rank": 1,
    "ordered_items": 156,
    "shipped_revenue": 7794.44,
    "earnings": 389.72,
    "clicks": 2341
  }
]
```

## Success Metrics

- ✅ 95% ASIN enrichment success rate
- ⚡ <1.5s avg API latency per batch
- 🕐 Feeds updated within 24h of new AA data
- 📈 +15% CTR vs. keyword-based feeds (target)

## Requirements

- Amazon Product Advertising API credentials (AccessKey, SecretKey, AssociateTag)
- Pipedream account (free tier)
- Slack webhook for notifications
- Google Drive for AA CSV storage (optional, can use other triggers)

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 15 minutes
- **[docs/PRD.md](./docs/PRD.md)** - Full product requirements
- **[docs/SETUP_CHECKLIST.md](./docs/SETUP_CHECKLIST.md)** - Pre-deployment checklist
- **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues and fixes
- **[docs/PA_API_GUIDE.md](./docs/PA_API_GUIDE.md)** - PA-API integration details

## Future Enhancements

- 🏷️ Discount-based ranking (prioritize sale items)
- 🌍 Multi-marketplace support (CA, UK, DE)
- 📊 Week-over-week trending analysis
- 💾 Firestore/Sheets caching layer
- 🎨 Product clustering by category
- 🔍 Automatic category detection

## Support

For issues or questions, check [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) or review Pipedream execution logs.

## License

Internal use only - Mula/TWSN


## Supported File Formats

The tool supports multiple Amazon Associates report formats:

- ✅ **CSV** (.csv) - Standard comma-separated values
- ✅ **XLSX** (.xlsx) - Excel 2007+ format
- ✅ **XLS** (.xls) - Excel 97-2003 format

The parser automatically detects the format and handles all the same way. Just upload your AA report in any of these formats!

```bash
# Works with any format
node src/aa-csv-parser.js your-report.csv
node src/aa-csv-parser.js your-report.xlsx
```

See [sample-data/SUPPORTED_FORMATS.md](./sample-data/SUPPORTED_FORMATS.md) for details.
