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
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL // Example: https://your-app-default-rtdb.firebaseio.com
    });
    console.log("Firebase Initialized Successfully using SERVICE_ACCOUNT JSON!");
  } catch (error) {
    console.error("Firebase Initialization Error:", error.message);
  }
}

// Firestore ko satta Realtime Database use gareko ✅
const db = admin.database();

// API Configuration (Master Panel / Reseller API - alicstore.com)
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
// Browser बाट सजिलै Package ID हरू हेर्नको लागि (GET Route)
// Route: GET /packages OR /check-packages
// ==========================================
app.get(['/packages', '/check-packages'], async (req, res) => {
  try {
    const response = await axios.post(`${MASTER_API_URL}/variations`, {
      secret_key: MASTER_API_SECRET
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch packages from master panel",
      details: error.response ? error.response.data : error.message
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
    
    // Realtime Database ma order save garne (client_order_id lai key banayera)
    if (orderData.orderid) {
      await db.ref('orders/' + client_order_id).set({
        masterOrderId: String(orderData.orderid),
        package_id,
        player_id,
        quantity,
        status: orderData.status || 'processing',
        createdAt: new Date().toISOString()
      });
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

  const masterOrderId = String(webhookData.orderid); 

  if (!masterOrderId) {
    return res.status(400).json({ status: 'error', message: 'Order ID missing' });
  }

  try {
    const ordersRef = db.ref('orders');
    
    // Realtime Database ma masterOrderId match garne order khojne query
    const snapshot = await ordersRef.orderByChild('masterOrderId').equalTo(masterOrderId).once('value');

    if (!snapshot.exists()) {
      console.log(`Master Order ID ${masterOrderId} not found in Realtime Database.`);
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    // Match vako order ko key ra reference liyeko
    let targetKey = null;
    snapshot.forEach((childSnapshot) => {
      targetKey = childSnapshot.key;
    });

    const targetRef = db.ref('orders/' + targetKey);

    if (webhookData.status === 'success') {
      await targetRef.update({
        status: 'success',
        apiResponseMsg: webhookData.content || 'Order completed successfully.',
        updatedAt: new Date().toISOString()
      });
      console.log(`Order with Master ID ${masterOrderId} updated to success.`);
    } else if (webhookData.status === 'error') {
      await targetRef.update({
        status: 'cancel',
        apiResponseMsg: webhookData.content || 'Order failed or was cancelled.',
        updatedAt: new Date().toISOString()
      });
      console.log(`Order with Master ID ${masterOrderId} updated to cancel.`);
    }

    return res.status(200).json({ status: "success", message: "Webhook received successfully." });

  } catch (dbError) {
    console.error('Database Update Error in Webhook:', dbError.message);
    return res.status(500).json({ status: 'error', message: dbError.message });
  }
});

app.get('/', (req, res) => {
  res.send('Reseller API Automated Top-Up Server is Running with Realtime Database!');
});

// Server Start हुँदा Render Logs मा स्वचालित रूपमा Package ID हरू प्रिन्ट हुनेछन्
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    const response = await axios.post(`${MASTER_API_URL}/variations`, {
      secret_key: MASTER_API_SECRET
    });
    console.log("=== MASTER PANEL AVAILABLE PACKAGES ===");
    console.table(response.data.data);
  } catch (err) {
    console.log("Could not fetch packages on startup (Check your MASTER_API_SECRET):", err.message);
  }
});
