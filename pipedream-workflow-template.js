/**
 * Amazon Product Feed Enrichment - Pipedream Workflow
 * 
 * Complete workflow that:
 * 1. Triggers on new AA CSV file (Google Drive or manual)
 * 2. Parses CSV and extracts ASINs
 * 3. Aggregates and ranks by performance
 * 4. Enriches via PA-API
 * 5. Generates JSON feed
 * 6. Sends Slack notification
 * 
 * SETUP INSTRUCTIONS:
 * 1. Import this workflow into Pipedream
 * 2. Configure environment variables (see below)
 * 3. Set up trigger (Google Drive or HTTP)
 * 4. Deploy and test
 */

// ============================================
// ENVIRONMENT VARIABLES (Configure in Pipedream)
// ============================================
// PA_API_ACCESS_KEY - Your PA-API access key
// PA_API_SECRET_KEY - Your PA-API secret key
// PA_API_ASSOCIATE_TAG - Your associate tag (e.g., mulapublisher-20)
// PA_API_REGION - AWS region (default: us-east-1)
// SLACK_WEBHOOK_URL - Slack webhook URL for notifications
// FEED_TOP_N - Number of top products (default: 100)
// FEED_RANKING_METRIC - Ranking metric (default: ordered_items)
// PUBLISHER_NAME - Publisher identifier (default: mula)

// ============================================
// STEP 1: Trigger - New File in Google Drive
// ============================================
// Configure this trigger in Pipedream UI:
// - Service: Google Drive
// - Event: New File in Folder
// - Folder: Your AA Reports folder
// - File Pattern: *.csv

// ============================================
// STEP 2: Download CSV File
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const csvContent = steps.trigger.event.content || steps.trigger.event;
    
    // If Google Drive trigger, download the file
    if (steps.trigger.event.id && steps.trigger.event.mimeType === 'text/csv') {
      const axios = require('axios');
      const response = await axios.get(steps.trigger.event.webContentLink, {
        headers: {
          'Authorization': `Bearer ${auths.google_drive.oauth_access_token}`,
        },
      });
      return response.data;
    }
    
    // If HTTP trigger, use body directly
    return csvContent;
  },
});

// ============================================
// STEP 3: Parse CSV
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const Papa = require('papaparse');
    
    // Column mappings (flexible column detection)
    const COLUMN_MAPPINGS = {
      asin: ['asin', 'product asin', 'linking asin'],
      orderedItems: ['ordered items', 'ordered_items', 'items ordered'],
      shippedRevenue: ['shipped revenue', 'shipped_revenue', 'revenue'],
      earnings: ['earnings', 'publisher earnings', 'commission'],
      clicks: ['clicks', 'link clicks', 'click count'],
    };
    
    function findColumn(headers, possibleNames) {
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      for (const name of possibleNames) {
        const index = lowerHeaders.indexOf(name.toLowerCase());
        if (index !== -1) return headers[index];
      }
      return null;
    }
    
    function parseNumber(value) {
      if (!value) return 0;
      const cleaned = value.toString().replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    function isValidASIN(asin) {
      if (!asin || typeof asin !== 'string') return false;
      return /^[B0-9][A-Z0-9]{9}$/i.test(asin.trim());
    }
    
    // Parse CSV
    const csvContent = steps.download_csv || steps.trigger.event;
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    
    const headers = parseResult.meta.fields || [];
    const rows = parseResult.data;
    
    // Build column map
    const columnMap = {};
    for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      const matchedColumn = findColumn(headers, possibleNames);
      if (matchedColumn) columnMap[field] = matchedColumn;
    }
    
    // Validate required columns
    const requiredFields = ['asin', 'orderedItems', 'shippedRevenue', 'earnings', 'clicks'];
    const missingFields = requiredFields.filter(field => !columnMap[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
    }
    
    // Parse products
    const products = rows
      .map(row => {
        const asin = row[columnMap.asin]?.trim();
        if (!isValidASIN(asin)) return null;
        
        return {
          asin,
          ordered_items: parseNumber(row[columnMap.orderedItems]),
          shipped_revenue: parseNumber(row[columnMap.shippedRevenue]),
          earnings: parseNumber(row[columnMap.earnings]),
          clicks: parseNumber(row[columnMap.clicks]),
        };
      })
      .filter(p => p !== null);
    
    console.log(`Parsed ${products.length} valid products from CSV`);
    
    return {
      products,
      totalRows: rows.length,
      validProducts: products.length,
    };
  },
});

// ============================================
// STEP 4: Aggregate and Rank ASINs
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const products = steps.parse_csv.products;
    const rankBy = process.env.FEED_RANKING_METRIC || 'ordered_items';
    const topN = parseInt(process.env.FEED_TOP_N) || 100;
    
    // Aggregate by ASIN
    const asinMap = new Map();
    products.forEach(product => {
      const asin = product.asin;
      if (asinMap.has(asin)) {
        const existing = asinMap.get(asin);
        existing.ordered_items += product.ordered_items;
        existing.shipped_revenue += product.shipped_revenue;
        existing.earnings += product.earnings;
        existing.clicks += product.clicks;
      } else {
        asinMap.set(asin, { ...product });
      }
    });
    
    // Calculate derived metrics
    const aggregated = Array.from(asinMap.values()).map(product => ({
      ...product,
      conversion_rate: product.clicks > 0 ? product.ordered_items / product.clicks : 0,
      revenue_per_click: product.clicks > 0 ? product.shipped_revenue / product.clicks : 0,
      epc: product.clicks > 0 ? product.earnings / product.clicks : 0,
    }));
    
    // Rank products
    const rankingFunctions = {
      ordered_items: (a, b) => b.ordered_items - a.ordered_items,
      shipped_revenue: (a, b) => b.shipped_revenue - a.shipped_revenue,
      earnings: (a, b) => b.earnings - a.earnings,
      conversion_rate: (a, b) => b.conversion_rate - a.conversion_rate,
    };
    
    const ranked = aggregated.sort(rankingFunctions[rankBy] || rankingFunctions.ordered_items);
    ranked.forEach((product, index) => {
      product.rank = index + 1;
    });
    
    // Take top N
    const topProducts = ranked.slice(0, topN);
    
    console.log(`Aggregated to ${aggregated.length} unique ASINs, returning top ${topN}`);
    
    return {
      products: topProducts,
      totalProducts: aggregated.length,
      rankingMetric: rankBy,
    };
  },
});

// ============================================
// STEP 5: Enrich via PA-API (with batching)
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const axios = require('axios');
    const CryptoJS = require('crypto-js');
    
    const products = steps.aggregate_rank.products;
    const config = {
      accessKey: process.env.PA_API_ACCESS_KEY,
      secretKey: process.env.PA_API_SECRET_KEY,
      associateTag: process.env.PA_API_ASSOCIATE_TAG,
      region: process.env.PA_API_REGION || 'us-east-1',
      endpoint: 'https://webservices.amazon.com/paapi5/getitems',
      marketplace: 'www.amazon.com',
      resources: [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Availability',
      ],
    };
    
    // AWS Signature v4 signing function
    function signPaApiRequest(payload, config) {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);
      
      const host = 'webservices.amazon.com';
      const path = '/paapi5/getitems';
      const payloadString = JSON.stringify(payload);
      
      const canonicalHeaders = 
        `content-encoding:amz-1.0\n` +
        `content-type:application/json; charset=utf-8\n` +
        `host:${host}\n` +
        `x-amz-date:${amzDate}\n`;
      
      const signedHeaders = 'content-encoding;content-type;host;x-amz-date';
      const payloadHash = CryptoJS.SHA256(payloadString).toString(CryptoJS.enc.Hex);
      
      const canonicalRequest = 
        `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
      
      const credentialScope = `${dateStamp}/${config.region}/ProductAdvertisingAPI/aws4_request`;
      const stringToSign = 
        `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n` +
        CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex);
      
      const kDate = CryptoJS.HmacSHA256(dateStamp, `AWS4${config.secretKey}`);
      const kRegion = CryptoJS.HmacSHA256(config.region, kDate);
      const kService = CryptoJS.HmacSHA256('ProductAdvertisingAPI', kRegion);
      const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
      const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString(CryptoJS.enc.Hex);
      
      return {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        'host': host,
        'x-amz-date': amzDate,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      };
    }
    
    // Batch and enrich
    const batchSize = 10;
    const enriched = [];
    const failed = [];
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const asins = batch.map(p => p.asin);
      
      const payload = {
        ItemIds: asins,
        PartnerTag: config.associateTag,
        PartnerType: 'Associates',
        Marketplace: config.marketplace,
        Resources: config.resources,
      };
      
      try {
        const headers = signPaApiRequest(payload, config);
        const response = await axios.post(config.endpoint, payload, { headers, timeout: 10000 });
        
        const items = response.data.ItemsResult?.Items || [];
        items.forEach(item => {
          const originalProduct = batch.find(p => p.asin === item.ASIN);
          enriched.push({
            ...originalProduct,
            title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
            price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
            currency: item.Offers?.Listings?.[0]?.Price?.Currency || 'USD',
            image_url: item.Images?.Primary?.Medium?.URL || null,
            link: item.DetailPageURL,
            availability: item.Offers?.Listings?.[0]?.Availability?.Type || 'Unknown',
          });
        });
        
      } catch (error) {
        console.error(`Batch ${i / batchSize + 1} failed:`, error.message);
        batch.forEach(p => failed.push(p.asin));
      }
      
      // Rate limiting: wait 1.1 seconds between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }
    
    const successRate = products.length > 0 ? enriched.length / products.length : 0;
    console.log(`Enriched ${enriched.length}/${products.length} products (${(successRate * 100).toFixed(1)}%)`);
    
    return {
      products: enriched,
      enrichedCount: enriched.length,
      failedCount: failed.length,
      successRate,
    };
  },
});

// ============================================
// STEP 6: Generate Feed
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const products = steps.enrich_paapi.products;
    const publisherName = process.env.PUBLISHER_NAME || 'mula';
    const reportDate = new Date().toISOString().split('T')[0];
    const dateStr = reportDate.replace(/-/g, '');
    
    // Format products
    const feed = products.map(p => ({
      asin: p.asin,
      title: p.title || 'Unknown Product',
      price: p.price,
      currency: p.currency || 'USD',
      image_url: p.image_url,
      link: p.link || `https://www.amazon.com/dp/${p.asin}?tag=${process.env.PA_API_ASSOCIATE_TAG}`,
      rank: p.rank,
      ordered_items: p.ordered_items || 0,
      shipped_revenue: p.shipped_revenue || 0,
      earnings: p.earnings || 0,
      clicks: p.clicks || 0,
      conversion_rate: p.conversion_rate || 0,
      revenue_per_click: p.revenue_per_click || 0,
      epc: p.epc || 0,
    }));
    
    // Calculate metadata
    const totalRevenue = feed.reduce((sum, p) => sum + p.shipped_revenue, 0);
    const totalEarnings = feed.reduce((sum, p) => sum + p.earnings, 0);
    const totalOrders = feed.reduce((sum, p) => sum + p.ordered_items, 0);
    
    const metadata = {
      generated_at: new Date().toISOString(),
      report_date: reportDate,
      total_asins: feed.length,
      ranking_metric: steps.aggregate_rank.rankingMetric,
      publisher: publisherName,
      associate_tag: process.env.PA_API_ASSOCIATE_TAG,
      enrichment_success_rate: steps.enrich_paapi.successRate,
      summary: {
        total_revenue: totalRevenue,
        total_earnings: totalEarnings,
        total_orders: totalOrders,
      },
    };
    
    console.log(`Generated feed with ${feed.length} products`);
    
    return {
      feed: JSON.stringify(feed, null, 2),
      metadata: JSON.stringify(metadata, null, 2),
      feedPath: `/feeds/${publisherName}/primary/${dateStr}/top-products.json`,
      productCount: feed.length,
    };
  },
});

// ============================================
// STEP 7: Send Slack Notification
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const axios = require('axios');
    const products = steps.enrich_paapi.products;
    const enrichmentRate = steps.enrich_paapi.successRate;
    
    const topProducts = products.slice(0, 5).map((p, i) => {
      const title = p.title.length > 60 ? p.title.substring(0, 57) + '...' : p.title;
      const price = p.price ? `$${p.price.toFixed(2)}` : 'N/A';
      return `${i + 1}. ${title} - ${price} (${p.ordered_items} orders)`;
    }).join('\n');
    
    const totalRevenue = products.reduce((sum, p) => sum + p.shipped_revenue, 0);
    const totalEarnings = products.reduce((sum, p) => sum + p.earnings, 0);
    const avgPrice = products.filter(p => p.price).reduce((sum, p) => sum + p.price, 0) / products.filter(p => p.price).length;
    
    const emoji = enrichmentRate >= 0.95 ? '🎯' : '⚠️';
    const status = enrichmentRate >= 0.95 ? 'Feed Generated Successfully' : 'Feed Generated with Warnings';
    
    const message = {
      text: `${emoji} ${status}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${status}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Total ASINs:*\n${products.length}` },
            { type: 'mrkdwn', text: `*Enriched:*\n${steps.enrich_paapi.enrichedCount} (${(enrichmentRate * 100).toFixed(1)}%)` },
            { type: 'mrkdwn', text: `*Failed:*\n${steps.enrich_paapi.failedCount}` },
            { type: 'mrkdwn', text: `*Avg Price:*\n$${avgPrice.toFixed(2)}` },
          ],
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🏆 Top 5 Products*\n\`\`\`${topProducts}\`\`\``,
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Total Revenue:*\n$${totalRevenue.toFixed(2)}` },
            { type: 'mrkdwn', text: `*Total Earnings:*\n$${totalEarnings.toFixed(2)}` },
          ],
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `📂 Feed: \`${steps.generate_feed.feedPath}\`` },
          ],
        },
      ],
    };
    
    await axios.post(process.env.SLACK_WEBHOOK_URL, message);
    
    console.log('Slack notification sent');
    
    return { success: true };
  },
});

// ============================================
// OPTIONAL: Save to Google Drive
// ============================================
// If you want to save the feed back to Google Drive,
// add a Google Drive step here using $.flow.sendHttpRequest
// to upload the JSON file to a specific folder.

