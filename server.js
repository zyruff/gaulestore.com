const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(cors());
app.use(express.json());

// Firebase Admin Initialize
const projectId = process.env.FIREBASE_PROJECT_ID || "gaule-top-up-center";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: projectId,
    clientEmail: clientEmail,
    privateKey: privateKey
  }),
  databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
});

const db = admin.database();

const BASE_URL = 'https://tzapi.tzsmm.com';
const API_KEY = process.env.API_SECRET || process.env.API_KEY;

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

    await db.ref(`auto-top-up/${dbKey}/${firstKey}`).remove();
    return voucherCode;
}

// TopUp API Endpoint with Debug Log
app.post('/api/topup', async (req, res) => {
    console.log('==> /api/topup ROUTE HIT! Request body:', req.body);
    
    const { playerId, packageId, dbKey, userOrderId } = req.body;

    try {
        if (!dbKey || !playerId || !packageId) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters!' });
        }

        const voucherCode = await getAndRemoveVoucher(dbKey);

        const response = await axios.post(`${BASE_URL}/api/v1/user/order/create`, {
            playerid: String(playerId),
            package: parseInt(packageId),
            code: voucherCode,
            orderid: userOrderId,
            callback_url: 'https://gaule-store.onrender.com/api/webhook'
        }, {
            headers: { 'X-API-KEY': API_KEY }
        });

        console.log('UniPin API Response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('TopUp Error:', error.response?.data || error.message);
        res.status(500).json({ 
            status: 'error', 
            message: error.response?.data?.message || error.message 
        });
    }
});

// Webhook Endpoint
app.post('/api/webhook', async (req, res) => {
    console.log('Webhook Received from UniPin:', req.body);
    
    try {
        const { orderid, api_order_id, status, message } = req.body;

        if (orderid) {
            const ordersRef = db.ref('orders');
            const snapshot = await ordersRef.orderByChild('apiOrderId').equalTo(orderid).once('value');
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    childSnapshot.ref.update({
                        status: status === 'success' ? 'Success' : 'Failed',
                        webhookMessage: message || status,
                        apiOrderId: api_order_id || orderid
                    });
                });
            }
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook Error:', err.message);
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Gaule Store Server running on port ${PORT}`);
});
