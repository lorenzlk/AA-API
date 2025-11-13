/**
 * Feed Generator
 * 
 * Generates JSON product feeds from enriched ASIN data.
 * Handles file output, metadata, and formatting.
 * 
 * Usage:
 *   const feedGen = require('./feed-generator');
 *   await feedGen.generateFeed(products, config);
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Formats product for feed output
 * @param {Object} product - Enriched product data
 * @param {string} associateTag - Associate tag for affiliate links
 * @returns {Object} Formatted product
 */
function formatProduct(product, associateTag) {
  return {
    asin: product.asin,
    title: product.title || 'Unknown Product',
    price: product.price,
    currency: product.currency || 'USD',
    image_url: product.image_url,
    link: product.link || `https://www.amazon.com/dp/${product.asin}?tag=${associateTag}`,
    rank: product.rank,
    
    // Performance metrics
    ordered_items: product.ordered_items || 0,
    shipped_revenue: product.shipped_revenue || 0,
    earnings: product.earnings || 0,
    clicks: product.clicks || 0,
    conversion_rate: product.conversion_rate || 0,
    
    // Optional fields
    ...(product.items_shipped !== undefined && { items_shipped: product.items_shipped }),
    ...(product.revenue_per_click !== undefined && { revenue_per_click: product.revenue_per_click }),
    ...(product.epc !== undefined && { epc: product.epc }),
    ...(product.average_order_value !== undefined && { average_order_value: product.average_order_value }),
    ...(product.cluster && { cluster: product.cluster }),
    ...(product.availability && { availability: product.availability }),
    ...(product.tags && { tags: product.tags }),
    ...(product.tag && { tag: product.tag }),
    // Sale information
    ...(product.is_on_sale && {
      is_on_sale: product.is_on_sale,
      original_price: product.original_price,
      discount_amount: product.discount_amount,
      discount_percentage: product.discount_percentage,
    }),
  };
}

/**
 * Generates metadata file
 * @param {Object[]} products - Product array
 * @param {Object} options - Generation options
 * @returns {Object} Metadata
 */
function generateMetadata(products, options = {}) {
  const {
    reportDate,
    rankingMetric,
    publisherName,
    credentialName,
    associateTag,
    enrichmentMetadata,
  } = options;
  
  const totalRevenue = products.reduce((sum, p) => sum + (p.shipped_revenue || 0), 0);
  const totalEarnings = products.reduce((sum, p) => sum + (p.earnings || 0), 0);
  const totalOrders = products.reduce((sum, p) => sum + (p.ordered_items || 0), 0);
  const totalClicks = products.reduce((sum, p) => sum + (p.clicks || 0), 0);
  
  const avgPrice = products.filter(p => p.price).length > 0
    ? products.filter(p => p.price).reduce((sum, p) => sum + p.price, 0) / products.filter(p => p.price).length
    : 0;
  
  // Sale statistics
  const saleProducts = products.filter(p => p.is_on_sale);
  const avgDiscountPercentage = saleProducts.length > 0
    ? saleProducts.reduce((sum, p) => sum + (p.discount_percentage || 0), 0) / saleProducts.length
    : 0;
  
  return {
    generated_at: new Date().toISOString(),
    report_date: reportDate || new Date().toISOString().split('T')[0],
    version: '1.0',
    
    // Feed info
    total_asins: products.length,
    ranking_metric: rankingMetric || 'ordered_items',
    publisher: publisherName || 'unknown',
    credential: credentialName || 'primary',
    associate_tag: associateTag,
    
    // Enrichment stats
    enrichment_success_rate: enrichmentMetadata?.successRate || null,
    enriched_count: enrichmentMetadata?.enrichedCount || products.length,
    failed_count: enrichmentMetadata?.failedCount || 0,
    
    // Performance summary
    summary: {
      total_revenue: totalRevenue,
      total_earnings: totalEarnings,
      total_orders: totalOrders,
      total_clicks: totalClicks,
      average_price: avgPrice,
      average_conversion_rate: totalClicks > 0 ? totalOrders / totalClicks : 0,
    },
    
    // Sale statistics
    sales: {
      total_on_sale: saleProducts.length,
      sale_percentage: products.length > 0 ? (saleProducts.length / products.length) * 100 : 0,
      average_discount_percentage: avgDiscountPercentage,
    },
  };
}

/**
 * Ensures directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Filters products to only include items on sale
 * @param {Object[]} products - Product array
 * @returns {Object[]} Filtered products (sales only)
 */
function filterSalesOnly(products) {
  return products.filter(p => p.is_on_sale === true);
}

/**
 * Generates feed files
 * @param {Object[]} products - Enriched products
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
async function generateFeed(products, options = {}) {
  const {
    outputPath = '/feeds',
    publisherName = 'mula',
    credentialName = 'primary',
    associateTag,
    reportDate,
    rankingMetric,
    enrichmentMetadata,
    generateMetadata: includeMetadata = true,
    salesOnly = false, // Filter to only include products on sale
  } = options;
  
  // Filter to sales-only if requested
  let filteredProducts = products;
  if (salesOnly) {
    filteredProducts = filterSalesOnly(products);
    console.log(`📊 Filtering to sales-only: ${filteredProducts.length}/${products.length} products`);
  }
  
  try {
    // Format date for directory name
    const dateStr = reportDate 
      ? reportDate.replace(/-/g, '')
      : new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // Build output directory path
    const feedDir = path.join(outputPath, publisherName, credentialName, dateStr);
    await ensureDirectory(feedDir);
    
    // Format products for output
    const formattedProducts = filteredProducts.map(p => formatProduct(p, associateTag));
    
    // Write main feed file
    const feedFileName = salesOnly ? 'top-products-sales.json' : 'top-products.json';
    const feedPath = path.join(feedDir, feedFileName);
    await fs.writeFile(
      feedPath,
      JSON.stringify(formattedProducts, null, 2),
      'utf-8'
    );
    
    // Write metadata file if requested
    let metadataPath = null;
    if (includeMetadata) {
      const metadata = generateMetadata(formattedProducts, {
        reportDate: reportDate || dateStr,
        rankingMetric,
        publisherName,
        credentialName,
        associateTag,
        enrichmentMetadata,
      });
      
      metadataPath = path.join(feedDir, 'top-products-meta.json');
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );
    }
    
    console.log(`\n✅ Feed generated successfully`);
    console.log(`   Feed: ${feedPath}`);
    if (metadataPath) {
      console.log(`   Metadata: ${metadataPath}`);
    }
    
    return {
      success: true,
      feedPath,
      metadataPath,
      productCount: formattedProducts.length,
      directory: feedDir,
    };
    
  } catch (error) {
    console.error('❌ Feed generation failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generates feed from string (for Pipedream/serverless use)
 * Returns JSON strings instead of writing files
 * @param {Object[]} products - Enriched products
 * @param {Object} options - Generation options
 * @returns {Object} Feed and metadata as strings
 */
function generateFeedStrings(products, options = {}) {
  const {
    associateTag,
    reportDate,
    rankingMetric,
    publisherName,
    credentialName,
    enrichmentMetadata,
    salesOnly = false,
  } = options;
  
  // Filter to sales-only if requested
  let filteredProducts = products;
  if (salesOnly) {
    filteredProducts = filterSalesOnly(products);
  }
  
  // Format products
  const formattedProducts = filteredProducts.map(p => formatProduct(p, associateTag));
  
  // Generate metadata
  const metadata = generateMetadata(formattedProducts, {
    reportDate,
    rankingMetric,
    publisherName,
    credentialName,
    associateTag,
    enrichmentMetadata,
  });
  
  return {
    success: true,
    feed: JSON.stringify(formattedProducts, null, 2),
    metadata: JSON.stringify(metadata, null, 2),
    productCount: formattedProducts.length,
  };
}

/**
 * Reads existing feed
 * @param {string} feedPath - Path to feed file
 * @returns {Promise<Object>} Feed data
 */
async function readFeed(feedPath) {
  try {
    const content = await fs.readFile(feedPath, 'utf-8');
    const products = JSON.parse(content);
    
    return {
      success: true,
      products,
      count: products.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Lists available feeds
 * @param {string} outputPath - Base output path
 * @param {string} publisherName - Publisher identifier
 * @param {string} credentialName - Credential identifier
 * @returns {Promise<Object>} List of feeds
 */
async function listFeeds(outputPath = '/feeds', publisherName = 'mula', credentialName = 'primary') {
  try {
    const baseDir = path.join(outputPath, publisherName, credentialName);
    const dates = await fs.readdir(baseDir);
    
    const feeds = [];
    for (const date of dates) {
      const feedPath = path.join(baseDir, date, 'top-products.json');
      const metaPath = path.join(baseDir, date, 'top-products-meta.json');
      
      try {
        await fs.access(feedPath);
        const stats = await fs.stat(feedPath);
        
        let metadata = null;
        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          metadata = JSON.parse(metaContent);
        } catch {
          // Metadata file doesn't exist
        }
        
        feeds.push({
          date,
          path: feedPath,
          size: stats.size,
          modified: stats.mtime,
          productCount: metadata?.total_asins || null,
        });
      } catch {
        // Feed doesn't exist for this date
      }
    }
    
    return {
      success: true,
      feeds: feeds.sort((a, b) => b.date.localeCompare(a.date)),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      feeds: [],
    };
  }
}

// Export functions
module.exports = {
  generateFeed,
  generateFeedStrings,
  formatProduct,
  generateMetadata,
  filterSalesOnly,
  readFeed,
  listFeeds,
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node feed-generator.js <command> [options]');
    console.log('\nCommands:');
    console.log('  list                    List available feeds');
    console.log('  read <date>            Read feed for specific date (YYYYMMDD)');
    console.log('\nExample:');
    console.log('  node feed-generator.js list');
    console.log('  node feed-generator.js read 20251107');
    process.exit(1);
  }
  
  const command = args[0];
  
  if (command === 'list') {
    listFeeds()
      .then(result => {
        if (result.success) {
          console.log('\n📁 Available Feeds:\n');
          result.feeds.forEach(feed => {
            console.log(`  ${feed.date}`);
            console.log(`    Path: ${feed.path}`);
            console.log(`    Products: ${feed.productCount || 'Unknown'}`);
            console.log(`    Size: ${(feed.size / 1024).toFixed(2)} KB`);
            console.log(`    Modified: ${feed.modified.toISOString()}\n`);
          });
        } else {
          console.error('❌ Failed to list feeds:', result.error);
        }
      });
  } else if (command === 'read') {
    const date = args[1];
    if (!date) {
      console.error('❌ Please provide a date (YYYYMMDD)');
      process.exit(1);
    }
    
    const feedPath = `/feeds/mula/primary/${date}/top-products.json`;
    readFeed(feedPath)
      .then(result => {
        if (result.success) {
          console.log(`\n📊 Feed for ${date}:\n`);
          console.log(`Total Products: ${result.count}\n`);
          console.log('Top 5 Products:');
          result.products.slice(0, 5).forEach((p, i) => {
            console.log(`\n  ${i + 1}. ${p.title}`);
            console.log(`     ASIN: ${p.asin} | Rank: ${p.rank}`);
            console.log(`     Price: $${p.price || 'N/A'} | Orders: ${p.ordered_items}`);
          });
        } else {
          console.error('❌ Failed to read feed:', result.error);
        }
      });
  } else {
    console.error(`❌ Unknown command: ${command}`);
    process.exit(1);
  }
}

