const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// 1. Firebase Admin Initialize 
// (Render ma 'firebase-service-account.json' file upload garnu parne huncha)
admin.initializeApp({
  credential: admin.cert(require('./firebase-service-account.json')),
  databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
});

const db = admin.database();

const BASE_URL = 'https://tzapi.tzsmm.com';
const API_KEY = process.env.API_SECRET || process.env.API_KEY;

// Outbound IP check garne function (Server start huda IP print garnako lagi)
async function checkOutboundIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        console.log(`Server Outbound IP Address: ${response.data.ip}`);
    } catch (error) {
        console.error('Could not fetch outbound IP:', error.message);
    }
}

// 2. Database bata stock check garera voucher code lene ra remove garne function
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

    // Use bhayeko voucher lai Firebase database bata automatic remove (delete) garne
    await db.ref(`auto-top-up/${dbKey}/${firstKey}`).remove();

    return voucherCode;
}

// 3. TopUp API Endpoint (Frontend bata call hune)
app.post('/api/topup', async (req, res) => {
    const { playerId, packageId, dbKey, userOrderId } = req.body;

    try {
        if (!dbKey) {
            return res.status(400).json({ status: 'error', message: 'Package DB Key is missing!' });
        }

        // Firebase bata stock check garera voucher PIN nikalne
        const voucherCode = await getAndRemoveVoucher(dbKey);

        // UniPin API ma automated order create request pathaune
        const response = await axios.post(`${BASE_URL}/api/v1/user/order/create`, {
            playerid: playerId,
            package: parseInt(packageId),
            code: voucherCode,          // Firebase bata taneko real voucher PIN
            orderid: userOrderId,       // Website ko unique tracking/order ID
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

// 4. Webhook Endpoint (UniPin bata terminal status updates aaudha)
app.post('/api/webhook', (req, res) => {
    const webhookData = req.body;
    console.log('Webhook Received from UniPin:', webhookData);
    
    if (webhookData.status === 'success') {
        console.log(`Order ${webhookData.orderid} top-up successful!`);
    } else {
        console.log(`Order ${webhookData.orderid} failed!`);
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Gaule Store Server running on port ${PORT}`);
    await checkOutboundIP();
});
