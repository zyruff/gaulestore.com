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

// API Configuration (Master Panel / Reseller API)
// domain.com को ठाउँमा https://alicstore.com राखिएको छ
const MASTER_API_URL = process.env.MASTER_API_URL || 'https://alicstore.com/api';
const MASTER_API_SECRET = process.env.MASTER_API_SECRET || 'YOUR_API_SECRET_KEY';
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. Get Variations List Endpoint
// Route: POST /api/variations
// ==========================================
app.post('/api/variations', async (req, res) => {
  try {
    const response = await axios.post(`${MASTER_API_URL}/variations`, {
      secret_key: MASTER_API_SECRET
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Get Variations Error:', error.response ? error.response.data : error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching variations."
    });
  }
});

// ==========================================
// 2. Place Order Endpoint (Master Panel मा अर्डर पठाउने)
// ==========================================
app.post('/api/place-order', async (req, res) => {
  try {
    const { package_id, player_id, client_order_id, quantity, webhook_url } = req.body;

    if (!package_id || !player_id || !client_order_id || !quantity) {
      return res.status(400).json({
        status: 'error',
        message: 'सबै order parameters अनिवार्य छन्।'
      });
    }

    const payload = {
      secret_key: MASTER_API_SECRET,
      package_id,
      player_id,
      client_order_id,
      quantity,
      webhook_url: webhook_url || `${req.protocol}://${req.get('host')}/api/webhook-receiver`
    };

    const response = await axios.post(`${MASTER_API_URL}/place-order`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const orderData = response.data;
    if (orderData.orderid) {
      await db.collection('orders').doc(client_order_id).set({
        masterOrderId: orderData.orderid,
        package_id,
        player_id,
        quantity,
        status: orderData.status || 'processing',
        createdAt: new Date().toISOString()
      }, { merge: true });
    }

    return res.status(200).json(orderData);

  } catch (error) {
    console.error('Place Order API Error:', error.response ? error.response.data : error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      status: 'error',
      message: 'Place order request failed',
      details: error.message
    });
  }
});

// ==========================================
// 3. Webhook / Callback Listener Endpoint
// ==========================================
app.post('/api/webhook-receiver', async (req, res) => {
  const webhookData = req.body;

  console.log('--- Webhook Received from Master Panel ---');
  console.log(JSON.stringify(webhookData, null, 2));

  const orderId = webhookData.orderid; 

  if (!orderId) {
    return res.status(400).json({ status: 'error', message: 'Order ID missing' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    let orderDoc = await orderRef.get();

    let querySnapshot = null;
    if (!orderDoc.exists) {
      querySnapshot = await db.collection('orders').where('masterOrderId', '==', orderId).get();
    }

    if (!orderDoc.exists && (querySnapshot && querySnapshot.empty)) {
      console.log(`Order ID ${orderId} not found in Firestore.`);
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const targetRef = orderDoc.exists ? orderRef : querySnapshot.docs[0].ref;

    if (webhookData.status === 'success') {
      await targetRef.update({
        status: 'success',
        apiResponseMsg: webhookData.content || 'Order completed successfully.',
        updatedAt: new Date().toISOString()
      });
      console.log(`Order ${orderId} updated to success.`);
    } else if (webhookData.status === 'error') {
      await targetRef.update({
        status: 'cancel',
        apiResponseMsg: webhookData.content || 'Order failed or was cancelled.',
        updatedAt: new Date().toISOString()
      });
      console.log(`Order ${orderId} updated to cancel.`);
    }

    return res.status(200).json({ status: "success", message: "Webhook received successfully." });

  } catch (dbError) {
    console.error('Database Update Error in Webhook:', dbError.message);
    return res.status(500).json({ status: 'error', message: dbError.message });
  }
});

app.get('/', (req, res) => {
  res.send('Reseller API Automated Top-Up Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
