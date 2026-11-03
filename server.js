const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

// Firebase Admin Initialization (metadata एरर नआउने गरी databaseURL मात्र राखेर मिलाइएको)
admin.initializeApp({
    databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();
const PORT = process.env.PORT || 10000;

// TZ API Configuration
const TZ_API_BASE = "https://tzapi.tzsmm.com";
const TZ_API_KEY = process.env.TZ_API_KEY || "YOUR_TZ_API_KEY_HERE"; // Render Environment Variable मा आफ्नो API Key राख्नुहोला

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (index.html, free_fire.png आदि) मुख्य (Root) फोल्डरबाटै serve गर्ने
app.use(express.static(path.join(__dirname)));

// 1. TopUp API Endpoint (Frontend बाट कल हुन्छ)
app.post('/api/topup', async (req, res) => {
    try {
        const { playerId, packageId, dbKey, userOrderId } = req.body;
        
        if (!playerId || !packageId || !dbKey) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields (playerId, packageId, dbKey)' });
        }

        console.log(`[TopUp Request] Player ID: ${playerId}, Package: ${dbKey} (ID: ${packageId}), Order ID: ${userOrderId}`);

        // Step A: Firebase stock (`auto-top-up/{dbKey}`) बाट available voucher code फेला पार्ने
        const stockRef = db.ref(`auto-top-up/${dbKey}`);
        const snapshot = await stockRef.once('value');
        const stockData = snapshot.val();

        if (!stockData || Object.keys(stockData).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Selected package is currently Out of Stock!' });
        }

        // स्टकबाट पहिलो उपलब्ध भौचरको Key र Code लिने
        const voucherEntries = Object.entries(stockData);
        const [voucherKey, voucherObj] = voucherEntries[0];
        
        const voucherCode = typeof voucherObj === 'string' ? voucherObj : (voucherObj.code || voucherObj.pin);

        if (!voucherCode) {
            return res.status(400).json({ status: 'error', message: 'Invalid voucher format in stock.' });
        }

        // Step B: TZ API मा Order Create गर्न Request पठाउने
        const callbackUrl = `https://${req.get('host')}/webhook/tzapi`;

        const tzResponse = await fetch(`${TZ_API_BASE}/api/v1/user/order/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': TZ_API_KEY
            },
            body: JSON.stringify({
                playerid: playerId,
                package: parseInt(packageId),
                code: voucherCode,
                orderid: userOrderId,
                callback_url: callbackUrl
            })
        });

        const tzResult = await tzResponse.json();

        if (tzResponse.ok && tzResult.status === 'success') {
            // Step C: अर्डर सफल भएपछि प्रयोग भइसकेको भौचरलाई Firebase स्टकबाट हटाउने (Delete)
            await db.ref(`auto-top-up/${dbKey}/${voucherKey}`).remove();

            return res.status(200).json({
                status: 'success',
                order_id: tzResult.order_id || userOrderId,
                message: tzResult.message || 'TopUp order created successfully.'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: tzResult.message || 'TZ API rejected the topup request.'
            });
        }

    } catch (error) {
        console.error("TopUp Server Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. TZ API Webhook (Callback) Endpoint
app.post('/webhook/tzapi', (req, res) => {
    const webhookData = req.body;
    
    console.log("Webhook Received from TZ API:", webhookData);

    // Firebase Database मा अर्डरको Status Update गर्ने
    if (webhookData && webhookData.api_order_id) {
        db.ref('orders').orderByChild('apiOrderId').equalTo(webhookData.api_order_id).once('value', (snapshot) => {
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    childSnapshot.ref.update({
                        status: webhookData.status === 'success' ? 'Completed' : 'Failed',
                        webhookMessage: webhookData.message || ''
                    });
                });
            }
        });
    }

    return res.status(200).json({ received: true });
});

// मुख्य होमपेजको लागि index.html देखाइदिने
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Gaule Store Server running on port ${PORT}`);
});
