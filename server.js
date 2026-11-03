const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// Firebase Admin Initialize (Render ma firebase-service-account.json upload garnuhos)
admin.initializeApp({
  credential: admin.cert(require('./firebase-service-account.json')),
  databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
});

const db = admin.database();

const BASE_URL = 'https://tzapi.tzsmm.com';
const API_KEY = process.env.API_SECRET || process.env.API_KEY;

// Firebase Realtime DB bata voucher fetch garera delete garne function
async function getAndRemoveVoucher(dbKey) {
    const voucherRef = db.ref(`auto-top-up/${dbKey}`);
    const snapshot = await voucherRef.once('value');
    
    if (!snapshot.exists()) {
        throw new Error(`No vouchers available for ${dbKey}! Stock empty.`);
    }

    const vouchers = snapshot.val();
    const voucherKeys = Object.keys(vouchers);
    
    if (voucherKeys.length === 0) {
        throw new Error(`Voucher stock is empty for ${dbKey}!`);
    }

    const firstKey = voucherKeys[0];
    const voucherCode = vouchers[firstKey];

    // Use bhayeko voucher lai Firebase database bata remove garne
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

        // 1. Firebase Realtime Database bata stock ko voucher code nikalne
        const voucherCode = await getAndRemoveVoucher(dbKey);

        // 2. UniPin API ma Order Create request pathaune (userOrderId lai orderid ma pass gareko)
        const response = await axios.post(`${BASE_URL}/api/v1/user/order/create`, {
            playerid: playerId,
            package: parseInt(packageId),
            code: voucherCode,          // Firebase bata taneko real voucher PIN
            orderid: userOrderId,       // Tapai ko website ko tracking/order id
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

// Webhook endpoint (UniPin le order status update pathauda)
app.post('/api/webhook', (req, res) => {
    const webhookData = req.body;
    console.log('Webhook Received from UniPin:', webhookData);
    
    // Yaha webhookData ma orderid ra api_order_id aauxa, 
    // tesaiko adhar ma database ko order status update garna saknuhuncha.

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gaule Store Server running on port ${PORT}`));
