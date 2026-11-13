const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- FIREBASE INITIALIZATION ---
// Tapai ko firebase project id: rg-digital-store
// Note: Firebase Admin SDK ko lagi serviceAccountKey.json file project folder ma rakhnu parcha 
// athava environment variables use garnu parcha.
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

    // Call AlicStore API
    const response = await axios.post(`${ALIC_BASE_URL}/variations`, {
      secret_key: secret_key
    });

    // Variations data ma package_id inclusively huncha
    const variations = response.data.data;

    // Optional: Tapaiile backend/database ma ni yiniharu cache/save garna saknu huncha
    console.log('Fetched Variations with Alic Package IDs:', variations);

    return res.status(200).json({
      status: 'success',
      data: variations // Yesma package_id, name, title, price sabai dekhincha
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

    // Webhook URL jaha alicstore le status pathaucha
    const webhook_url = process.env.WEBHOOK_URL || 'https://gaule-store.onrender.com/api/webhook-receiver';

    // Call AlicStore Place Order API
    const alicResponse = await axios.post(`${ALIC_BASE_URL}/place-order`, {
      secret_key,
      package_id,     // Alic ko package id backend bata pass garidiyeko cha
      player_id,
      client_order_id,
      quantity: quantity || 1,
      webhook_url
    });

    const orderData = alicResponse.data;

    // Order details lai Firebase Firestore ma save garne (Alic package_id pani store huncha)
    await db.collection('orders').doc(client_order_id).set({
      client_order_id,
      alic_order_id: orderData.orderid || null,
      package_id,     // Backend ma Alic package id dekhauxa ra store huncha
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

    // Firebase ma orderid (or client_order_id match garera) update garne
    // Note: AlicStore webhook le 'orderid' pathauxa (jaslai aghi place order garda orderid vanera deko thiyo)
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('alic_order_id', '==', orderid).get();

    if (!snapshot.empty) {
      snapshot.forEach(async (doc) => {
        await doc.ref.update({
          status: status, // 'success' or 'error'
          content: content,
          updatedAt: admin.firestore.
