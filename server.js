const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(cors()); // CORS allow garne frontend ko lagi
app.use(express.json());

// Firebase Admin Initialize (Environment Variables bata)
admin.initializeApp({
  credential: admin.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
  }),
  databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
});

const db = admin.database();

const BASE_URL = 'https://tzapi.tzsmm.com';
const API_KEY = process.env.API_SECRET || process.env.API_KEY;

// Outbound IP check garne function
async function checkOutboundIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        console.log(`Server Outbound IP Address: ${response.data.ip}`);
    } catch (error) {
        console.error('Could not fetch outbound IP:', error.message);
    }
}

// Database bata voucher stock check garera remove garne function
async function getAndRemoveVoucher(dbKey) {
    const voucherRef = db.ref(`auto-top-up/${dbKey}`);
    const snapshot = await voucherRef.once('value');
    
    if (!snapshot.exists()) {
        throw new Error(`This package is currently Out of Stock!`);
    }

    const vouchers = snapshot.val();
    const voucherKeys = Object.keys(vouchers);
    
    if (voucherKeys.length === 0) {
        throw new Error(`This package is currently Out of Stock!`);
    }

    const firstKey = voucherKeys[0];
    const voucherCode = vouchers[firstKey];

    // Use bhayeko voucher lai Firebase database bata automatic remove garne
    await db.ref(`auto-top-up/${dbKey}/${firstKey}`).remove();

    return voucherCode;
}

// TopUp API Endpoint
app.post('/api/topup', async (req, res) => {
    const { playerId, packageId, dbKey, userOrderId } = req.body;

    try {
        if (!dbKey) {
            return res.status(400).json({ status: 'error', message: 'Package DB Key is missing!' });
        }

        // 1. Firebase database bata stock ko voucher code nikalne
        const voucherCode = await getAndRemoveVoucher(dbKey);

        // 2. UniPin API ma automated order create request pathaune
        const response = await axios.post(`${BASE_URL}/api/v1/user/order/create`, {
            playerid: playerId,
            package: parseInt(packageId),
            code: voucherCode,
            orderid: userOrderId,
            callback_url: 'https://gaule-store.onrender.com/api/webhook'
        }, {
            headers: { 'X-API-KEY': API_KEY }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.response?.data?.message || error.message 
        });
    }
});

// Webhook Endpoint
app.post('/api/webhook', (req, res) => {
    const webhookData = req.body;
    console.log('Webhook Received from UniPin:', webhookData);
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Gaule Store Server running on port ${PORT}`);
    await checkOutboundIP();
});
