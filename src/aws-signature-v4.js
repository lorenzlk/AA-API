/**
 * AWS Signature Version 4 Signing
 * 
 * Generates AWS Signature v4 for Amazon Product Advertising API requests.
 * Required for PA-API authentication.
 * 
 * Reference: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html
 */

const CryptoJS = require('crypto-js');

/**
 * Generates canonical URI from path
 * @param {string} path - URL path
 * @returns {string} Canonical URI
 */
function getCanonicalUri(path) {
  if (!path || path === '/') {
    return '/';
  }
  
  return encodeURI(path)
    .replace(/%2F/g, '/')
    .replace(/\+/g, '%20');
}

/**
 * Generates canonical query string from parameters
 * @param {Object} params - Query parameters
 * @returns {string} Canonical query string
 */
function getCanonicalQueryString(params) {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  
  const sortedKeys = Object.keys(params).sort();
  const pairs = sortedKeys.map(key => {
    const value = params[key];
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  });
  
  return pairs.join('&');
}

/**
 * Generates canonical headers string
 * @param {Object} headers - HTTP headers
 * @returns {string} Canonical headers
 */
function getCanonicalHeaders(headers) {
  const sortedKeys = Object.keys(headers)
    .map(key => key.toLowerCase())
    .sort();
  
  return sortedKeys
    .map(key => `${key}:${headers[key].toString().trim()}\n`)
    .join('');
}

/**
 * Gets signed headers string
 * @param {Object} headers - HTTP headers
 * @returns {string} Signed headers
 */
function getSignedHeaders(headers) {
  return Object.keys(headers)
    .map(key => key.toLowerCase())
    .sort()
    .join(';');
}

/**
 * Creates SHA256 hash
 * @param {string} data - Data to hash
 * @returns {string} Hex hash
 */
function hash(data) {
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

/**
 * Creates HMAC SHA256
 * @param {*} key - Signing key
 * @param {string} data - Data to sign
 * @returns {*} HMAC result
 */
function hmac(key, data) {
  return CryptoJS.HmacSHA256(data, key);
}

/**
 * Derives signing key
 * @param {string} secret - AWS secret key
 * @param {string} dateStamp - Date stamp (YYYYMMDD)
 * @param {string} region - AWS region
 * @param {string} service - AWS service name
 * @returns {*} Signing key
 */
function getSignatureKey(secret, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

/**
 * Signs AWS request with Signature Version 4
 * @param {Object} params - Request parameters
 * @param {string} params.method - HTTP method (GET, POST, etc.)
 * @param {string} params.path - Request path
 * @param {Object} params.queryParams - Query parameters
 * @param {Object} params.headers - HTTP headers
 * @param {string} params.payload - Request body
 * @param {string} params.accessKey - AWS access key
 * @param {string} params.secretKey - AWS secret key
 * @param {string} params.region - AWS region
 * @param {string} params.service - AWS service (e.g., 'ProductAdvertisingAPI')
 * @returns {Object} Signed headers
 */
function signRequest(params) {
  const {
    method = 'POST',
    path = '/',
    queryParams = {},
    headers = {},
    payload = '',
    accessKey,
    secretKey,
    region,
    service = 'ProductAdvertisingAPI',
  } = params;
  
  // Create timestamp
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  // Step 1: Create canonical request
  const canonicalUri = getCanonicalUri(path);
  const canonicalQueryString = getCanonicalQueryString(queryParams);
  
  // Add required headers
  const requestHeaders = {
    ...headers,
    'x-amz-date': amzDate,
  };
  
  const canonicalHeaders = getCanonicalHeaders(requestHeaders);
  const signedHeaders = getSignedHeaders(requestHeaders);
  const payloadHash = hash(payload);
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Step 2: Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');
  
  // Step 3: Calculate signature
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign).toString(CryptoJS.enc.Hex);
  
  // Step 4: Add signing information to headers
  const authorizationHeader = 
    `${algorithm} Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...requestHeaders,
    'Authorization': authorizationHeader,
  };
}

/**
 * Signs PA-API request
 * @param {Object} params - Request parameters
 * @param {Object} params.payload - Request body object
 * @param {string} params.accessKey - PA-API access key
 * @param {string} params.secretKey - PA-API secret key
 * @param {string} params.region - AWS region
 * @param {string} params.host - PA-API host
 * @param {string} params.path - Request path
 * @returns {Object} Signed headers and payload
 */
function signPaApiRequest(params) {
  const {
    payload,
    accessKey,
    secretKey,
    region,
    host,
    path = '/paapi5/getitems',
    operation = 'GetItems', // GetItems, SearchItems, etc.
  } = params;
  
  const payloadString = JSON.stringify(payload);
  
  const headers = signRequest({
    method: 'POST',
    path,
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      'host': host,
      'x-amz-target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
    },
    payload: payloadString,
    accessKey,
    secretKey,
    region,
    service: 'ProductAdvertisingAPI',
  });
  
  return {
    headers,
    payload: payloadString,
  };
}

// Export functions
module.exports = {
  signRequest,
  signPaApiRequest,
  hash,
  getCanonicalUri,
  getCanonicalQueryString,
  getCanonicalHeaders,
  getSignedHeaders,
};

// Test if run directly
if (require.main === module) {
  console.log('AWS Signature V4 Module');
  console.log('This module provides AWS request signing for PA-API.');
  console.log('\nTest signing a sample request...\n');
  
  const testPayload = {
    ItemIds: ['B07PGL2ZSL'],
    PartnerTag: 'test-20',
    PartnerType: 'Associates',
    Resources: ['ItemInfo.Title'],
  };
  
  const signed = signPaApiRequest({
    payload: testPayload,
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    host: 'webservices.amazon.com',
  });
  
  console.log('Signed Headers:');
  Object.keys(signed.headers).forEach(key => {
    console.log(`  ${key}: ${signed.headers[key]}`);
  });
  
  console.log('\n✅ Signature generation working correctly');
}

