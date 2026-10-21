const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');

const app = express();

app.use(express.json());
app.use(cors());

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send("Gaule Store Top-Up Backend is Running Live!");
});

// TopUp API Request Endpoint
app.post('/api/process-topup', async (req, res) => {
    try {
        const apiKey = process.env.API_SECRET;
        const { orderid, playerid, code, url } = req.body;

        const payload = {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url || "https://gaule-store.onrender.com/api/webhook"
        };

        console.log("Sending Payload to AndroidArtist:", { ...payload, api: "*****" });

        // Cloudflare Bypass headers
        const response = await axios.post('https://androidartist.com/api/process-topup', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        console.log("AndroidArtist Response:", response.data);
        res.json(response.data);

    } catch (error) {
        console.error("API Error Details:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false,
            error: error.message,
            details: error.response ? error.response.data : null 
        });
    }
});

// Webhook Listener
app.post('/api/webhook', (req, res) => {
    console.log("Webhook Notification Received:", req.body);
    res.status(200).json({ status: "received" });
});

// Render Free Tier लाई Sleep हुनबाट रोक्न Auto Ping (Keep-Alive System)
setInterval(() => {
    https.get('https://gaule-store.onrender.com', (res) => {
        console.log('Keep-alive ping sent to self.');
    }).on('error', (err) => {
        console.error('Keep-alive ping error:', err.message);
    });
}, 14 * 60 * 1000); // हरेक १४ मिनेटमा पिङ गर्ने

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
