const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Root URL Check
app.get('/', (req, res) => {
    res.send("Gaule Store Top-Up Backend is Live!");
});

// Top-Up Request Handler
app.post('/api/process-topup', async (req, res) => {
    const { orderid, playerid, code, packType, url } = req.body;

    console.log("--------------------------------------------------");
    console.log(`📦 NEW TOP-UP REQUEST [${packType || 'MEMBERSHIP'}]`);
    console.log(`🆔 Order ID : ${orderid}`);
    console.log(`👤 Player ID: ${playerid}`);
    console.log(`🎟️ Voucher  : ${code}`);
    console.log("--------------------------------------------------");

    try {
        const apiKey = process.env.API_SECRET;

        // AndroidArtist API Payload Structure
        const payload = {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url || "https://gaule-store.onrender.com/api/webhook"
        };

        // Forward request to AndroidArtist API with Browser Headers
        const response = await axios.post('https://androidartist.com/api/process-topup', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://androidartist.com',
                'Referer': 'https://androidartist.com/'
            }
        });

        console.log("✅ AndroidArtist API Response:", response.data);
        res.json(response.data);

    } catch (error) {
        console.error("❌ API Request Error:", error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json({ 
            status: "error",
            message: error.message,
            content: error.response ? error.response.data : "Internal Server Error"
        });
    }
});

// AndroidArtist Webhook Receiver
app.post('/api/webhook', (req, res) => {
    console.log("--------------------------------------------------");
    console.log("🔔 WEBHOOK NOTIFICATION RECEIVED FROM ANDROIDARTIST:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("--------------------------------------------------");
    res.status(200).json({ status: "received" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
