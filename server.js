const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- FIREBASE INITIALIZATION (rg-digital-store) ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'rg-digital-store'
});

const db = admin.firestore();

// AlicStore API Base URL
const ALIC_BASE_URL = 'https://alicstore.com/api';

// ==========================================
// 0. BROWSER UI TO VIEW PACKAGE IDs EASILY
// ==========================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Gaule Store - Package IDs Viewer</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        input, button { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { background: #28a745; color: white; border: none; font-weight: bold; cursor: pointer; }
        button:hover { background: #218838; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>AlicStore Package IDs Viewer</h2>
        <form id="pkgForm">
          <label><b>Master Secret Key:</b></label>
          <input type="text" id="secret_key" placeholder="Enter your AlicStore Secret Key" required />
          <button type="submit">Fetch Package IDs</button>
        </form>
        <h3>Response / Package List:</h3>
        <pre id="result">Enter your secret key above and click the button...</pre>
      </div>
      <script>
        document.getElementById('pkgForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const secret_key = document.getElementById('secret_key').value;
          const resultPre = document.getElementById('result');
          resultPre.textContent = 'Loading packages...';
          try {
            const res = await fetch('/api/variations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ secret_key })
            });
            const data = await res.json();
            resultPre.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            resultPre.textContent = 'Error: ' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// 1. GET VARIATIONS LIST (ALIC package_id)
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

    return res.status(200).json(response.data);

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

    // Save in Firebase (rg-digital-store)
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
