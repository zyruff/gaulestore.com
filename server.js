// server.js (Pura & Final Code - Small letter status)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin securely using Environment Variable
try {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "gaule-top-up-center",
        clientEmail: "firebase-adminsdk-fbsvc@gaule-top-up-center.iam.gserviceaccount.com",
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
    });
  } else {
    admin.initializeApp({
      databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
    });
  }
} catch (e) {
  // Already initialized fallback
}

const db = admin.database();
const app = express();

// Enable CORS for frontend accessibility
app.use(cors());
app.use(express.json());

// Configurations
const BASE_URL = process.env.BASE_URL || 'https://androidartist.com/api/process-topup';
const API_KEY = process.env.API_KEY || 'YOUR_SECRET_KEY';

const getAuthHeaders = () => ({
  'X-API-KEY': API_KEY,
  'Content-Type': 'application/json',
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Gaule Store API Service is active',
    endpoints: [
      '/api/packages',
      '/api/order/create',
      '/api/order/status',
      '/api/otp',
      '/api/webhook'
    ]
  });
});

// 1. GET Active Packages
app.get('/api/packages', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/packages`, { headers: getAuthHeaders() });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

// 2. Create TopUp Order
app.post('/api/order/create', async (req, res) => {
  const { playerid, package: pkgId, code, orderid, callback_url } = req.body;

  if (!playerid || !pkgId) {
    return res.status(400).json({
      status: 'failed',
      message: 'playerid and package are required fields.',
    });
  }

  try {
    const payload = {
      playerid: String(playerid),
      package: Number(pkgId),
      orderid: orderid || `GAULE-${Date.now()}`,
      callback_url: callback_url || 'https://gaule-store.onrender.com/api/webhook'
    };

    if (code) payload.code = code;

    const response = await axios.post(`${BASE_URL}/order/create`, payload, {
      headers: getAuthHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

// 3. Check Order Status
app.get('/api/order/status', async (req, res) => {
  const { order_id, user_order_id } = req.query;

  if (!order_id && !user_order_id) {
    return res.status(400).json({
      status: 'failed',
      message: 'Please provide either order_id or user_order_id.',
    });
  }

  try {
    const response = await axios.get(`${BASE_URL}/order/status`, {
      headers: getAuthHeaders(),
      params: { order_id, user_order_id },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

// 4. Generate TOTP Code
app.get('/api/otp', async (req, res) => {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({
      status: 'failed',
      message: 'Base32 secret key is required.',
    });
  }

  try {
    const response = await axios.get(`${BASE_URL}/otp`, {
      headers: getAuthHeaders(),
      params: { key },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

// 5. Webhook Listener (Updates Firebase order status to small letters: complete / failed)
app.post('/api/webhook', async (req, res) => {
  const payload = req.body;
  console.log('--- Webhook Received ---', payload);

  try {
    const apiOrderId = payload.api_order_id || payload.order_id || payload.orderid;
    const orderStatus = payload.status;

    if (apiOrderId && orderStatus) {
      const ordersRef = db.ref('orders');
      const snapshot = await ordersRef.orderByChild('apiOrderId').equalTo(String(apiOrderId)).once('value');

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const orderKey = childSnapshot.key;
          let newStatus = "pending";
          
          const statusLower = String(orderStatus).toLowerCase();
          if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'complete') {
            newStatus = "complete";
          } else if (statusLower === 'failed' || statusLower === 'fail') {
            newStatus = "failed";
          }

          db.ref(`orders/${orderKey}`).update({
            status: newStatus,
            updatedAt: Date.now()
          });
          console.log(`Order ${orderKey} updated to: ${newStatus}`);
        });
      }
    }

    res.status(200).json({ status: 'success', message: 'Webhook processed and status updated' });
  } catch (err) {
    console.error("Webhook Database Error:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
