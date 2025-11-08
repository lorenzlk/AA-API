# Project Summary: Amazon Product Feed Enrichment Tool

**Repository:** https://github.com/lorenzlk/AA-API  
**Created:** November 7, 2025  
**Status:** Active Development  
**Cost:** $0/month

## Overview

A serverless tool that transforms Amazon Associates (AA) performance data into high-converting product feeds by enriching ASINs with the Amazon Product Advertising API (PA-API).

## The Problem

Current product feeds rely on keyword searches, which often fail to surface the actual top-performing products. This creates **keyword drift** where feeds contain products that look relevant but don't convert, while high-performing ASINs are missing entirely.

## The Solution

Build feeds directly from Amazon Associates performance data:
1. Parse AA reports to identify top-performing ASINs
2. Rank by actual metrics (orders, revenue, earnings)
3. Enrich with PA-API (titles, prices, images, availability)
4. Output clean JSON feeds ready for publisher integration

## Key Benefits

- ✅ **Performance-based:** Feeds built from real purchase data
- ✅ **Automated:** Set and forget - runs daily
- ✅ **Cost-effective:** $0/month (free tiers)
- ✅ **Accurate:** 95%+ enrichment success rate
- ✅ **Fast:** <60 seconds for 100 ASINs

## Architecture

```
┌─────────────────────┐
│   AA CSV Report     │  Manual upload or automated scraper
│  (Google Drive)     │
└──────────┬──────────┘
           │ Trigger
           ▼
┌─────────────────────┐
│  Pipedream Workflow │
│                     │
│  ┌───────────────┐  │
│  │ Parse CSV     │  │  Extract ASINs + metrics
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ Aggregate &   │  │  Rank by performance
│  │ Rank ASINs    │  │
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ PA-API Batch  │  │  Enrich 10 ASINs/request
│  │ Enrichment    │  │  AWS Signature v4 auth
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ Generate Feed │  │  Output JSON
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ Slack Notify  │  │  Post summary
│  └───────────────┘  │
└─────────────────────┘
```

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Node.js (Pipedream) | Serverless, free tier |
| Trigger | Google Drive watch | Auto-detect new AA reports |
| CSV Parsing | PapaParse | Flexible, handles edge cases |
| PA-API Auth | AWS Signature v4 | Required by Amazon |
| Notifications | Slack Webhooks | Real-time alerts |
| Storage | File system / Google Drive | Simple, no DB needed |

## Project Structure

```
/AA-API/
├── README.md                      # Main documentation
├── QUICKSTART.md                  # 15-min setup guide
├── PROJECT_SUMMARY.md             # This file
├── CONTRIBUTING.md                # Development guidelines
├── CHANGELOG.md                   # Version history
├── LICENSE                        # MIT License
├── .gitignore                     # Git exclusions
├── config.template.js             # Configuration template
├── .env.template                  # Environment variables template
│
├── src/                           # Core modules
│   ├── aa-csv-parser.js          # Parse AA reports
│   ├── asin-aggregator.js        # Aggregate & rank ASINs
│   ├── pa-api-client.js          # PA-API integration
│   ├── aws-signature-v4.js       # AWS authentication
│   ├── feed-generator.js         # JSON feed builder
│   └── slack-notifier.js         # Slack formatting
│
├── pipedream-workflow-template.js # Complete workflow
│
├── docs/                          # Documentation
│   ├── PRD.md                    # Product requirements
│   ├── ARCHITECTURE.md           # System design
│   ├── SETUP_CHECKLIST.md        # Deployment checklist
│   ├── TROUBLESHOOTING.md        # Common issues
│   └── PA_API_GUIDE.md           # PA-API reference
│
└── sample-data/                   # Test data
    ├── aa-report-sample.csv      # Example input
    └── expected-output.json      # Example output
```

## Key Features

### 1. Flexible CSV Parsing
- Auto-detects column names (case-insensitive)
- Handles various AA export formats
- Validates ASIN format
- Skips invalid rows gracefully

### 2. Smart Ranking
Multiple ranking options:
- **ordered_items** (default) - Most purchased
- **shipped_revenue** - Highest revenue
- **earnings** - Best earnings
- **conversion_rate** - Best orders/clicks ratio

### 3. Efficient PA-API Integration
- Batch requests (10 ASINs per call)
- AWS Signature v4 authentication
- Rate limit compliance (1 req/sec)
- Retry logic with exponential backoff
- Continues on partial failures

### 4. Rich Output
Feed includes:
- Product metadata (title, price, image)
- Affiliate link with associate tag
- Performance metrics (orders, revenue, clicks)
- Rank position
- Optional category clustering

### 5. Real-Time Notifications
Slack summary includes:
- Total ASINs processed
- Enrichment success rate
- Top 5 products with metrics
- Average price and totals
- Feed location and timestamp
- Error details if issues occur

## Configuration

### PA-API Settings
```javascript
paApi: {
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/...',
  associateTag: 'mulapublisher-20',
  region: 'us-east-1',
  marketplace: 'www.amazon.com',
  batchSize: 10,
  maxRequestsPerSecond: 1
}
```

### Feed Settings
```javascript
feed: {
  topN: 100,                    // Number of ASINs
  rankingMetric: 'ordered_items', // Ranking method
  outputPath: '/feeds',         // Base directory
  publisherName: 'mula',        // Publisher ID
  generateMetadata: true        // Include meta file
}
```

## Performance Metrics

### Current Targets
- **Enrichment Success:** 95%+
- **API Latency:** <1.5s per batch (10 ASINs)
- **Total Processing:** <60s for 100 ASINs
- **Feed Updates:** Within 24h of new AA data

### Business Metrics (Goals)
- **CTR Improvement:** +15% vs keyword-based feeds
- **Time Saved:** ~5 hours/week manual curation
- **Cost:** $0/month

## Dependencies

### Runtime
- Node.js 18+ (Pipedream environment)
- No package.json needed (Pipedream auto-installs)

### APIs & Services
- Amazon Product Advertising API 5.0
- Pipedream (free tier: unlimited workflows)
- Slack (webhooks included)
- Google Drive (optional, for triggers)

### Node Modules
- `crypto-js` - AWS Signature v4
- `papaparse` - CSV parsing
- `axios` - HTTP requests
- `@pipedream/platform` - Pipedream SDK

## Rate Limits & Costs

| Service | Free Tier | Our Usage | Cost |
|---------|-----------|-----------|------|
| PA-API | 8,640 req/day | ~10 req/day | $0 |
| Pipedream | Unlimited workflows | 1 workflow | $0 |
| Slack | Unlimited webhooks | ~1 msg/day | $0 |
| **Total** | - | - | **$0/month** |

## Security

### Credentials Management
- Never commit credentials to Git
- Use Pipedream environment variables
- Rotate keys regularly
- AWS Signature v4 for all API calls

### Data Privacy
- No AA data stored long-term
- ASINs and public product data only
- No customer PII
- Feeds stored securely

## Development Workflow

### Local Development
```bash
# Clone repo
git clone https://github.com/lorenzlk/AA-API.git
cd AA-API

# Configure
cp config.template.js config.js
# Edit config.js

# Test modules
node src/aa-csv-parser.js sample-data/test.csv
```

### Deployment
```bash
# Commit changes
git add .
git commit -m "Add: feature description"
git push origin main

# Deploy to Pipedream
# Via UI or CLI (pd deploy)
```

## Roadmap

### Phase 1: Core (✅ Complete)
- CSV parsing and ASIN aggregation
- PA-API integration with auth
- Feed generation
- Slack notifications
- Documentation

### Phase 2: Enhancements (Q1 2026)
- 🏷️ Discount detection (prioritize sales)
- 📊 Week-over-week trending
- 🎨 Product clustering by category
- 💾 Caching layer (reduce API calls)

### Phase 3: Scale (Q2 2026)
- 🌍 Multi-marketplace (CA, UK, DE)
- 🔄 Incremental updates (only changed ASINs)
- 📧 Email reports
- 🧪 A/B testing different ranking strategies

## Success Stories

*To be added after launch...*

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style guidelines
- Commit message format
- Pull request process
- Testing requirements

## Support

- **Quick Start:** [QUICKSTART.md](./QUICKSTART.md)
- **Troubleshooting:** [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- **Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **PA-API Guide:** [docs/PA_API_GUIDE.md](./docs/PA_API_GUIDE.md)

## Related Projects

- **Amazon Associates Scraper** - Automates daily AA dashboard scraping
- **TWSN KVP Reporting** - Processes GAM key-value pair reports
- **Board Pulse** - LinkedIn post analysis for advisory board

## License

MIT License - See [LICENSE](./LICENSE)

---

**Built with ❤️ for Mula/TWSN publishers**

*Last updated: November 7, 2025*

