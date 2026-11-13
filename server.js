const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- FIREBASE INITIALIZATION ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'rg-digital-store'
});

const db = admin.firestore();

// AlicStore API Base URL
const ALIC_BASE_URL = 'https://alicstore.com/api';

// ==========================================
// 1. GET VARIATIONS LIST (ALIC package_id dekhaune)
// ==========================================
app.post('/api/variations', async (req, res) => {
  try {
    const { secret_key } = req.body;

    if (!secret_key) {
      return res.status(400).json({ status: 'error', message: 'Secret key is required.' });
    }

    const response = await axios.post(`${ALIC_BASE_URL}/variations`, {
      secret_key: secret_key
    });

    const variations = response.data.data;
    console.log('Fetched Variations with Alic Package IDs:', variations);

    return res.status(200).json({
      status: 'success',
      data: variations
    });

  } catch (error) {
    console.error('Error fetching variations:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { status: 'error', message: 'Internal Server Error' }
    );
  }
});

// ==========================================
// 2. PLACE ORDER
// ==========================================
app.post('/api/place-order', async (req, res) => {
  try {
    const { secret_key, package_id, player_id, client_order_id, quantity } = req.body;

    if (!secret_key || !package_id || !player_id || !client_order_id) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    const webhook_url = process.env.WEBHOOK_URL || 'https://gaule-store.onrender.com/api/webhook-receiver';

    const alicResponse = await axios.post(`${ALIC_BASE_URL}/place-order`, {
      secret_key,
      package_id,
      player_id,
      client_order_id,
      quantity: quantity || 1,
      webhook_url
    });

    const orderData = alicResponse.data;

    await db.collection('orders').doc(client_order_id).set({
      client_order_id,
      alic_order_id: orderData.orderid || null,
      package_id,
      player_id,
      quantity: quantity || 1,
      status: orderData.status || 'processing',
      content: orderData.content,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json(orderData);

  } catch (error) {
    console.error('Error placing order:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { status: 'error', message: 'Failed to place order' }
    );
  }
});

// ==========================================
// 3. WEBHOOK RECEIVER (Incoming from AlicStore)
// ==========================================
app.post('/api/webhook-receiver', async (req, res) => {
  try {
    const { orderid, status, content } = req.body;

    console.log('Received Webhook:', req.body);

    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('alic_order_id', '==', orderid).get();

    if (!snapshot.empty) {
      snapshot.forEach(async (doc) => {
        await doc.ref.update({
          status: status,
          content: content,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    }

    return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Error handling webhook:', error.message);
    return res.status(500).json({ status: 'error', message: 'Webhook handling failed' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
