# Sample Data

This directory contains sample Amazon Associates report data for testing.

## Files

### `aa-report-sample.csv`
Sample AA report with 20 ASINs for testing the CSV parser and aggregator.

**Format:**
- ASIN - Product identifier
- Ordered Items - Number of items purchased
- Shipped Revenue - Total revenue from shipped items
- Earnings - Publisher commission
- Clicks - Number of clicks

**Usage:**
```bash
# Test CSV parser
node src/aa-csv-parser.js sample-data/aa-report-sample.csv

# Test aggregator
node src/asin-aggregator.js sample-data/aa-report-sample.csv --top-n 10
```

## Adding Your Data

To test with your actual AA report:

1. Export your AA report as CSV
2. Save to this directory: `sample-data/my-report.csv`
3. Test: `node src/aa-csv-parser.js sample-data/my-report.csv`

**Note:** Don't commit real AA data to Git. Sample data only!

## Sample ASINs

The sample data includes common Amazon products (Echo, Fire TV, Kindle, etc.) that should be available via PA-API for testing enrichment.

