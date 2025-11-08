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
const config = require('../config');

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
    
    const result = aggregator.aggregateAsins(products);
    
    res.json(result);
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
    
    const result = aggregator.rankAsins(aggregated, { rankBy, topN });
    
    res.json(result);
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
    
    const result = await paApi.enrichProducts(products, config.paApi);
    
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

    // Step 2: Aggregate
    console.log('Step 2/4: Aggregating...');
    const aggregateResult = aggregator.aggregateAsins(parseResult.products);
    console.log(`✅ Found ${aggregateResult.metadata.totalAsins} unique ASINs`);

    // Step 3: Rank
    console.log('Step 3/4: Ranking...');
    const rankResult = aggregator.rankAsins(aggregateResult.aggregated, { rankBy, topN });
    console.log(`✅ Ranked top ${rankResult.products.length} products`);

    // Step 4: Enrich
    console.log('Step 4/4: Enriching with PA-API...');
    const enrichResult = await paApi.enrichProducts(rankResult.products, config.paApi);
    console.log(`✅ Enriched ${enrichResult.products.length}/${rankResult.products.length} (${(enrichResult.metadata.successRate * 100).toFixed(1)}%)`);

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
        uniqueAsins: aggregateResult.metadata.totalAsins
      },
      rank: {
        topN: rankResult.products.length,
        rankedBy: rankBy
      },
      enrich: {
        enrichedCount: enrichResult.products.length,
        successRate: enrichResult.metadata.successRate
      },
      products: enrichResult.products,
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
  console.log('  GET  /api/health - Health check\n');
  console.log('Press Ctrl+C to stop\n');
});

