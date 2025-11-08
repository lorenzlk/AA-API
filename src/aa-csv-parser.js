/**
 * Amazon Associates CSV Parser
 * 
 * Parses Amazon Associates report CSVs with flexible column detection.
 * Handles various export formats and validates ASIN data.
 * 
 * Usage:
 *   const parser = require('./aa-csv-parser');
 *   const data = await parser.parseCSV('path/to/report.csv');
 */

const fs = require('fs').promises;
const Papa = require('papaparse');

/**
 * Column name mappings (case-insensitive matching)
 * Maps various possible column names to standardized field names
 */
const COLUMN_MAPPINGS = {
  asin: ['asin', 'product asin', 'product_asin', 'linking asin'],
  orderedItems: ['ordered items', 'ordered_items', 'items ordered', 'qty ordered', 'quantity ordered'],
  shippedRevenue: ['shipped revenue', 'shipped_revenue', 'revenue', 'shipped earnings', 'product revenue'],
  earnings: ['earnings', 'publisher earnings', 'commission', 'your earnings', 'affiliate earnings'],
  clicks: ['clicks', 'link clicks', 'click count', 'total clicks'],
  conversionRate: ['conversion rate', 'conversion_rate', 'conversion'],
  itemsShipped: ['items shipped', 'items_shipped', 'shipped items', 'qty shipped'],
  tag: ['tag', 'tracking id', 'tracking_id', 'associate tag']
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
    
    // Validate required columns
    const requiredFields = ['asin', 'orderedItems', 'shippedRevenue', 'earnings', 'clicks'];
    const missingFields = requiredFields.filter(field => !columnMap[field]);
    
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required columns. Could not find: ${missingFields.join(', ')}\n` +
        `Available columns: ${headers.join(', ')}\n` +
        `Expected one of: ${missingFields.map(f => COLUMN_MAPPINGS[f].join(' or ')).join(', ')}`
      );
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
  parseCSV,
  parseCSVString,
  isValidASIN,
  COLUMN_MAPPINGS,
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node aa-csv-parser.js <path-to-csv>');
    console.log('\nExample: node aa-csv-parser.js sample-data/aa-report.csv');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  parseCSV(filePath)
    .then(result => {
      if (result.success) {
        console.log('\n✅ CSV Parsed Successfully\n');
        console.log('Metadata:');
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
        console.error('\n❌ CSV Parsing Failed\n');
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

