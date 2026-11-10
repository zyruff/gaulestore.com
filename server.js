const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// API Configuration
const API_BASE_URL = 'https://androidartist.com/api/process-topup';
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. Process Top-Up Endpoint
// ==========================================
app.post('/api/topup', async (req, res) => {
  try {
    const { 
      api, 
      orderid, 
      playerid, 
      code, 
      url, 
      package: pkg, 
      username, 
      password, 
      autocode 
    } = req.body;

    // Basic Validation
    if (!api || !orderid || !playerid || !code || !url) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: api, orderid, playerid, code, and url are required.'
      });
    }

    // Payload construction
    const payload = {
      api,
      orderid,
      playerid,
      code,
      url
    };

    // If Garena Shell Order
    if (code === 'shell') {
      if (!pkg || !username || !password || !autocode) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters for Garena Shell topup.'
        });
      }
      payload.package = pkg;
      payload.username = username;
      payload.password = password;
      payload.autocode = autocode;
    }

    // Sending request to androidartist API
    const response = await axios.post(API_BASE_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Return the API response back to client
    return res.status(200).json(response.data);

  } catch (error) {
    console.error('TopUp API Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process topup request',
      details: error.response ? error.response.data : error.message
    });
  }
});

// ==========================================
// 2. Webhook Listener Endpoint (Your Site URL)
// ==========================================
// यो Endpoint तपाईंको site को URL (e.g., https://gaule-store.onrender.com/api/auto-topup/webhook) मा set गर्न सकिन्छ
app.post('/api/auto-topup/webhook', (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received ---');
  console.log(JSON.stringify(webhookData, null, 2));

  // Single Voucher Callback Processing
  if (webhookData.status === 'success' && !webhookData.parts) {
    console.log(`Order ${webhookData.orderid} is SUCCESSFUL.`);
    // TODO: DB मा status update गर्ने कोड यहाँ राख्नुहोस्
  } 
  // Multi-Voucher / Consolidated Callback Processing
  else if (webhookData.parts) {
    console.log(`Multi-Voucher Order ${webhookData.orderid} completed with status: ${webhookData.status}`);
    console.log(`Total Success: ${webhookData.total_success}/${webhookData.total_vouchers}`);
    // TODO: DB मा multi-part order status update गर्ने कोड यहाँ राख्नुहोस्
  } 
  // Error Callback Processing
  else if (webhookData.status === 'error') {
    console.log(`Order ${webhookData.orderid} FAILED. Reason: ${webhookData.content}`);
    // TODO: DB मा order failed update गर्ने कोड यहाँ राख्नुहोस्
  }

  // API लाई HTTP 200 OK Response पठाउने
  res.status(200).json({ received: true });
});

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Free Fire Top-Up Automated Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
