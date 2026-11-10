const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// API Configuration
const API_BASE_URL = 'https://androidartist.com/api/process-topup';
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. Process Top-Up Endpoint (AndroidArtist मा अर्डर पठाउने)
// ==========================================
app.post('/api/topup', async (req, res) => {
  try {
    const { api, orderid, playerid, code, url } = req.body;

    // Basic Validation
    if (!api || !orderid || !playerid || !code || !url) {
      return res.status(400).json({
        status: 'error',
        message: 'सबै fields (api, orderid, playerid, code, url) अनिवार्य छन्।'
      });
    }

    // Payload for AndroidArtist
    const payload = {
      api,
      orderid,
      playerid,
      code,
      url 
    };

    console.log('--- Sending Top-Up Request to AndroidArtist ---');
    console.log(JSON.stringify(payload, null, 2));

    // Sending request to androidartist API
    const response = await axios.post(API_BASE_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('--- AndroidArtist Immediate Response ---');
    console.log(JSON.stringify(response.data, null, 2));

    return res.status(200).json(response.data);

  } catch (error) {
    console.error('TopUp API Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Topup request failed',
      details: error.response ? error.response.data : error.message
    });
  }
});

// ==========================================
// 2. Webhook / Callback Listener Endpoint
// ==========================================
app.post('/api/auto-topup/webhook', (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received from AndroidArtist ---');
  console.log(JSON.stringify(webhookData, null, 2));

  const orderid = webhookData.orderid;
  const status = webhookData.status; // success, error, partial

  // 1. यदि अर्डर सफल हुन्छ भने
  if (status === 'success') {
    console.log(`Order ${orderid} is SUCCESSFUL.`);
    
    // TODO: आफ्नो Database (Firebase/MongoDB/MySQL) मा status 'success' राख्ने कोड यहाँ लेख्नुहोला
    // Jastai: 
    // updateDatabaseOrderStatus(orderid, 'success');
  } 
  // 2. यदि अर्डर असफल हुन्छ भने (तपाईँको माग्नुभएको अनुसार 'cancel' गर्ने)
  else if (status === 'error') {
    console.log(`Order ${orderid} FAILED. Reason: ${webhookData.content}`);
    
    // TODO: आफ्नो Database मा status 'cancel' राख्ने कोड यहाँ लेख्नुहोला
    // Jastai: 
    // updateDatabaseOrderStatus(orderid, 'cancel');
  }
  // 3. यदि multi-voucher मा partial (आंशिक सफल) हुन्छ भने
  else if (status === 'partial') {
    console.log(`Order ${orderid} completed with PARTIAL status.`);
    
    // TODO: आवश्यकता अनुसार partial लाई पनि cancel वा partial नै save गर्ने
    // Jastai: 
    // updateDatabaseOrderStatus(orderid, 'cancel'); // वा 'partial'
  }

  // एन्ड्रोइड आर्टिस्टलाई क्यालब्याक पायो भनेर HTTP 200 OK Response फर्काउने (अनिवार्य)
  res.status(200).json({ received: true });
});

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Free Fire Automated Top-Up Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
