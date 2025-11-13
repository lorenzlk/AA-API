#!/usr/bin/env node

/**
 * Simple Express server for the AA Feed Enrichment Test Harness
 * 
 * Usage:
 *   node test-harness/server.js
 *   
 * Then open: http://localhost:3000
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Import core modules
const parser = require('../src/aa-csv-parser');
const aggregator = require('../src/asin-aggregator');
const paApi = require('../src/pa-api-client');
const feedGen = require('../src/feed-generator');

// Load config - use environment variables on Railway, fallback to config.js for local dev
let config;
try {
  config = require('../config');
} catch (error) {
  // config.js doesn't exist (Railway deployment) - create config from env vars
  console.log('⚠️  config.js not found, using environment variables');
  config = {
    paApi: {
      accessKey: process.env.PA_API_ACCESS_KEY,
      secretKey: process.env.PA_API_SECRET_KEY,
      associateTag: process.env.PA_API_ASSOCIATE_TAG || 'mula0f-20',
      region: process.env.PA_API_REGION || 'us-east-1',
      marketplace: process.env.PA_API_MARKETPLACE || 'www.amazon.com',
      endpoint: 'https://webservices.amazon.com/paapi5/getitems',
      resources: [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.Availability.Type',
      ],
      batchSize: 10,
      retryAttempts: 3,
      retryDelayMs: 1000,
      requestDelayMs: 1100,
    },
  };
  
  // Validate required env vars
  if (!config.paApi.accessKey || !config.paApi.secretKey) {
    console.error('❌ Missing required environment variables: PA_API_ACCESS_KEY and PA_API_SECRET_KEY');
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads with extension preservation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    // Preserve file extension for parser
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'aa-upload-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, and XLS files are allowed'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Increase body size limits for large file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Parse uploaded file
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Parsing file: ${req.file.originalname}`);
    
    const result = await parser.parseFile(req.file.path);
    
    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});
    
    res.json(result);
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Aggregate ASINs
app.post('/api/aggregate', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid products array' });
    }

    console.log(`Aggregating ${products.length} products`);
    
    const aggregated = aggregator.aggregateByAsin(products);
    
    res.json({
      success: true,
      aggregated: aggregated,
      metadata: {
        totalAsins: aggregated.length
      }
    });
  } catch (error) {
    console.error('Aggregate error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Rank ASINs
app.post('/api/rank', async (req, res) => {
  try {
    const { aggregated, rankBy = 'ordered_items', topN = 10 } = req.body;
    
    if (!aggregated || !Array.isArray(aggregated)) {
      return res.status(400).json({ error: 'Invalid aggregated array' });
    }

    console.log(`Ranking ${aggregated.length} ASINs (top ${topN} by ${rankBy})`);
    
    const ranked = aggregator.rankProducts(aggregated, rankBy);
    const topProducts = topN ? ranked.slice(0, topN) : ranked;
    
    res.json({
      success: true,
      products: topProducts,
      metadata: {
        totalAsins: aggregated.length,
        rankedBy: rankBy,
        topN: topProducts.length
      }
    });
  } catch (error) {
    console.error('Rank error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Enrich with PA-API
app.post('/api/enrich', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid products array' });
    }

    console.log(`Enriching ${products.length} products via PA-API`);
    
    // Use enrichAsins since we're passing products array directly
    // enrichProducts expects full aggregator result object with { success, products, metadata }
    const result = await paApi.enrichAsins(products, config.paApi);
    
    res.json(result);
  } catch (error) {
    console.error('Enrich error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Complete pipeline (all steps)
app.post('/api/pipeline', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { rankBy = 'ordered_items', topN = 10 } = req.body;

    console.log('\n🚀 Starting full pipeline...');
    console.log(`File: ${req.file.originalname}`);
    console.log(`Rank by: ${rankBy}, Top: ${topN}\n`);

    // Step 1: Parse
    console.log('Step 1/4: Parsing...');
    const parseResult = await parser.parseFile(req.file.path);
    console.log(`✅ Parsed ${parseResult.metadata.validProducts} products`);

    // Step 2: Aggregate & Rank (combined)
    console.log('Step 2/3: Aggregating & Ranking...');
    const rankResult = aggregator.aggregateAndRank(parseResult.products, { rankBy, topN });
    console.log(`✅ Found ${rankResult.metadata.totalProducts} unique ASINs`);
    console.log(`✅ Ranked top ${rankResult.products.length} products`);

    // Step 3: Enrich
    console.log('Step 3/3: Enriching with PA-API...');
    console.log('Rank result structure:', JSON.stringify({
      success: rankResult.success,
      productsCount: rankResult.products?.length,
      hasMetadata: !!rankResult.metadata
    }));
    
    const enrichResult = await paApi.enrichProducts(rankResult, config.paApi);
    
    console.log('Enrich result structure:', JSON.stringify({
      success: enrichResult.success,
      productsCount: enrichResult.products?.length,
      hasMetadata: !!enrichResult.metadata,
      metadata: enrichResult.metadata
    }));
    
    // Safe metadata extraction
    const enrichedCount = enrichResult.metadata?.enrichedCount || enrichResult.products?.length || 0;
    const totalAsins = enrichResult.metadata?.totalAsins || rankResult.products.length;
    const successRate = enrichResult.metadata?.successRate || (enrichedCount / totalAsins) || 0;
    
    console.log(`✅ Enriched ${enrichedCount}/${totalAsins} (${(successRate * 100).toFixed(1)}%)`);

    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    console.log('\n🎉 Pipeline complete!\n');

    res.json({
      success: true,
      parse: {
        totalProducts: parseResult.metadata.validProducts,
        source: parseResult.metadata.source
      },
      aggregate: {
        uniqueAsins: rankResult.metadata.totalProducts
      },
      rank: {
        topN: rankResult.products.length,
        rankedBy: rankBy
      },
      enrich: {
        enrichedCount: enrichedCount,
        successRate: successRate
      },
      products: enrichResult.products || [],
      failed: enrichResult.failed || [],
      errors: enrichResult.errors || []
    });

  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Generate sales-only feed from products
app.post('/api/feed/sales-only', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array required' });
    }
    
    // Filter to sales-only
    const salesOnly = feedGen.filterSalesOnly(products);
    
    if (salesOnly.length === 0) {
      return res.status(404).json({ 
        error: 'No products on sale found',
        totalProducts: products.length,
        salesCount: 0
      });
    }
    
    // Generate feed strings
    const feedResult = feedGen.generateFeedStrings(salesOnly, {
      associateTag: config.paApi.associateTag,
      publisherName: 'mula',
      credentialName: 'primary',
    });
    
    res.json({
      success: true,
      feed: JSON.parse(feedResult.feed),
      metadata: JSON.parse(feedResult.metadata),
      productCount: salesOnly.length,
      totalProducts: products.length,
      salesPercentage: ((salesOnly.length / products.length) * 100).toFixed(1)
    });
    
  } catch (error) {
    console.error('Sales-only feed error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// API: Download sales-only feed as JSON file
app.post('/api/feed/sales-only/download', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array required' });
    }
    
    // Filter to sales-only
    const salesOnly = feedGen.filterSalesOnly(products);
    
    if (salesOnly.length === 0) {
      return res.status(404).json({ 
        error: 'No products on sale found',
        totalProducts: products.length
      });
    }
    
    // Format products for feed
    const formattedProducts = salesOnly.map(p => feedGen.formatProduct(p, config.paApi.associateTag));
    
    // Generate metadata
    const metadata = feedGen.generateMetadata(formattedProducts, {
      associateTag: config.paApi.associateTag,
      publisherName: 'mula',
      credentialName: 'primary',
    });
    
    // Create feed object
    const feed = {
      generated_at: new Date().toISOString(),
      feed_type: 'sales_only',
      total_products: formattedProducts.length,
      total_original: products.length,
      sales_percentage: ((formattedProducts.length / products.length) * 100).toFixed(1),
      products: formattedProducts,
      metadata: metadata
    };
    
    // Send as downloadable JSON file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sales-only-feed-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(feed);
    
  } catch (error) {
    console.error('Sales-only feed download error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      paApiConfigured: !!(config.paApi && config.paApi.accessKey),
      marketplace: config.paApi?.marketplace,
      region: config.paApi?.region
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    details: err.stack 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  AA Feed Enrichment - Test Harness Server         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`📊 Open in browser to test the pipeline\n`);
  console.log('Available endpoints:');
  console.log('  GET  / - Test harness UI');
  console.log('  POST /api/parse - Parse AA report');
  console.log('  POST /api/aggregate - Aggregate ASINs');
  console.log('  POST /api/rank - Rank ASINs');
  console.log('  POST /api/enrich - Enrich with PA-API');
  console.log('  POST /api/pipeline - Complete pipeline');
  console.log('  POST /api/feed/sales-only - Get sales-only feed JSON');
  console.log('  POST /api/feed/sales-only/download - Download sales-only feed');
  console.log('  GET  /api/health - Health check\n');
  console.log('Press Ctrl+C to stop\n');
});

