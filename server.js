// server.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://tzapi.tzsmm.com/api/v1/user';
const API_KEY = process.env.API_KEY || 'YOUR_SECRET_KEY';

// Common Headers for API Request
const getAuthHeaders = () => ({
  'X-API-KEY': API_KEY,
  'Content-Type': 'application/json',
});

// Root Route (So that visiting https://gaule-store.onrender.com doesn't show Cannot GET /)
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Gaule Store API Gateway is running live!',
    endpoints: {
      packages: '/api/packages',
      create_order: '/api/order/create (POST)',
      check_status: '/api/order/status?order_id=OR_user_order_id',
      generate_otp: '/api/otp?key=YOUR_BASE32_KEY',
      webhook: '/api/webhook (POST)'
    }
  });
});

/**
 * 1. GET Active Packages
 * GET /api/packages
 */
app.get('/api/packages', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/packages`, {
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

/**
 * 2. Create TopUp Order
 * POST /api/order/create
 * Body JSON: { "playerid": "12345678", "package": 25, "code": "VOUCHERPIN", "orderid": "TRACK-001", "callback_url": "https://gaule-store.onrender.com/api/webhook" }
 */
app.post('/api/order/create', async (req, res) => {
  const { playerid, package: pkgId, code, orderid, callback_url } = req.body;

  if (!playerid || !pkgId || !code) {
    return res.status(400).json({
      status: 'failed',
      message: 'playerid, package, and code are required fields.',
    });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/order/create`,
      {
        playerid,
        package: pkgId,
        code,
        orderid,
        callback_url,
      },
      {
        headers: getAuthHeaders(),
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data || error.message,
    });
  }
});

/**
 * 3. Check Order Status
 * GET /api/order/status?order_id=TZUP-ABCD12345678 OR ?user_order_id=TRACK-001
 */
app.get('/api/order/status', async (req, res) => {
  const { order_id, user_order_id } = req.query;

  if (!order_id && !user_order_id) {
    return res.status(400).json({
      status: 'failed',
      message: 'Please provide either order_id or user_order_id as query parameters.',
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

/**
 * 4. Generate TOTP Code
 * GET /api/otp?key=YOUR_BASE32_SECRET
 */
app.get('/api/otp', async (req, res) => {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({
      status: 'failed',
      message: 'Base32 secret key is required as ?key=... parameter.',
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
      error: error.response?.data || error.message,
    });
  }
});

/**
 * 5. Webhook Listener (Callback Endpoint)
 * POST /api/webhook
 */
app.post('/api/webhook', (req, res) => {
  const payload = req.body;
  console.log('--- Webhook Notification Received ---');
  console.log(JSON.stringify(payload, null, 2));

  // Yaha timile order success/failed huda database update garne logic rakhna sakxau
  res.status(200).json({ status: 'success', message: 'Webhook received successfully' });
});

// Start Server bound to Render's dynamic PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gaule Store server is running on port ${PORT}`);
});
