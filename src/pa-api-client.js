/**
 * Amazon Product Advertising API (PA-API) Client
 * 
 * Enriches ASINs with product data via PA-API 5.0 GetItems operation.
 * Handles batching, rate limiting, retries, and error handling.
 * 
 * Usage:
 *   const paApi = require('./pa-api-client');
 *   const enriched = await paApi.enrichAsins(asins, config);
 */

const axios = require('axios');
const { signPaApiRequest } = require('./aws-signature-v4');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  region: 'us-east-1',
  marketplace: 'www.amazon.com',
  endpoint: 'https://webservices.amazon.com/paapi5/getitems',
  batchSize: 10,
  resources: [
    'Images.Primary.Medium',
    'ItemInfo.Title',
    'Offers.Listings.Price',
    'Offers.Listings.SavingBasis', // Original price when on sale
    'Offers.Listings.Availability.Type', // Availability status
  ],
  retryAttempts: 3,
  retryDelayMs: 1000,
  requestDelayMs: 1100, // 1.1 seconds to respect 1 req/sec limit
};

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts product data from PA-API response item
 * @param {Object} item - PA-API item object
 * @param {string} associateTag - Associate tag for affiliate links
 * @returns {Object} Extracted product data
 */
function extractProductData(item, associateTag) {
  const asin = item.ASIN;
  
  // Extract title
  const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Product';
  
  // Extract price
  let price = null;
  let currency = 'USD';
  if (item.Offers?.Listings?.[0]?.Price) {
    price = item.Offers.Listings[0].Price.Amount;
    currency = item.Offers.Listings[0].Price.Currency;
  }
  
  // Extract sale information
  let originalPrice = null;
  let discountAmount = null;
  let discountPercentage = null;
  let isOnSale = false;
  
  const savingBasis = item.Offers?.Listings?.[0]?.SavingBasis;
  if (savingBasis && savingBasis.Amount && price) {
    originalPrice = savingBasis.Amount;
    discountAmount = originalPrice - price;
    discountPercentage = Math.round((discountAmount / originalPrice) * 100);
    isOnSale = discountAmount > 0;
  }
  
  // Extract image URL
  const imageUrl = item.Images?.Primary?.Medium?.URL || null;
  
  // Extract availability
  const availability = item.Offers?.Listings?.[0]?.Availability?.Type || 'Unknown';
  
  // Build affiliate link
  const link = item.DetailPageURL || `https://www.amazon.com/dp/${asin}?tag=${associateTag}`;
  
  return {
    asin,
    title,
    price,
    currency,
    image_url: imageUrl,
    link,
    availability,
    // Sale information
    ...(isOnSale && {
      is_on_sale: true,
      original_price: originalPrice,
      discount_amount: discountAmount,
      discount_percentage: discountPercentage,
    }),
  };
}

/**
 * Makes PA-API GetItems request for a batch of ASINs
 * @param {string[]} asins - Array of ASINs (max 10)
 * @param {Object} config - PA-API configuration
 * @returns {Promise<Object>} API response
 */
async function getItemsBatch(asins, config) {
  const {
    accessKey,
    secretKey,
    associateTag,
    region,
    marketplace,
    endpoint,
    resources,
  } = config;
  
  // Build request payload
  const payload = {
    ItemIds: asins,
    PartnerTag: associateTag,
    PartnerType: 'Associates',
    Marketplace: marketplace,
    Resources: resources,
  };
  
  // Sign request
  const host = new URL(endpoint).host;
  const path = new URL(endpoint).pathname;
  
  const signed = signPaApiRequest({
    payload,
    accessKey,
    secretKey,
    region,
    host,
    path,
    operation: 'GetItems',
  });
  
  // Make request
  try {
    const response = await axios.post(endpoint, signed.payload, {
      headers: signed.headers,
      timeout: 10000,
    });
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // Extract error message properly
    let errorMessage = 'Request failed';
    if (error.response?.data) {
      // PA-API error response structure
      if (error.response.data.Errors && Array.isArray(error.response.data.Errors)) {
        const firstError = error.response.data.Errors[0];
        errorMessage = firstError.Message || firstError.message || firstError.Code || 'API error';
      } else if (error.response.data.Message) {
        errorMessage = error.response.data.Message;
      } else if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      } else {
        errorMessage = JSON.stringify(error.response.data);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
      errorData: error.response?.data, // Keep full error data for debugging
      status: error.response?.status,
    };
  }
}

/**
 * Enriches a batch of ASINs with retry logic
 * @param {string[]} asins - Array of ASINs
 * @param {Object} config - PA-API configuration
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} Enrichment results
 */
async function enrichBatchWithRetry(asins, config, attempt = 1) {
  const { retryAttempts, retryDelayMs } = config;
  
  const response = await getItemsBatch(asins, config);
  
  if (response.success) {
    return response;
  }
  
  // Retry on failure
  if (attempt < retryAttempts) {
    const delayMs = retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
    console.warn(`Batch failed (attempt ${attempt}/${retryAttempts}), retrying in ${delayMs}ms...`);
    await delay(delayMs);
    return enrichBatchWithRetry(asins, config, attempt + 1);
  }
  
  return response;
}

/**
 * Enriches array of ASINs with PA-API data
 * @param {string[]|Object[]} asins - Array of ASINs or product objects
 * @param {Object} config - PA-API configuration
 * @returns {Promise<Object>} Enrichment results
 */
async function enrichAsins(asins, config = {}) {
  // Merge config with defaults
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Extract ASINs if objects provided
  const asinStrings = asins.map(item => 
    typeof item === 'string' ? item : item.asin
  );
  
  // Create ASIN map for merging data later
  const asinMap = new Map();
  if (typeof asins[0] === 'object') {
    asins.forEach(item => asinMap.set(item.asin, item));
  }
  
  // Split into batches
  const batches = [];
  for (let i = 0; i < asinStrings.length; i += fullConfig.batchSize) {
    batches.push(asinStrings.slice(i, i + fullConfig.batchSize));
  }
  
  console.log(`Enriching ${asinStrings.length} ASINs in ${batches.length} batches...`);
  
  const enriched = [];
  const failed = [];
  const errors = [];
  let batchNumber = 0;
  
  // Process batches sequentially (respect rate limits)
  for (const batch of batches) {
    batchNumber++;
    console.log(`Processing batch ${batchNumber}/${batches.length} (${batch.length} ASINs)...`);
    
    const response = await enrichBatchWithRetry(batch, fullConfig);
    
    if (response.success) {
      const items = response.data.ItemsResult?.Items || [];
      const itemErrors = response.data.Errors || [];
      
      // Process successful items
      items.forEach(item => {
        const productData = extractProductData(item, fullConfig.associateTag);
        
        // Merge with original data if available
        if (asinMap.has(productData.asin)) {
          const originalData = asinMap.get(productData.asin);
          enriched.push({ ...originalData, ...productData });
        } else {
          enriched.push(productData);
        }
      });
      
      // Track errors from PA-API
      itemErrors.forEach(error => {
        failed.push(error.ASIN);
        errors.push({
          asin: error.ASIN,
          code: error.Code || 'UNKNOWN_ERROR',
          message: error.Message || error.message || 'Item not accessible',
        });
      });
      
    } else {
      // Entire batch failed
      // Ensure error message is always a string
      let errorMessage = 'Batch request failed';
      
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error) {
        // Handle various error object formats
        if (response.error.Message) {
          errorMessage = String(response.error.Message);
        } else if (response.error.message) {
          errorMessage = String(response.error.message);
        } else if (response.error.error) {
          errorMessage = String(response.error.error);
        } else if (response.error.Code) {
          errorMessage = `Error code: ${response.error.Code}`;
        } else {
          // Last resort: stringify the error
          try {
            errorMessage = JSON.stringify(response.error);
          } catch {
            errorMessage = `HTTP ${response.status || 'Unknown'} error`;
          }
        }
      } else if (response.status) {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      batch.forEach(asin => {
        failed.push(asin);
        errors.push({
          asin,
          code: 'BATCH_FAILED',
          message: String(errorMessage), // Ensure it's a string
        });
      });
    }
    
    // Delay between batches (rate limiting)
    if (batchNumber < batches.length) {
      await delay(fullConfig.requestDelayMs);
    }
  }
  
  const successRate = asinStrings.length > 0 
    ? enriched.length / asinStrings.length 
    : 0;
  
  console.log(`\n✅ Enrichment complete: ${enriched.length}/${asinStrings.length} successful (${(successRate * 100).toFixed(1)}%)`);
  
  return {
    success: true,
    products: enriched,
    metadata: {
      totalAsins: asinStrings.length,
      enrichedCount: enriched.length,
      failedCount: failed.length,
      successRate,
      batchCount: batches.length,
    },
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Enriches products from aggregator output
 * @param {Object} aggregatorResult - Result from asin-aggregator
 * @param {Object} config - PA-API configuration
 * @returns {Promise<Object>} Enriched products
 */
async function enrichProducts(aggregatorResult, config = {}) {
  if (!aggregatorResult.success) {
    return {
      success: false,
      error: 'Invalid aggregator result',
      products: [],
    };
  }
  
  const result = await enrichAsins(aggregatorResult.products, config);
  
  return {
    ...result,
    metadata: {
      ...result.metadata,
      aggregatorMetadata: aggregatorResult.metadata,
    },
  };
}

// Export functions
module.exports = {
  enrichAsins,
  enrichProducts,
  getItemsBatch,
  extractProductData,
  DEFAULT_CONFIG,
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node pa-api-client.js <asin1,asin2,asin3,...>');
    console.log('\nExample: node pa-api-client.js B07PGL2ZSL,B079QHML21');
    console.log('\nNote: Set PA-API credentials in config.js or environment variables');
    process.exit(1);
  }
  
  // Try to load config
  let config = {};
  try {
    config = require('../config.js').paApi;
  } catch (error) {
    // Use environment variables
    config = {
      accessKey: process.env.PA_API_ACCESS_KEY,
      secretKey: process.env.PA_API_SECRET_KEY,
      associateTag: process.env.PA_API_ASSOCIATE_TAG,
      region: process.env.PA_API_REGION || 'us-east-1',
    };
    
    if (!config.accessKey || !config.secretKey || !config.associateTag) {
      console.error('❌ PA-API credentials not found. Set in config.js or environment variables.');
      process.exit(1);
    }
  }
  
  const asins = args[0].split(',').map(a => a.trim());
  
  enrichAsins(asins, config)
    .then(result => {
      if (result.success) {
        console.log('\nEnriched Products:');
        result.products.forEach((product, i) => {
          console.log(`\n${i + 1}. ${product.title}`);
          console.log(`   ASIN: ${product.asin}`);
          console.log(`   Price: ${product.price ? `${product.currency} ${product.price}` : 'N/A'}`);
          console.log(`   Image: ${product.image_url ? 'Available' : 'N/A'}`);
          console.log(`   Link: ${product.link}`);
        });
        
        if (result.failed.length > 0) {
          console.log(`\n⚠️  ${result.failed.length} ASINs failed:`);
          result.errors.forEach(error => {
            console.log(`   ${error.asin}: ${error.message}`);
          });
        }
      } else {
        console.error('❌ Enrichment failed');
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

