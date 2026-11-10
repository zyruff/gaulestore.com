const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// ==========================================
// Firebase Admin SDK Setup (Render Environment Variables बाट)
// ==========================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
    })
  });
}

const db = admin.firestore();

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
app.post('/api/auto-topup/webhook', async (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received from AndroidArtist ---');
  console.log(JSON.stringify(webhookData, null, 2));

  const orderId = webhookData.orderid; // यो Firestore मा अर्डर बनाउँदाको Doc ID सँग मिल्नुपर्छ

  if (!orderId) {
    return res.status(400).json({ status: 'error', message: 'Order ID missing in webhook data' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.log(`Order ID ${orderId} not found in Firestore.`);
      return res.status(404).json({ status: 'error', message: 'Order not found in database' });
    }

    // जब अर्डर सफल हुन्छ
    if (webhookData.status === 'success') {
      console.log(`Order ${orderId} is SUCCESSFUL.`);
      
      // Firestore मा status 'success' बनाउने
      await orderRef.update({
        status: 'success',
        apiResponseMsg: webhookData.content || 'Success'
      });
    } 
    // जब अर्डर असफल हुन्छ (Error / Cancel)
    else if (webhookData.status === 'error') {
      console.log(`Order ${orderId} FAILED. Reason: ${webhookData.content}`);
      
      // Firestore मा status 'cancel' बनाउने
      await orderRef.update({
        status: 'cancel',
        apiResponseMsg: webhookData.content || 'Failed'
      });
    }

    // एन्ड्रोइड आर्टिस्टलाई क्यालब्याक पायो भनेर HTTP 200 OK Response फर्काउने (अनिवार्य)
    return res.status(200).json({ received: true });

  } catch (dbError) {
    console.error('Database Update Error in Webhook:', dbError.message);
    return res.status(500).json({ status: 'error', message: dbError.message });
  }
});

// Health Check Endpoint (Render सर्भरलाई जगाइराख्नको लागि)
app.get('/', (req, res) => {
  res.send('Free Fire Automated Top-Up Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
