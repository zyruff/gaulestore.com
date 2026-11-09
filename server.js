const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. Firebase Admin Initialization
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        // Private key भित्रको newline (\n) मिलाउने
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
    } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
    }
} else {
    serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com" // Realtime Database URL
});

const db = admin.database();
const firestore = admin.firestore(); // Firestore
const app = express();

// Render proxy को लागि
app.set('trust proxy', 1);

const PORT = process.env.PORT || 10000;

// AndroidArtist API Configuration
const AA_API_BASE = "https://androidartist.com";
const AA_API_KEY = process.env.AA_API_KEY || "YOUR_ANDROID_ARTIST_API_KEY";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files serve गर्ने
app.use(express.static(path.join(__dirname)));

// 1. TopUp Endpoint (Frontend बाट कल हुन्छ)
app.post('/api/topup', async (req, res) => {
    try {
        const { playerId, dbKey, userOrderId } = req.body;
        
        if (!playerId || !dbKey || !userOrderId) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields (playerId, dbKey, userOrderId)' });
        }

        console.log(`[AA TopUp Request] Player ID: ${playerId}, Package Key: ${dbKey}, Order ID: ${userOrderId}`);

        // Step A: Firebase stock बाट available voucher code झिक्ने
        const stockRef = db.ref(`auto-top-up/${dbKey}`);
        const snapshot = await stockRef.once('value');
        const stockData = snapshot.val();

        if (!stockData || Object.keys(stockData).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Selected package is currently Out of Stock!' });
        }

        const voucherEntries = Object.entries(stockData);
        const [voucherKey, voucherObj] = voucherEntries[0];
        const voucherCode = typeof voucherObj === 'string' ? voucherObj : (voucherObj.code || voucherObj.pin);

        if (!voucherCode) {
            return res.status(400).json({ status: 'error', message: 'Invalid voucher format in stock.' });
        }

        // Webhook URL जहाँ AndroidArtist ले रिजल्ट पठाउँछ
        const callbackUrl = `https://${req.get('host')}/webhook/androidartist`;

        console.log(`[Sending to AA API] Player ID: ${playerId}, Code: ${voucherCode}, Callback: ${callbackUrl}`);

        // Step B: AndroidArtist API मा Request पठाउने
        const aaResponse = await fetch(`${AA_API_BASE}/api/process-topup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api: AA_API_KEY,
                orderid: userOrderId,
                playerid: playerId,
                code: voucherCode,
                url: callbackUrl
            })
        });

        const aaResult = await aaResponse.json();
        console.log("AndroidArtist API Response:", aaResult);

        // API को रेस्पोन्स चेक गर्ने
        if (aaResponse.ok && (aaResult.status === 'success' || aaResult.main_order_id)) {
            // Step C: भौचर प्रयोग भइसकेपछि Firebase stock बाट हटाउने
            await db.ref(`auto-top-up/${dbKey}/${voucherKey}`).remove();

            return res.status(200).json({
                status: 'success',
                order_id: userOrderId,
                message: aaResult.message || 'TopUp order processed successfully.'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: aaResult.content || aaResult.message || 'AndroidArtist API rejected the topup request.'
            });
        }

    } catch (error) {
        console.error("TopUp Server Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. AndroidArtist Webhook / Callback Endpoint
app.post('/webhook/androidartist', async (req, res) => {
    const webhookData = req.body;
    console.log("Webhook Received from AndroidArtist:", webhookData);

    const orderId = webhookData.orderid;
    const orderStatus = webhookData.status; // success, error, partial आदि

    if (orderId) {
        try {
            // Firestore मा अर्डरको Status Update गर्ने
            const orderRef = firestore.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (orderDoc.exists) {
                let mappedStatus = 'processing';
                if (orderStatus === 'success') {
                    mappedStatus = 'success';
                } else if (orderStatus === 'error' || orderStatus === 'failed') {
                    mappedStatus = 'rejected';
                } else if (orderStatus === 'partial') {
                    mappedStatus = 'partial';
                }

                await orderRef.update({
                    status: mappedStatus,
                    webhookMessage: webhookData.message || webhookData.content || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Order ${orderId} successfully updated to status: ${mappedStatus}`);
            }
        } catch (err) {
            console.error("Webhook DB Update Error:", err);
        }
    }

    return res.status(200).json({ received: true });
});

// सबै Routes को लागि index.html serve गर्ने
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`AndroidArtist AutoTopUp Server running on port ${PORT}`);
});
