const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send("Gaule Store Backend is Live!");
});

app.post('/api/process-topup', async (req, res) => {
    const { orderid, playerid, code, url, packType } = req.body;

    // 🔥 Render Logs मा कुन प्याक (Weekly/Monthly) हो प्रस्ट देखाउने
    console.log("--------------------------------------------------");
    console.log(`📦 NEW ORDER RECEIVED [${packType || 'MEMBERSHIP'}]`);
    console.log(`🆔 Order ID : ${orderid}`);
    console.log(`👤 Player ID: ${playerid}`);
    console.log(`🎟️ Voucher  : ${code}`);
    console.log("--------------------------------------------------");

    try {
        const apiKey = process.env.API_SECRET;

        const payload = {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url || "https://gaule-store.onrender.com/api/webhook"
        };

        const response = await axios.post('https://androidartist.com/api/process-topup', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://androidartist.com',
                'Referer': 'https://androidartist.com/'
            }
        });

        console.log("✅ AndroidArtist Success Response:", response.data);
        res.json(response.data);

    } catch (error) {
        console.error("❌ API Error Details:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response ? error.response.data : null 
        });
    }
});

app.post('/api/webhook', (req, res) => {
    console.log("Webhook Received:", req.body);
    res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
