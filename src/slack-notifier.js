/**
 * Slack Notifier
 * 
 * Formats and sends Slack notifications for feed generation events.
 * Supports success and error notifications with rich formatting.
 * 
 * Usage:
 *   const slack = require('./slack-notifier');
 *   await slack.sendFeedNotification(result, webhookUrl);
 */

const axios = require('axios');

/**
 * Formats duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Formats currency value
 * @param {number} amount - Amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, currency = 'USD') {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Creates success notification payload
 * @param {Object} result - Feed generation result
 * @param {Object} options - Notification options
 * @returns {Object} Slack payload
 */
function createSuccessNotification(result, options = {}) {
  const {
    products = [],
    metadata = {},
    feedPath,
    directory,
    processingTime,
  } = result;
  
  const {
    includeTopProducts = 5,
    publisherName = 'mula',
    reportDate,
  } = options;
  
  // Calculate summary stats
  const totalAsins = products.length;
  const enrichmentRate = metadata.enrichmentMetadata?.successRate || 1;
  const enrichedCount = metadata.enrichmentMetadata?.enrichedCount || totalAsins;
  const failedCount = metadata.enrichmentMetadata?.failedCount || 0;
  
  const totalRevenue = products.reduce((sum, p) => sum + (p.shipped_revenue || 0), 0);
  const totalEarnings = products.reduce((sum, p) => sum + (p.earnings || 0), 0);
  const totalOrders = products.reduce((sum, p) => sum + (p.ordered_items || 0), 0);
  
  const avgPrice = products.filter(p => p.price).length > 0
    ? products.filter(p => p.price).reduce((sum, p) => sum + p.price, 0) / products.filter(p => p.price).length
    : 0;
  
  // Build top products list
  const topProducts = products.slice(0, includeTopProducts).map((p, i) => {
    const title = p.title.length > 60 ? p.title.substring(0, 57) + '...' : p.title;
    const price = p.price ? formatCurrency(p.price, p.currency) : 'N/A';
    return `${i + 1}. ${title} - ${price} (${p.ordered_items} orders)`;
  }).join('\n');
  
  // Build message
  const emoji = enrichmentRate >= 0.95 ? '🎯' : '⚠️';
  const statusText = enrichmentRate >= 0.95 ? 'Feed Generated Successfully' : 'Feed Generated with Warnings';
  
  const message = {
    text: `${emoji} ${statusText}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${statusText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Publisher:*\n${publisherName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Report Date:*\n${reportDate || 'Today'}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 Summary*',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total ASINs:*\n${totalAsins}`,
          },
          {
            type: 'mrkdwn',
            text: `*Enriched:*\n${enrichedCount} (${(enrichmentRate * 100).toFixed(1)}%)`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed:*\n${failedCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg Price:*\n${formatCurrency(avgPrice)}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🏆 Top ${includeTopProducts} Products*\n\`\`\`${topProducts}\`\`\``,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💰 Performance*',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Revenue:*\n${formatCurrency(totalRevenue)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Earnings:*\n${formatCurrency(totalEarnings)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Orders:*\n${totalOrders}`,
          },
          {
            type: 'mrkdwn',
            text: `*Processing Time:*\n${processingTime ? formatDuration(processingTime) : 'N/A'}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📂 Feed Location: \`${feedPath || directory}\``,
          },
        ],
      },
    ],
  };
  
  return message;
}

/**
 * Creates error notification payload
 * @param {Object} error - Error details
 * @param {Object} options - Notification options
 * @returns {Object} Slack payload
 */
function createErrorNotification(error, options = {}) {
  const {
    publisherName = 'mula',
    reportDate,
    step,
  } = options;
  
  const message = {
    text: '❌ Feed Generation Failed',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Feed Generation Failed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Publisher:*\n${publisherName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Report Date:*\n${reportDate || 'Today'}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Details*\n\`\`\`${error.message || JSON.stringify(error, null, 2)}\`\`\``,
        },
      },
    ],
  };
  
  if (step) {
    message.blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Failed at step: *${step}*`,
        },
      ],
    });
  }
  
  return message;
}

/**
 * Sends Slack notification
 * @param {Object} payload - Slack message payload
 * @param {string} webhookUrl - Slack webhook URL
 * @returns {Promise<Object>} Send result
 */
async function sendNotification(payload, webhookUrl) {
  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to send Slack notification:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sends feed generation success notification
 * @param {Object} result - Feed generation result
 * @param {string} webhookUrl - Slack webhook URL
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Send result
 */
async function sendFeedNotification(result, webhookUrl, options = {}) {
  const payload = createSuccessNotification(result, options);
  return sendNotification(payload, webhookUrl);
}

/**
 * Sends feed generation error notification
 * @param {Object} error - Error details
 * @param {string} webhookUrl - Slack webhook URL
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Send result
 */
async function sendErrorNotification(error, webhookUrl, options = {}) {
  const payload = createErrorNotification(error, options);
  return sendNotification(payload, webhookUrl);
}

/**
 * Sends simple text notification
 * @param {string} text - Message text
 * @param {string} webhookUrl - Slack webhook URL
 * @returns {Promise<Object>} Send result
 */
async function sendSimpleNotification(text, webhookUrl) {
  const payload = { text };
  return sendNotification(payload, webhookUrl);
}

// Export functions
module.exports = {
  sendFeedNotification,
  sendErrorNotification,
  sendSimpleNotification,
  sendNotification,
  createSuccessNotification,
  createErrorNotification,
  formatDuration,
  formatCurrency,
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node slack-notifier.js <webhook-url> <type>');
    console.log('\nTypes:');
    console.log('  test-success    Send test success notification');
    console.log('  test-error      Send test error notification');
    console.log('  test-simple     Send simple text message');
    console.log('\nExample:');
    console.log('  node slack-notifier.js https://hooks.slack.com/... test-success');
    process.exit(1);
  }
  
  const webhookUrl = args[0];
  const type = args[1];
  
  if (type === 'test-success') {
    const mockResult = {
      products: [
        { asin: 'B07PGL2ZSL', title: 'Echo Dot (3rd Gen)', price: 49.99, currency: 'USD', ordered_items: 156, shipped_revenue: 7794.44, earnings: 389.72 },
        { asin: 'B079QHML21', title: 'Fire TV Stick 4K', price: 39.99, currency: 'USD', ordered_items: 142, shipped_revenue: 5680.00, earnings: 284.00 },
        { asin: 'B07WMLJ8TG', title: 'Kindle Paperwhite', price: 129.99, currency: 'USD', ordered_items: 128, shipped_revenue: 16639.72, earnings: 831.99 },
      ],
      metadata: {
        enrichmentMetadata: {
          enrichedCount: 97,
          failedCount: 3,
          successRate: 0.97,
        },
      },
      feedPath: '/feeds/mula/primary/20251107/top-products.json',
      processingTime: 12300,
    };
    
    sendFeedNotification(mockResult, webhookUrl, { reportDate: '2025-11-07' })
      .then(result => {
        if (result.success) {
          console.log('✅ Test notification sent successfully');
        } else {
          console.error('❌ Failed to send notification:', result.error);
        }
      });
  } else if (type === 'test-error') {
    const mockError = {
      message: 'PA-API authentication failed: Invalid credentials',
    };
    
    sendErrorNotification(mockError, webhookUrl, { step: 'PA-API Enrichment' })
      .then(result => {
        if (result.success) {
          console.log('✅ Test error notification sent successfully');
        } else {
          console.error('❌ Failed to send notification:', result.error);
        }
      });
  } else if (type === 'test-simple') {
    sendSimpleNotification('🚀 Test message from Amazon Product Feed Enrichment Tool', webhookUrl)
      .then(result => {
        if (result.success) {
          console.log('✅ Test message sent successfully');
        } else {
          console.error('❌ Failed to send notification:', result.error);
        }
      });
  } else {
    console.error(`❌ Unknown type: ${type}`);
    process.exit(1);
  }
}

