# Supported File Formats

The Amazon Product Feed Enrichment Tool supports multiple file formats for Amazon Associates reports.

## Supported Formats

### ✅ CSV (Comma-Separated Values)
- **Extension:** `.csv`
- **Status:** Fully supported
- **Usage:** Standard text-based format
- **Best for:** Pipedream workflows, webhooks, automated processing

### ✅ XLSX (Excel 2007+)
- **Extension:** `.xlsx`
- **Status:** Fully supported
- **Usage:** Modern Excel format
- **Best for:** Manual exports from Amazon Associates dashboard

### ✅ XLS (Excel 97-2003)
- **Extension:** `.xls`
- **Status:** Fully supported
- **Usage:** Legacy Excel format
- **Best for:** Older Excel versions

## How It Works

The parser automatically detects file format based on extension:

```bash
# CSV files
node src/aa-csv-parser.js sample-data/report.csv

# Excel files
node src/aa-csv-parser.js sample-data/report.xlsx
node src/aa-csv-parser.js sample-data/report.xls
```

## Column Detection

All formats use **flexible column detection** - the parser automatically finds columns regardless of:
- Column order
- Case (ASIN vs asin vs Asin)
- Spacing (Ordered Items vs ordered_items)
- Wording variations

### Required Columns (any of these names work):

**ASIN:**
- ASIN, asin, Product ASIN, Linking ASIN

**Ordered Items:**
- Ordered Items, ordered_items, Items Ordered, Qty Ordered

**Shipped Revenue:**
- Shipped Revenue, shipped_revenue, Revenue, Product Revenue

**Earnings:**
- Earnings, earnings, Publisher Earnings, Commission

**Clicks:**
- Clicks, clicks, Link Clicks, Click Count

## Exporting from Amazon Associates

### Method 1: CSV Export
1. Go to Amazon Associates dashboard
2. Navigate to Reports → Orders Report
3. Select date range
4. Click "Export to CSV"
5. Upload to tool

### Method 2: Excel Export
1. Go to Amazon Associates dashboard
2. Navigate to Reports → Orders Report
3. Select date range
4. Click "Export to Excel" or save as XLSX
5. Upload to tool (no conversion needed!)

## Usage Examples

### Local Testing
```bash
# CSV
node src/aa-csv-parser.js my-report.csv

# Excel
node src/aa-csv-parser.js my-report.xlsx

# With aggregator
node src/asin-aggregator.js my-report.xlsx --top-n 100
```

### Pipedream Workflow
The workflow automatically detects format:
- CSV from webhook/email attachment
- XLSX from Google Drive upload
- Processes both the same way

## Performance

| Format | Parse Speed | File Size | Notes |
|--------|-------------|-----------|-------|
| CSV | Very Fast | Small | Best for automation |
| XLSX | Fast | Medium | Most common export |
| XLS | Fast | Medium | Legacy support |

**Recommendation:** Use CSV for automated workflows (smaller files, faster parsing). Use XLSX for manual exports (more convenient from Amazon dashboard).

## Troubleshooting

### "Unsupported file format"
- Check file extension is .csv, .xlsx, or .xls
- Rename file if needed
- Ensure file isn't corrupted

### "Missing required columns"
- Verify export includes ASIN, Orders, Revenue, Earnings, Clicks
- Check column names match expected formats
- See [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) for solutions

### XLSX file is empty
- Open file in Excel to verify data exists
- Check you're using first sheet (tool uses first sheet by default)
- Re-export from Amazon Associates

## Adding Your Files

Place your AA reports in this directory:

```
sample-data/
├── my-report.csv          ✅ Supported
├── my-report.xlsx         ✅ Supported
├── my-report.xls          ✅ Supported
├── aa-report-sample.csv   📝 Sample data
└── README.md              📚 Documentation
```

**Note:** Don't commit real AA data to Git. Sample data only!

## Technical Details

### CSV Parsing
- Library: PapaParse
- Handles: Various encodings, different delimiters, quoted fields
- Options: Auto-detect headers, skip empty lines

### XLSX Parsing
- Library: SheetJS (xlsx)
- Handles: Multi-sheet workbooks (uses first sheet)
- Options: Formatted strings, empty cell defaults
- Memory: Efficient buffer-based parsing

## Need Another Format?

If you have AA reports in other formats:
1. Convert to CSV or XLSX
2. Or open a GitHub issue requesting support
3. Most formats can be converted in Excel: File → Save As → CSV/XLSX

---

**All formats use the same flexible column detection and validation, ensuring consistent results regardless of input format!**

