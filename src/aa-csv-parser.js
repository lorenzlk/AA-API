/**
 * Amazon Associates CSV/XLSX Parser
 * 
 * Parses Amazon Associates reports in CSV or XLSX format with flexible column detection.
 * Handles various export formats and validates ASIN data.
 * 
 * Supported formats: .csv, .xlsx, .xls
 * 
 * Usage:
 *   const parser = require('./aa-csv-parser');
 *   const data = await parser.parseFile('path/to/report.csv');
 *   const data = await parser.parseFile('path/to/report.xlsx');
 */

const fs = require('fs').promises;
const Papa = require('papaparse');
const XLSX = require('xlsx');

/**
 * Column name mappings (case-insensitive matching)
 * Maps various possible column names to standardized field names
 */
const COLUMN_MAPPINGS = {
  asin: ['asin', 'product asin', 'product_asin', 'linking asin'],
  orderedItems: ['ordered items', 'ordered_items', 'items ordered', 'qty ordered', 'quantity ordered', 'qty', 'items shipped', 'items_shipped'],
  shippedRevenue: ['shipped revenue', 'shipped_revenue', 'revenue', 'shipped earnings', 'product revenue', 'revenue($)', 'revenue ($)'],
  earnings: ['earnings', 'publisher earnings', 'commission', 'your earnings', 'affiliate earnings', 'ad fees', 'ad fees($)', 'ad fees ($)'],
  clicks: ['clicks', 'link clicks', 'click count', 'total clicks'],
  conversionRate: ['conversion rate', 'conversion_rate', 'conversion'],
  itemsShipped: ['items shipped', 'items_shipped', 'shipped items', 'qty shipped'],
  tag: ['tag', 'tracking id', 'tracking_id', 'associate tag'],
  productName: ['name', 'product name', 'title', 'product title'],
  dateShipped: ['date shipped', 'date_shipped', 'ship date', 'shipped date']
};

/**
 * Validates if a string is a valid ASIN format
 * @param {string} asin - The ASIN to validate
 * @returns {boolean} True if valid ASIN format
 */
function isValidASIN(asin) {
  if (!asin || typeof asin !== 'string') return false;
  
  // ASIN format: 10 alphanumeric characters, starts with B or numeric
  const asinPattern = /^[B0-9][A-Z0-9]{9}$/i;
  return asinPattern.test(asin.trim());
}

/**
 * Finds matching column name from headers
 * @param {string[]} headers - Array of column headers
 * @param {string[]} possibleNames - Array of possible column names
 * @returns {string|null} Matched column name or null
 */
function findColumn(headers, possibleNames) {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const name of possibleNames) {
    const index = lowerHeaders.indexOf(name.toLowerCase());
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

/**
 * Maps CSV row to standardized format
 * @param {Object} row - Raw CSV row
 * @param {Object} columnMap - Column name mappings
 * @returns {Object|null} Standardized product data or null if invalid
 */
function mapRowToProduct(row, columnMap) {
  const asin = row[columnMap.asin]?.trim();
  
  // Skip if no ASIN or invalid ASIN
  if (!isValidASIN(asin)) {
    return null;
  }
  
  // Helper to parse numeric value
  const parseNumber = (value) => {
    if (!value) return 0;
    // Remove currency symbols, commas, spaces
    const cleaned = value.toString().replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const product = {
    asin: asin,
    ordered_items: parseNumber(row[columnMap.orderedItems]),
    shipped_revenue: parseNumber(row[columnMap.shippedRevenue]),
    earnings: parseNumber(row[columnMap.earnings]),
    clicks: parseNumber(row[columnMap.clicks]),
  };
  
  // Optional fields
  if (columnMap.itemsShipped) {
    product.items_shipped = parseNumber(row[columnMap.itemsShipped]);
  }
  
  if (columnMap.conversionRate) {
    product.conversion_rate = parseNumber(row[columnMap.conversionRate]);
  } else if (product.clicks > 0 && product.ordered_items > 0) {
    // Calculate conversion rate if not provided
    product.conversion_rate = product.ordered_items / product.clicks;
  }
  
  if (columnMap.tag) {
    product.tag = row[columnMap.tag]?.trim();
  }
  
  return product;
}

/**
 * Detects file format from extension
 * @param {string} filePath - Path to file
 * @returns {string} Format: 'csv', 'xlsx', or 'unknown'
 */
function detectFileFormat(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'unknown';
}

/**
 * Converts XLSX to array of objects
 * @param {string} filePath - Path to XLSX file
 * @param {Object} options - Parsing options
 * @param {string} options.sheetName - Specific sheet to parse (optional)
 * @param {number} options.skipRows - Number of rows to skip before header (default: 0)
 * @returns {Promise<Object[]>} Array of row objects
 */
async function parseXLSX(filePath, options = {}) {
  try {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Determine which sheet to use
    let sheetName = options.sheetName;
    
    // If no sheet specified, try to find one with ASIN data
    if (!sheetName) {
      // Priority: Fee-Earnings, Fee-Orders, then first sheet
      if (workbook.SheetNames.includes('Fee-Earnings')) {
        sheetName = 'Fee-Earnings';
        console.log('Auto-detected sheet: Fee-Earnings (has ASIN + revenue data)');
      } else if (workbook.SheetNames.includes('Fee-Orders')) {
        sheetName = 'Fee-Orders';
        console.log('Auto-detected sheet: Fee-Orders (has ASIN + order data)');
      } else {
        sheetName = workbook.SheetNames[0];
        console.log(`Using first sheet: ${sheetName}`);
      }
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Get raw data to detect header row
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false 
    });
    
    // Find header row (look for row containing "ASIN")
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('asin') && (rowStr.includes('revenue') || rowStr.includes('qty') || rowStr.includes('items'))) {
        headerRowIndex = i;
        console.log(`Found header row at index ${i}`);
        break;
      }
    }
    
    // Parse starting from header row
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: '',
      range: headerRowIndex, // Start from header row
    });
    
    console.log(`Parsed ${rows.length} data rows from sheet: ${sheetName}`);
    
    return rows;
  } catch (error) {
    throw new Error(`Failed to parse XLSX: ${error.message}`);
  }
}

/**
 * Parses Amazon Associates CSV file
 * @param {string} filePath - Path to CSV file
 * @param {Object} options - Parsing options
 * @param {boolean} options.skipInvalidRows - Skip rows with invalid data (default: true)
 * @param {boolean} options.validateAsins - Validate ASIN format (default: true)
 * @returns {Promise<Object>} Parsed data with products array and metadata
 */
async function parseCSV(filePath, options = {}) {
  const {
    skipInvalidRows = true,
    validateAsins = true,
  } = options;
  
  try {
    // Read file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Parse CSV
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for custom parsing
      transformHeader: (header) => header.trim(),
    });
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing warnings:', parseResult.errors);
    }
    
    const headers = parseResult.meta.fields || [];
    const rows = parseResult.data;
    
    // Build column map
    const columnMap = {};
    for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      const matchedColumn = findColumn(headers, possibleNames);
      if (matchedColumn) {
        columnMap[field] = matchedColumn;
      }
    }
    
    // Validate required columns (clicks is optional for some reports)
    const requiredFields = ['asin', 'orderedItems', 'shippedRevenue', 'earnings'];
    const missingFields = requiredFields.filter(field => !columnMap[field]);
    
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required columns. Could not find: ${missingFields.join(', ')}\n` +
        `Available columns: ${headers.join(', ')}\n` +
        `Expected one of: ${missingFields.map(f => COLUMN_MAPPINGS[f].join(' or ')).join(', ')}`
      );
    }
    
    // Warn if clicks is missing (optional but useful)
    if (!columnMap.clicks) {
      console.warn('⚠️  Warning: "Clicks" column not found. Conversion rates cannot be calculated.');
    }
    
    // Parse rows
    const products = [];
    const errors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const product = mapRowToProduct(row, columnMap);
        
        if (product) {
          products.push(product);
        } else if (!skipInvalidRows) {
          errors.push({
            row: i + 2, // +2 for header and 0-index
            error: 'Invalid or missing ASIN',
            data: row
          });
        }
      } catch (error) {
        if (!skipInvalidRows) {
          errors.push({
            row: i + 2,
            error: error.message,
            data: row
          });
        }
      }
    }
    
    // Calculate metadata
    const totalOrderedItems = products.reduce((sum, p) => sum + p.ordered_items, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.shipped_revenue, 0);
    const totalEarnings = products.reduce((sum, p) => sum + p.earnings, 0);
    const totalClicks = products.reduce((sum, p) => sum + p.clicks, 0);
    
    return {
      success: true,
      products,
      metadata: {
        totalRows: rows.length,
        validProducts: products.length,
        invalidRows: rows.length - products.length,
        uniqueAsins: new Set(products.map(p => p.asin)).size,
        totalOrderedItems,
        totalRevenue,
        totalEarnings,
        totalClicks,
        averageConversionRate: totalClicks > 0 ? totalOrderedItems / totalClicks : 0,
        columnMapping: columnMap,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      products: [],
      metadata: {},
    };
  }
}

/**
 * Parses file in any supported format (CSV or XLSX)
 * @param {string} filePath - Path to file (CSV, XLSX, or XLS)
 * @param {Object} options - Parsing options
 * @returns {Promise<Object>} Parsed data with products array and metadata
 */
async function parseFile(filePath, options = {}) {
  const format = detectFileFormat(filePath);
  
  if (format === 'csv') {
    return parseCSV(filePath, options);
  } else if (format === 'xlsx') {
    // Parse XLSX to rows
    const rows = await parseXLSX(filePath);
    
    if (rows.length === 0) {
      return {
        success: false,
        error: 'XLSX file is empty',
        products: [],
        metadata: {},
      };
    }
    
    // Get headers from first row keys
    const headers = Object.keys(rows[0]);
    
    // Build column map
    const columnMap = {};
    for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      const matchedColumn = findColumn(headers, possibleNames);
      if (matchedColumn) {
        columnMap[field] = matchedColumn;
      }
    }
    
    // Validate required columns (clicks is optional for some reports)
    const requiredFields = ['asin', 'orderedItems', 'shippedRevenue', 'earnings'];
    const missingFields = requiredFields.filter(field => !columnMap[field]);
    
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required columns. Could not find: ${missingFields.join(', ')}\n` +
        `Available columns: ${headers.join(', ')}\n` +
        `Expected one of: ${missingFields.map(f => COLUMN_MAPPINGS[f].join(' or ')).join(', ')}`
      );
    }
    
    // Warn if clicks is missing (optional but useful)
    if (!columnMap.clicks) {
      console.warn('⚠️  Warning: "Clicks" column not found. Conversion rates cannot be calculated.');
    }
    
    // Parse rows
    const products = [];
    const errors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const product = mapRowToProduct(row, columnMap);
        
        if (product) {
          products.push(product);
        } else if (!options.skipInvalidRows) {
          errors.push({
            row: i + 2, // +2 for header and 0-index
            error: 'Invalid or missing ASIN',
            data: row
          });
        }
      } catch (error) {
        if (!options.skipInvalidRows) {
          errors.push({
            row: i + 2,
            error: error.message,
            data: row
          });
        }
      }
    }
    
    // Calculate metadata
    const totalOrderedItems = products.reduce((sum, p) => sum + p.ordered_items, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.shipped_revenue, 0);
    const totalEarnings = products.reduce((sum, p) => sum + p.earnings, 0);
    const totalClicks = products.reduce((sum, p) => sum + p.clicks, 0);
    
    return {
      success: true,
      products,
      metadata: {
        format: 'xlsx',
        totalRows: rows.length,
        validProducts: products.length,
        invalidRows: rows.length - products.length,
        uniqueAsins: new Set(products.map(p => p.asin)).size,
        totalOrderedItems,
        totalRevenue,
        totalEarnings,
        totalClicks,
        averageConversionRate: totalClicks > 0 ? totalOrderedItems / totalClicks : 0,
        columnMapping: columnMap,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
    
  } else {
    throw new Error(`Unsupported file format. Please provide CSV or XLSX file. Got: ${filePath}`);
  }
}

/**
 * Parses CSV from string content (for Pipedream/webhook use)
 * @param {string} csvContent - CSV content as string
 * @param {Object} options - Parsing options
 * @returns {Object} Parsed data
 */
function parseCSVString(csvContent, options = {}) {
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });
  
  const headers = parseResult.meta.fields || [];
  const rows = parseResult.data;
  
  // Build column map (same as parseCSV)
  const columnMap = {};
  for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
    const matchedColumn = findColumn(headers, possibleNames);
    if (matchedColumn) {
      columnMap[field] = matchedColumn;
    }
  }
  
  // Validate required columns
  const requiredFields = ['asin', 'orderedItems', 'shippedRevenue', 'earnings', 'clicks'];
  const missingFields = requiredFields.filter(field => !columnMap[field]);
  
  if (missingFields.length > 0) {
    throw new Error(
      `Missing required columns. Could not find: ${missingFields.join(', ')}\n` +
      `Available columns: ${headers.join(', ')}`
    );
  }
  
  // Parse rows
  const products = rows
    .map(row => mapRowToProduct(row, columnMap))
    .filter(product => product !== null);
  
  const totalOrderedItems = products.reduce((sum, p) => sum + p.ordered_items, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.shipped_revenue, 0);
  const totalEarnings = products.reduce((sum, p) => sum + p.earnings, 0);
  const totalClicks = products.reduce((sum, p) => sum + p.clicks, 0);
  
  return {
    success: true,
    products,
    metadata: {
      totalRows: rows.length,
      validProducts: products.length,
      invalidRows: rows.length - products.length,
      uniqueAsins: new Set(products.map(p => p.asin)).size,
      totalOrderedItems,
      totalRevenue,
      totalEarnings,
      totalClicks,
      averageConversionRate: totalClicks > 0 ? totalOrderedItems / totalClicks : 0,
    },
  };
}

// Export functions
module.exports = {
  parseFile,      // New: handles both CSV and XLSX
  parseCSV,       // Legacy: CSV only
  parseCSVString, // For Pipedream/webhook use
  parseXLSX,      // XLSX parsing
  isValidASIN,
  detectFileFormat,
  COLUMN_MAPPINGS,
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node aa-csv-parser.js <path-to-file>');
    console.log('\nSupported formats: CSV, XLSX, XLS');
    console.log('\nExamples:');
    console.log('  node aa-csv-parser.js sample-data/aa-report.csv');
    console.log('  node aa-csv-parser.js sample-data/aa-report.xlsx');
    process.exit(1);
  }
  
  const filePath = args[0];
  const format = detectFileFormat(filePath);
  
  console.log(`Detected format: ${format.toUpperCase()}`);
  
  parseFile(filePath)
    .then(result => {
      if (result.success) {
        console.log('\n✅ File Parsed Successfully\n');
        console.log('Metadata:');
        if (result.metadata.format) {
          console.log(`  Format: ${result.metadata.format.toUpperCase()}`);
        }
        console.log(`  Total Rows: ${result.metadata.totalRows}`);
        console.log(`  Valid Products: ${result.metadata.validProducts}`);
        console.log(`  Unique ASINs: ${result.metadata.uniqueAsins}`);
        console.log(`  Total Ordered Items: ${result.metadata.totalOrderedItems}`);
        console.log(`  Total Revenue: $${result.metadata.totalRevenue.toFixed(2)}`);
        console.log(`  Total Earnings: $${result.metadata.totalEarnings.toFixed(2)}`);
        console.log(`  Total Clicks: ${result.metadata.totalClicks}`);
        console.log(`  Avg Conversion Rate: ${(result.metadata.averageConversionRate * 100).toFixed(2)}%`);
        
        console.log('\nSample Products (first 5):');
        result.products.slice(0, 5).forEach((product, i) => {
          console.log(`\n  ${i + 1}. ASIN: ${product.asin}`);
          console.log(`     Orders: ${product.ordered_items} | Revenue: $${product.shipped_revenue.toFixed(2)} | Earnings: $${product.earnings.toFixed(2)}`);
        });
        
        if (result.errors && result.errors.length > 0) {
          console.log(`\n⚠️  ${result.errors.length} rows had errors (see details above)`);
        }
      } else {
        console.error('\n❌ File Parsing Failed\n');
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unexpected Error\n');
      console.error(error);
      process.exit(1);
    });
}

