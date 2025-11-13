/**
 * Amazon Product Feed Enrichment - Configuration Template
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to config.js: cp config.template.js config.js
 * 2. Fill in your actual credentials in config.js
 * 3. NEVER commit config.js to version control
 * 
 * For Pipedream deployment, use environment variables instead
 */

module.exports = {
  // ============================================
  // Amazon Product Advertising API (PA-API 5.0)
  // ============================================
  paApi: {
    // Your PA-API credentials from https://affiliate-program.amazon.com/assoc_credentials/home
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    associateTag: 'mulapublisher-20',
    
    // API Configuration
    region: 'us-east-1',
    marketplace: 'www.amazon.com',
    endpoint: 'https://webservices.amazon.com/paapi5/getitems',
    
    // Resources to fetch from PA-API
    resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Offers.Listings.SavingBasis', // Original price when on sale
      'Offers.Listings.Availability.Type', // Availability status
    ],
    
    // Rate limiting (free tier = 1 request/second)
    maxRequestsPerSecond: 1,
    batchSize: 10, // Max ASINs per request
  },

  // ============================================
  // Feed Generation Settings
  // ============================================
  feed: {
    // Number of top ASINs to include
    topN: 100,
    
    // Ranking metric: 'ordered_items', 'shipped_revenue', 'earnings', 'conversion_rate'
    rankingMetric: 'ordered_items',
    
    // Output directory structure
    outputPath: '/feeds',
    outputPattern: '{publisher}/{credential}/{date}/top-products.json',
    
    // Publisher/account identifier
    publisherName: 'mula',
    credentialName: 'primary',
    
    // Include metadata file
    generateMetadata: true,
  },

  // ============================================
  // Processing Options
  // ============================================
  processing: {
    // Retry logic for failed API calls
    retryAttempts: 3,
    retryDelayMs: 1000, // Initial delay, increases exponentially
    
    // Timeout for PA-API requests
    apiTimeoutMs: 10000,
    
    // Continue processing if individual ASINs fail
    continueOnError: true,
    
    // Minimum enrichment success rate to consider successful
    minSuccessRate: 0.95,
  },

  // ============================================
  // CSV Parsing
  // ============================================
  csv: {
    // Expected column names (flexible - will match case-insensitive)
    columns: {
      asin: ['ASIN', 'asin', 'Product ASIN'],
      orderedItems: ['Ordered Items', 'ordered_items', 'Items Ordered'],
      shippedRevenue: ['Shipped Revenue', 'shipped_revenue', 'Revenue'],
      earnings: ['Earnings', 'earnings', 'Publisher Earnings'],
      clicks: ['Clicks', 'clicks', 'Link Clicks'],
    },
    
    // Skip rows with invalid data
    skipInvalidRows: true,
    
    // Validate ASIN format (10 alphanumeric characters)
    validateAsins: true,
  },

  // ============================================
  // Development/Testing
  // ============================================
  dev: {
    // Enable debug logging
    debugMode: false,
    
    // Use mock PA-API responses (for testing without API calls)
    useMockApi: false,
    
    // Limit processing to N ASINs in test mode
    testModeLimit: null, // Set to number to enable, null to disable
    
    // Save intermediate processing steps to files
    saveIntermediateSteps: false,
  },

  // ============================================
  // Google Drive Integration (Optional)
  // ============================================
  googleDrive: {
    // Folder ID for AA CSV uploads (Pipedream trigger)
    folderId: '',
    
    // File naming pattern to watch for
    filePattern: /^AA.*Report.*\.csv$/i,
  },
};

