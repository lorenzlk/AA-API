/**
 * ASIN Aggregator
 * 
 * Aggregates product data by ASIN and ranks by performance metrics.
 * Supports multiple ranking strategies.
 * 
 * Usage:
 *   const aggregator = require('./asin-aggregator');
 *   const topAsins = aggregator.aggregateAndRank(products, {
 *     rankBy: 'ordered_items',
 *     topN: 100
 *   });
 */

/**
 * Ranking strategies
 */
const RANKING_STRATEGIES = {
  ordered_items: (a, b) => b.ordered_items - a.ordered_items,
  shipped_revenue: (a, b) => b.shipped_revenue - a.shipped_revenue,
  earnings: (a, b) => b.earnings - a.earnings,
  conversion_rate: (a, b) => b.conversion_rate - a.conversion_rate,
  revenue_per_click: (a, b) => b.revenue_per_click - a.revenue_per_click,
};

/**
 * Aggregates products by ASIN (combines duplicate ASINs)
 * @param {Object[]} products - Array of product objects
 * @returns {Object[]} Aggregated products
 */
function aggregateByAsin(products) {
  const asinMap = new Map();
  
  products.forEach(product => {
    const asin = product.asin;
    
    if (asinMap.has(asin)) {
      // Aggregate existing ASIN
      const existing = asinMap.get(asin);
      existing.ordered_items += product.ordered_items;
      existing.shipped_revenue += product.shipped_revenue;
      existing.earnings += product.earnings;
      existing.clicks += product.clicks;
      
      if (product.items_shipped !== undefined) {
        existing.items_shipped = (existing.items_shipped || 0) + product.items_shipped;
      }
      
      // Track tags if multiple
      if (product.tag && product.tag !== existing.tag) {
        if (!existing.tags) {
          existing.tags = [existing.tag];
          delete existing.tag;
        }
        if (!existing.tags.includes(product.tag)) {
          existing.tags.push(product.tag);
        }
      }
    } else {
      // New ASIN
      asinMap.set(asin, { ...product });
    }
  });
  
  // Convert map to array and calculate derived metrics
  const aggregated = Array.from(asinMap.values()).map(product => {
    // Calculate conversion rate
    product.conversion_rate = product.clicks > 0 
      ? product.ordered_items / product.clicks 
      : 0;
    
    // Calculate revenue per click
    product.revenue_per_click = product.clicks > 0
      ? product.shipped_revenue / product.clicks
      : 0;
    
    // Calculate average order value
    product.average_order_value = product.ordered_items > 0
      ? product.shipped_revenue / product.ordered_items
      : 0;
    
    // Calculate earnings per click (EPC)
    product.epc = product.clicks > 0
      ? product.earnings / product.clicks
      : 0;
    
    return product;
  });
  
  return aggregated;
}

/**
 * Ranks products by specified metric
 * @param {Object[]} products - Array of products
 * @param {string} rankBy - Ranking metric
 * @returns {Object[]} Ranked products
 */
function rankProducts(products, rankBy = 'ordered_items') {
  const rankingFunction = RANKING_STRATEGIES[rankBy];
  
  if (!rankingFunction) {
    throw new Error(
      `Invalid ranking strategy: ${rankBy}. ` +
      `Available: ${Object.keys(RANKING_STRATEGIES).join(', ')}`
    );
  }
  
  // Sort products
  const ranked = [...products].sort(rankingFunction);
  
  // Add rank position
  ranked.forEach((product, index) => {
    product.rank = index + 1;
  });
  
  return ranked;
}

/**
 * Filters products by criteria
 * @param {Object[]} products - Array of products
 * @param {Object} filters - Filter criteria
 * @returns {Object[]} Filtered products
 */
function filterProducts(products, filters = {}) {
  let filtered = [...products];
  
  // Minimum ordered items
  if (filters.minOrderedItems !== undefined) {
    filtered = filtered.filter(p => p.ordered_items >= filters.minOrderedItems);
  }
  
  // Minimum revenue
  if (filters.minRevenue !== undefined) {
    filtered = filtered.filter(p => p.shipped_revenue >= filters.minRevenue);
  }
  
  // Minimum earnings
  if (filters.minEarnings !== undefined) {
    filtered = filtered.filter(p => p.earnings >= filters.minEarnings);
  }
  
  // Minimum conversion rate
  if (filters.minConversionRate !== undefined) {
    filtered = filtered.filter(p => p.conversion_rate >= filters.minConversionRate);
  }
  
  // Minimum clicks
  if (filters.minClicks !== undefined) {
    filtered = filtered.filter(p => p.clicks >= filters.minClicks);
  }
  
  // Exclude specific ASINs
  if (filters.excludeAsins && Array.isArray(filters.excludeAsins)) {
    const excludeSet = new Set(filters.excludeAsins);
    filtered = filtered.filter(p => !excludeSet.has(p.asin));
  }
  
  // Include only specific ASINs
  if (filters.includeAsins && Array.isArray(filters.includeAsins)) {
    const includeSet = new Set(filters.includeAsins);
    filtered = filtered.filter(p => includeSet.has(p.asin));
  }
  
  return filtered;
}

/**
 * Aggregates and ranks products in one step
 * @param {Object[]} products - Raw product data
 * @param {Object} options - Configuration options
 * @param {string} options.rankBy - Ranking metric (default: 'ordered_items')
 * @param {number} options.topN - Number of top products to return (default: all)
 * @param {Object} options.filters - Filter criteria
 * @returns {Object} Ranked products and metadata
 */
function aggregateAndRank(products, options = {}) {
  const {
    rankBy = 'ordered_items',
    topN = null,
    filters = {},
  } = options;
  
  try {
    // Step 1: Aggregate by ASIN
    const aggregated = aggregateByAsin(products);
    
    // Step 2: Filter products
    const filtered = filterProducts(aggregated, filters);
    
    // Step 3: Rank products
    const ranked = rankProducts(filtered, rankBy);
    
    // Step 4: Take top N if specified
    const topProducts = topN ? ranked.slice(0, topN) : ranked;
    
    // Calculate summary statistics
    const totalOrderedItems = topProducts.reduce((sum, p) => sum + p.ordered_items, 0);
    const totalRevenue = topProducts.reduce((sum, p) => sum + p.shipped_revenue, 0);
    const totalEarnings = topProducts.reduce((sum, p) => sum + p.earnings, 0);
    const totalClicks = topProducts.reduce((sum, p) => sum + p.clicks, 0);
    
    const avgOrderedItems = topProducts.length > 0 ? totalOrderedItems / topProducts.length : 0;
    const avgRevenue = topProducts.length > 0 ? totalRevenue / topProducts.length : 0;
    const avgEarnings = topProducts.length > 0 ? totalEarnings / topProducts.length : 0;
    const avgConversionRate = totalClicks > 0 ? totalOrderedItems / totalClicks : 0;
    
    return {
      success: true,
      products: topProducts,
      metadata: {
        totalProducts: aggregated.length,
        filteredProducts: filtered.length,
        returnedProducts: topProducts.length,
        rankingMetric: rankBy,
        topN: topN || 'all',
        summary: {
          totalOrderedItems,
          totalRevenue,
          totalEarnings,
          totalClicks,
          avgOrderedItems,
          avgRevenue,
          avgEarnings,
          avgConversionRate,
          avgRevenuePerClick: totalClicks > 0 ? totalRevenue / totalClicks : 0,
          avgEPC: totalClicks > 0 ? totalEarnings / totalClicks : 0,
        },
      },
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
 * Groups products into clusters (for future category detection)
 * @param {Object[]} products - Array of products
 * @param {string} clusterBy - Clustering strategy
 * @returns {Object} Clustered products
 */
function clusterProducts(products, clusterBy = 'price_range') {
  const clusters = {};
  
  if (clusterBy === 'price_range') {
    const ranges = [
      { name: 'budget', min: 0, max: 25 },
      { name: 'mid', min: 25, max: 100 },
      { name: 'premium', min: 100, max: 500 },
      { name: 'luxury', min: 500, max: Infinity },
    ];
    
    products.forEach(product => {
      const aov = product.average_order_value;
      const range = ranges.find(r => aov >= r.min && aov < r.max);
      const clusterName = range ? range.name : 'unknown';
      
      if (!clusters[clusterName]) {
        clusters[clusterName] = [];
      }
      clusters[clusterName].push(product);
    });
  }
  
  return clusters;
}

/**
 * Calculates performance percentiles
 * @param {Object[]} products - Array of products
 * @param {string} metric - Metric to calculate percentiles for
 * @returns {Object} Percentile data
 */
function calculatePercentiles(products, metric = 'ordered_items') {
  const values = products.map(p => p[metric]).sort((a, b) => a - b);
  const len = values.length;
  
  if (len === 0) return {};
  
  return {
    p10: values[Math.floor(len * 0.1)],
    p25: values[Math.floor(len * 0.25)],
    p50: values[Math.floor(len * 0.5)],
    p75: values[Math.floor(len * 0.75)],
    p90: values[Math.floor(len * 0.9)],
    p95: values[Math.floor(len * 0.95)],
    p99: values[Math.floor(len * 0.99)],
    min: values[0],
    max: values[len - 1],
  };
}

// Export functions
module.exports = {
  aggregateByAsin,
  rankProducts,
  filterProducts,
  aggregateAndRank,
  clusterProducts,
  calculatePercentiles,
  RANKING_STRATEGIES,
};

// CLI usage
if (require.main === module) {
  const parser = require('./aa-csv-parser');
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node asin-aggregator.js <path-to-csv> [options]');
    console.log('\nOptions:');
    console.log('  --rank-by <metric>    Ranking metric (default: ordered_items)');
    console.log('  --top-n <number>      Number of top products (default: 100)');
    console.log('  --min-orders <number> Minimum ordered items filter');
    console.log('\nExample: node asin-aggregator.js sample-data/aa-report.csv --rank-by revenue --top-n 50');
    process.exit(1);
  }
  
  const filePath = args[0];
  const rankBy = args.includes('--rank-by') ? args[args.indexOf('--rank-by') + 1] : 'ordered_items';
  const topN = args.includes('--top-n') ? parseInt(args[args.indexOf('--top-n') + 1]) : 100;
  const minOrders = args.includes('--min-orders') ? parseInt(args[args.indexOf('--min-orders') + 1]) : 0;
  
  parser.parseCSV(filePath)
    .then(parseResult => {
      if (!parseResult.success) {
        console.error('❌ Failed to parse CSV:', parseResult.error);
        process.exit(1);
      }
      
      const filters = minOrders > 0 ? { minOrderedItems: minOrders } : {};
      const result = aggregateAndRank(parseResult.products, { rankBy, topN, filters });
      
      if (result.success) {
        console.log('\n✅ Products Aggregated and Ranked\n');
        console.log('Metadata:');
        console.log(`  Total Unique ASINs: ${result.metadata.totalProducts}`);
        console.log(`  After Filters: ${result.metadata.filteredProducts}`);
        console.log(`  Returned (Top ${topN}): ${result.metadata.returnedProducts}`);
        console.log(`  Ranking By: ${result.metadata.rankingMetric}`);
        
        console.log('\nSummary:');
        const summary = result.metadata.summary;
        console.log(`  Total Revenue: $${summary.totalRevenue.toFixed(2)}`);
        console.log(`  Total Earnings: $${summary.totalEarnings.toFixed(2)}`);
        console.log(`  Total Orders: ${summary.totalOrderedItems}`);
        console.log(`  Avg Conversion Rate: ${(summary.avgConversionRate * 100).toFixed(2)}%`);
        
        console.log(`\nTop 10 Products (by ${rankBy}):`);
        result.products.slice(0, 10).forEach(product => {
          console.log(`\n  ${product.rank}. ${product.asin}`);
          console.log(`     Orders: ${product.ordered_items} | Revenue: $${product.shipped_revenue.toFixed(2)} | CR: ${(product.conversion_rate * 100).toFixed(2)}%`);
        });
      } else {
        console.error('❌ Aggregation failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

