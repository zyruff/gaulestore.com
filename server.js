const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// ==========================================
// Firebase Admin SDK Setup (Render Environment Variable बाट)
// ==========================================
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Initialized Successfully using SERVICE_ACCOUNT JSON!");
  } catch (error) {
    console.error("Firebase Initialization Error:", error.message);
  }
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

    if (!api || !orderid || !playerid || !code || !url) {
      return res.status(400).json({
        status: 'error',
        message: 'सबै fields अनिवार्य छन्।'
      });
    }

    const payload = { api, orderid, playerid, code, url };

    const response = await axios.post(API_BASE_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

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
app.post('/api/auto-topup/webhook', async (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received from AndroidArtist ---');
  console.log(JSON.stringify(webhookData, null, 2));

  const orderId = webhookData.orderid; 

  if (!orderId) {
    return res.status(400).json({ status: 'error', message: 'Order ID missing' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.log(`Order ID ${orderId} not found in Firestore.`);
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    if (webhookData.status === 'success') {
      await orderRef.update({
        status: 'success',
        apiResponseMsg: webhookData.content || 'Success'
      });
      console.log(`Order ${orderId} updated to success.`);
    } else if (webhookData.status === 'error') {
      await orderRef.update({
        status: 'cancel',
        apiResponseMsg: webhookData.content || 'Failed'
      });
      console.log(`Order ${orderId} updated to cancel.`);
    }

    return res.status(200).json({ received: true });

  } catch (dbError) {
    console.error('Database Update Error in Webhook:', dbError.message);
    return res.status(500).json({ status: 'error', message: dbError.message });
  }
});

app.get('/', (req, res) => {
  res.send('Free Fire Automated Top-Up Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
