const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

// Firebase Admin SDK सेटअप (अपनी serviceAccountKey.json फाइल यहाँ कनेक्ट करें)
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com" // अपनी Realtime DB URL डालें
});

const db = admin.firestore();
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 1. Webhook Endpoint - जहाँ androidartist.com से स्टेटस रिस्पांस आएगा
app.post('/api/auto-topup/webhook', async (req, res) => {
    try {
        const callbackData = req.body;
        console.log("Webhook Received:", callbackData);

        const orderId = callbackData.orderid; // आर्डर आईडी जो आपने भेजा था
        const status = callbackData.status;   // 'success', 'error', 'partial' आदि
        const message = callbackData.message || callbackData.content;

        if (!orderId) {
            return res.status(400).json({ status: "error", message: "Order ID missing in webhook" });
        }

        // Firestore में ऑर्डर स्टेटस अपडेट करें
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            console.log(`Order ID ${orderId} not found in database.`);
            return res.status(404).json({ status: "error", message: "Order not found" });
        }

        // स्टेटस के आधार पर डेटाबेस अपडेट करें
        let newStatus = 'processing';
        if (status === 'success') {
            newStatus = 'success';
        } else if (status === 'error' || status === 'failed') {
            newStatus = 'rejected'; // या cancel
        } else if (status === 'partial') {
            newStatus = 'partial';
        }

        await orderRef.update({
            status: newStatus,
            webhookResponse: callbackData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Order ${orderId} status updated to: ${newStatus}`);

        // सफलता का रिस्पांस वापस भेजें
        return res.status(200).json({ status: "success", message: "Webhook processed successfully" });

    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// सर्वर स्टार्ट पोर्ट
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Auto TopUp Webhook Server running on port ${PORT}`);
});
