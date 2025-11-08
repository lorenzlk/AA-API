# Changelog

All notable changes to the Amazon Product Feed Enrichment Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Discount-based ranking (prioritize sale items)
- Multi-marketplace support (CA, UK, DE)
- Week-over-week trending analysis
- Firestore/Sheets caching layer
- Product clustering by category

## [1.0.0] - 2025-11-07

### Added
- Initial release of Amazon Product Feed Enrichment Tool
- AA CSV parser with flexible column detection
- ASIN aggregator with multiple ranking metrics (ordered_items, revenue, earnings)
- PA-API client with AWS Signature v4 authentication
- Batch processing (10 ASINs per request)
- Feed generator with JSON output
- Slack notifications with top 5 products and stats
- Retry logic with exponential backoff
- Error handling and logging
- Comprehensive documentation (README, PRD, QUICKSTART)
- Configuration templates (config.template.js, .env.template)
- Sample data for testing
- Pipedream workflow template

### Configuration
- Support for single PA-API credential seat
- Configurable ranking metrics
- Configurable feed size (default: 100 ASINs)
- Rate limiting compliance (1 req/sec)

### Documentation
- README.md with quick start guide
- docs/PRD.md with full requirements
- docs/ARCHITECTURE.md for system design
- docs/SETUP_CHECKLIST.md for deployment
- docs/PA_API_GUIDE.md for API integration
- docs/TROUBLESHOOTING.md for common issues
- QUICKSTART.md for 15-minute setup
- CONTRIBUTING.md for development guidelines

### Success Metrics
- Target: 95% ASIN enrichment success rate
- Target: <1.5s average API latency per batch
- Target: +15% CTR improvement vs keyword-based feeds

---

## Version Format

### [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security vulnerability fixes

---

## Notes

- Each version should have a release date
- Group changes by type (Added, Changed, Fixed, etc.)
- Link to GitHub issues/PRs where applicable: `(#123)`
- Keep most recent versions at top
- Move Unreleased items to version sections on release

