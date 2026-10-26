const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin SDK सेटअप
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "gaule-top-up-center",
            clientEmail: "firebase-adminsdk-xxx@gaule-top-up-center.iam.gserviceaccount.com", // आफ्नो Firebase email राख्नुहोला
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
        }),
        databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
    });
}

const db = admin.database();
const app = express();
app.use(express.json());
app.use(cors());

// Render को रुट चेक गर्न
app.get('/', (req, res) => {
    res.send('Gaule Store Backend is running successfully!');
});

// फ्रन्टएन्डबाट अर्डर रिसिभ गरेर AndroidArtist मा पठाउने API Route
app.post('/api/process-topup', async (req, res) => {
    console.log("--> INCOMING REQUEST RECEIVED FROM FRONTEND:", req.body);
    
    const { orderid, playerid, code, url } = req.body;
    const apiKey = process.env.API_SECRET; 

    if (!apiKey) {
        console.error("API Error: API_SECRET is missing in Render Environment variables!");
        return res.status(500).json({ status: "error", message: "Server API Secret missing" });
    }

    try {
        const apiResponse = await axios.post('https://androidartist.com/api/process-topup', {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/json',
                'Referer': 'https://androidartist.com/'
            }
        });

        console.log("AndroidArtist API Response:", apiResponse.data);
        return res.status(200).json(apiResponse.data);

    } catch (error) {
        console.error("API Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            status: "error", 
            message: error.response ? error.response.data : error.message 
        });
    }
});

// EXTERNAL API बाट आउने Webhook रिसिभ गर्ने Route (Firebase-admin मार्फत Status अपडेट हुने)
app.post('/api/webhook', async (req, res) => {
    console.log("--> INCOMING WEBHOOK RECEIVED FROM API:", req.body);
    
    const { orderid, status, message, processing_time, content } = req.body;

    try {
        const ordersRef = db.ref('orders');
        const snapshot = await ordersRef.orderByChild('orderid').equalTo(orderid).once('value');

        let targetOrderKey = null;
        snapshot.forEach((childSnapshot) => {
            targetOrderKey = childSnapshot.key;
        });

        if (status === "error" || status === "failed") {
            console.error(`❌ Order Failed [${orderid}]:`, content || message);
            
            if (targetOrderKey) {
                await db.ref(`orders/${targetOrderKey}`).update({
                    status: "Failed",
                    errorReason: content || message || "Top-up failed"
                });
                console.log(`⚠️ Order ${orderid} status updated to Failed in Firebase.`);
            }
        } else if (status === "success" || status === 200) {
            console.log(`✅ Order Successfully Completed [${orderid}]:`, content);

            if (targetOrderKey) {
                await db.ref(`orders/${targetOrderKey}`).update({
                    status: "Completed"
                });
                console.log(`🎉 Order ${orderid} status updated to Completed in Firebase.`);
            }
        } else {
            console.log(`ℹ️ Order Status Update [${orderid}]:`, status, message);
        }
    } catch (err) {
        console.error("Webhook Database Error:", err);
    }

    return res.status(200).json({ status: "success", message: "Webhook processed successfully" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    axios.get('https://api.ipify.org?format=json')
        .then(response => {
            console.log("🔥 MY RENDER OUTBOUND IP IS:", response.data.ip);
        })
        .catch(error => {
            console.log("IP Fetch Error:", error.message);
        });
});
