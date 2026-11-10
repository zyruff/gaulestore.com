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
      url // यहाँ तपाईंको https://gaule-store.onrender.com/api/auto-topup/webhook जानुपर्छ
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
// 2. Webhook / Callback Listener Endpoint (Render मा Callback आउने ठाउँ)
// ==========================================
app.post('/api/auto-topup/webhook', (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received from AndroidArtist ---');
  console.log(JSON.stringify(webhookData, null, 2));

  // जब अर्डर सफल हुन्छ
  if (webhookData.status === 'success') {
    console.log(`Order ${webhookData.orderid} is SUCCESSFUL.`);
    // TODO: यहाँ आफ्नो Database मा अर्डर Status 'success' अपडेट गर्ने कोड राख्नुहोला
  } 
  // जब अर्डर असफल हुन्छ
  else if (webhookData.status === 'error') {
    console.log(`Order ${webhookData.orderid} FAILED. Reason: ${webhookData.content}`);
    // TODO: यहाँ आफ्नो Database मा अर्डर Status 'failed' अपडेट गर्ने कोड राख्नुहोला
  }

  // एन्ड्रोइड आर्टिस्टलाई क्यालब्याक पायो भनेर HTTP 200 OK Response फर्काउने (अनिवार्य)
  res.status(200).json({ received: true });
});

// Health Check Endpoint (Render सर्भरलाई जगाइराख्नको लागि)
app.get('/', (req, res) => {
  res.send('Free Fire Automated Top-Up Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
