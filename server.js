// server.js (Final & Fully Fixed)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin with Service Account (Fixes Render credential warning)
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "gaule-top-up-center",
      clientEmail: "firebase-adminsdk-fbsvc@gaule-top-up-center.iam.gserviceaccount.com",
      privateKey: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDZda9o3YaX3uqc\n+gErGOr88uVCBF5psmDKcvQT2ANcpPvi+LaUub1wv/9EZi0BpDS4zOCQV/23/BGC\n7qPiX5Rnf518/LulEwLAGNRAzk5EorjXbSGZ3UfWxMbUhoDM45HHQxgrQsK6UKIA\nEZMVVMZSVGEpbzVnpGkOYpio0BdGvq5v1WzXMhS7z4ptCtcl6FjKFoCLmrTYuN5m\nrFYnJSQwLWfAmIBFh8BpqReEaYRq8BQgLMBx1FCOd0piTSDXxthAAlvl7TKJTQuF\nkkXDicyARgKLjR8CK9aMOp6sOO3eh9Mr2iyNCV73zCab6vCRutN20fOOYiljC4X9\neW3D4CwzAgMBAAECggEAJGeex3v6iddASKpT4r6nrFQPjFdF5QT/TjUjZmUN3wch\nwhQoIMrdi5Ag8Hb4huNSDjQCTjfk2lXBKr2/wuiEZDVJjMCUu2Rs2/LsKbNACB6D\nulDjRKp2Wd6UeMTRsDtSztyNIcTp654PGNrYWERadTL6FyEufBzal5VrACviEa4Q\nLFTW71UXW84HlWH9104FBbx0TOFnT4ibuTzct+2MYQhsQ9L0IWXJS3cxdmdOAOtb\neO4lf2ZZs3y+WEa68kgy/zO/nds67qH6sSE4MBGMVkpePI/OUNesa5sAZzrT5wZq\n5S7gOnTiM3z7UCE8Ujglx3VpVGOhro32rQAe/53DFQKBgQD/4m52lmMVRkR2cuf2\nbAaNgUeUE6wDeYT4l33YK+sIlEk4QKpnxkAIwgvxvBupF0TsfH8WHqRzMByPoj/I\nIqvWJAYQZIQJ50k+mtpnCxG59PHRFwAbRmRbKI+23SblamlptxuBQpyz9yUZVi8d\nbc2qa2/dvZ+kOA8gjqdGMNtCZQKBgQDZjtBFIIDQy5NIQdNgYAF/CYp5l2dzA/LT\vcjjiEIXoPWSz8hj7NfRknB0Xcgr5B2qOn1YEA+ar6YElmyKayLLhg1s/HY97Xb6\nJUxa3qX1l28bfRz1t+3zyDNPotlCo2heSewN4JgfUkqEX7/B7uQMe2+xgsIHTeyJ\nNBiV+D5+twKBgGoBVh3Oo3GW0Jn5dFtD2VsZ6ZtQovw1hX6u07WQTCgbtlGViILB\nQJngOa6FbTgZqbYGxWdWfm4xykM+xgmVQ3bNKa301jZ8GH3VDRGPJmLRNLSYQLUL\n7ltNbGwnJgv4j376GmzsOZrckgPzDkW0zXUCWS+VdONFTg8Ayg9sAgl5AoGBAJEx\niLm5uX6ffonotINLT3RTD8GaVAYkinjZ3ipME5/lYj86wMg/lsFc9AQVWrRAJ7Qm\nGOUewus/cpL5OTMf0Tb3HhqwWtF1m8PSBKVYlnXTPOmhlCRBPmNGJ0hsrIaWu97B\ngvK4A45TwzuZE0cAgd36u05Cr+9kCAqBZC8iX8L9AoGAN1hLaxBGIfa9YzYYR/sB\nZwiIFufDqxIfpCKB8OAFPsjRHzP5zxEJ7NptSH+y0OC3D2A1VaAaVK2VMQciit3+\nUTSAcmAM4dxG2SYjsnM4x1BD1d3dYGdWdqUmq6ZF70AV7k8FqQ+OtKvhgpQQQTg1\nSTlG001dZ+tfj2jGA+uZHF4=\n-----END PRIVATE KEY-----`.replace(/\\n/g, '\n')
    }),
    databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
  });
} catch (e) {
  // Already initialized fallback
}

const db = admin.database();
const app = express();

// Enable CORS for frontend accessibility
app.use(cors());
app.use(express.json());

// Configurations
const BASE_URL = process.env.BASE_URL || 'https://tzapi.tzsmm.com/api/v1/user';
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

// 5. Webhook Listener (Updated to update Firebase Order Status automatically)
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
          let newStatus = "Pending";
          
          if (orderStatus.toLowerCase() === 'success' || orderStatus.toLowerCase() === 'completed') {
            newStatus = "Completed";
          } else if (orderStatus.toLowerCase() === 'failed') {
            newStatus = "Failed";
          }

          db.ref(`orders/${orderKey}`).update({
            status: newStatus,
            updatedAt: Date.now()
          });
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
