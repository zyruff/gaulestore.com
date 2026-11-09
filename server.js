// server.js (Pura & Final Code - Small letter status + Unbound, Wishlist & IP Checker added)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin securely using Environment Variable
try {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "rg-digital-store",
        clientEmail: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40rg-digital-store.iam.gserviceaccount.com",
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com"
    });
  } else {
    admin.initializeApp({
      databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com"
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
      '/api/orders/unbound',
      '/api/otp',
      '/api/webhook',
      '/api/wishlist/add',
      '/api/wishlist/:userId',
      '/api/wishlist/:userId/:itemId',
      '/api/get-my-ip'
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

// 4. Unbound API Route (Added)
app.get('/api/orders/unbound', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/orders`, {
      headers: getAuthHeaders(),
      params: req.query
    });
    
    res.json({
      status: 'success',
      source: 'unbound_api',
      data: response.data
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

// 5. Generate TOTP Code
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

// 6. Webhook Listener (Updates Firebase order status to small letters: complete / failed)
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

// 7. Add item to Wishlist (Added)
app.post('/api/wishlist/add', async (req, res) => {
  const { userId, packageId, packageName, price } = req.body;

  if (!userId || !packageId) {
    return res.status(400).json({
      status: 'failed',
      message: 'userId and packageId are required fields.',
    });
  }

  try {
    const wishlistItem = {
      packageId: String(packageId),
      packageName: packageName || 'Unknown Package',
      price: price || 0,
      createdAt: Date.now()
    };

    const wishlistRef = db.ref(`wishlists/${userId}`);
    const newRef = wishlistRef.push();
    await newRef.set(wishlistItem);

    res.json({
      status: 'success',
      message: 'Package added to wishlist successfully',
      wishlistId: newRef.key
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// 8. Get User's Wishlist (Added)
app.get('/api/wishlist/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const wishlistRef = db.ref(`wishlists/${userId}`);
    const snapshot = await wishlistRef.once('value');

    if (!snapshot.exists()) {
      return res.json({
        status: 'success',
        data: []
      });
    }

    const wishlistItems = [];
    snapshot.forEach((childSnapshot) => {
      wishlistItems.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    res.json({
      status: 'success',
      data: wishlistItems
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// 9. Remove item from Wishlist (Added)
app.delete('/api/wishlist/:userId/:itemId', async (req, res) => {
  const { userId, itemId } = req.params;

  try {
    await db.ref(`wishlists/${userId}/${itemId}`).remove();
    res.json({
      status: 'success',
      message: 'Item removed from wishlist successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// 10. Check Render Outbound IP Address (Added for TZ API IP Whitelist)
app.get('/api/get-my-ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    res.json({
      status: 'success',
      render_outbound_ip: response.data.ip,
      message: 'Yo IP lai TZ API ko IP Whitelist ma halnu hos.'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
