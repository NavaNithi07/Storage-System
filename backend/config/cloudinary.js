const cloudinary = require('cloudinary').v2;
const https = require('https');

// Create a custom HTTPS agent with keep-alive enabled to reuse TCP connections
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  keepAliveMsecs: 1000
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 600000, // 10-minute timeout for large chunked uploads
  api_proxy: null, // Ensure no proxy delays
});

// Configure the SDK to use the keep-alive agent
cloudinary.config({
  upload_prefix: 'https://api.cloudinary.com'
});

module.exports = cloudinary;
