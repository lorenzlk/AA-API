#!/usr/bin/env node
/**
 * Quick test script for sale detection feature
 * 
 * Usage:
 *   node test-sales-detection.js [ASIN1,ASIN2,ASIN3]
 * 
 * Example:
 *   node test-sales-detection.js B07PGL2ZSL,B079QHML21
 */

const paApi = require('./src/pa-api-client');
const feedGen = require('./src/feed-generator');

// Get ASINs from command line or use defaults
const args = process.argv.slice(2);
const testAsins = args.length > 0 
  ? args[0].split(',').map(a => a.trim())
  : ['B07PGL2ZSL', 'B079QHML21']; // Default test ASINs

async function testSaleDetection() {
  console.log('🧪 Testing Sale Detection Feature\n');
  console.log(`Testing ${testAsins.length} ASIN(s): ${testAsins.join(', ')}\n`);
  
  // Load config
  let config;
  try {
    config = require('./config').paApi;
  } catch (error) {
    console.error('❌ Error: config.js not found. Copy config.template.js to config.js and add your credentials.');
    process.exit(1);
  }
  
  // Check if SavingBasis is in resources
  if (!config.resources || !config.resources.includes('Offers.Listings.SavingBasis')) {
    console.warn('⚠️  Warning: SavingBasis not found in config.resources');
    console.warn('   Update config.js to include: "Offers.Listings.SavingBasis"');
    console.log('');
  }
  
  try {
    // Step 1: Enrich products
    console.log('📡 Enriching products via PA-API...\n');
    const result = await paApi.enrichAsins(testAsins, config);
    
    if (!result.success) {
      console.error('❌ Enrichment failed');
      process.exit(1);
    }
    
    // Step 2: Analyze results
    const products = result.products;
    const saleProducts = products.filter(p => p.is_on_sale);
    const regularProducts = products.filter(p => !p.is_on_sale);
    
    console.log('📊 Results:\n');
    console.log(`   Total products: ${products.length}`);
    console.log(`   ✅ On sale: ${saleProducts.length}`);
    console.log(`   💰 Regular price: ${regularProducts.length}\n`);
    
    // Step 3: Show details
    if (saleProducts.length > 0) {
      console.log('🏷️  Products ON SALE:\n');
      saleProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title}`);
        console.log(`      ASIN: ${p.asin}`);
        console.log(`      Current Price: $${p.price} ${p.currency}`);
        console.log(`      Original Price: $${p.original_price} ${p.currency}`);
        console.log(`      Discount: ${p.discount_percentage}% off ($${p.discount_amount.toFixed(2)})`);
        console.log('');
      });
    }
    
    if (regularProducts.length > 0) {
      console.log('💰 Products at Regular Price:\n');
      regularProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title}`);
        console.log(`      ASIN: ${p.asin}`);
        console.log(`      Price: $${p.price} ${p.currency}`);
        console.log('');
      });
    }
    
    // Step 4: Test feed generation
    console.log('📦 Testing feed generation...\n');
    
    // Test filterSalesOnly function
    const filtered = feedGen.filterSalesOnly(products);
    console.log(`   filterSalesOnly() returned: ${filtered.length} products`);
    
    if (filtered.length !== saleProducts.length) {
      console.warn('   ⚠️  Warning: Filter count mismatch!');
    } else {
      console.log('   ✅ Filter function works correctly');
    }
    
    // Step 5: Generate test feeds
    console.log('\n📁 Generating test feeds...\n');
    
    const feedOptions = {
      outputPath: './test-feeds',
      associateTag: config.associateTag,
      publisherName: 'test',
      credentialName: 'test',
      enrichmentMetadata: result.metadata,
    };
    
    // Regular feed
    const regularFeed = await feedGen.generateFeed(products, feedOptions);
    console.log(`   ✅ Regular feed: ${regularFeed.feedPath}`);
    console.log(`      Products: ${regularFeed.productCount}`);
    
    // Sales-only feed (if any sales found)
    if (saleProducts.length > 0) {
      const salesFeed = await feedGen.generateFeed(products, {
        ...feedOptions,
        salesOnly: true,
      });
      console.log(`   ✅ Sales-only feed: ${salesFeed.feedPath}`);
      console.log(`      Products: ${salesFeed.productCount} (should be ${saleProducts.length})`);
      
      // Verify sales-only feed
      if (salesFeed.productCount === saleProducts.length) {
        console.log('   ✅ Sales-only feed count matches!');
      } else {
        console.warn(`   ⚠️  Warning: Expected ${saleProducts.length}, got ${salesFeed.productCount}`);
      }
    } else {
      console.log('   ℹ️  No products on sale, skipping sales-only feed');
    }
    
    // Step 6: Check metadata
    console.log('\n📊 Checking metadata...\n');
    const metadata = feedGen.generateMetadata(products, {
      associateTag: config.associateTag,
      enrichmentMetadata: result.metadata,
    });
    
    if (metadata.sales) {
      console.log('   Sale Statistics:');
      console.log(`      Total on sale: ${metadata.sales.total_on_sale}`);
      console.log(`      Sale percentage: ${metadata.sales.sale_percentage.toFixed(1)}%`);
      console.log(`      Avg discount: ${metadata.sales.average_discount_percentage.toFixed(1)}%`);
      console.log('   ✅ Sale statistics included in metadata');
    } else {
      console.warn('   ⚠️  Warning: Sale statistics not found in metadata');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE!\n');
    console.log('Summary:');
    console.log(`   • Enriched: ${products.length}/${testAsins.length} products`);
    console.log(`   • On sale: ${saleProducts.length}`);
    console.log(`   • Regular: ${regularProducts.length}`);
    console.log(`   • Feeds generated: ${saleProducts.length > 0 ? 2 : 1}`);
    console.log('\nCheck ./test-feeds/test/test/ directory for output files');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testSaleDetection();

