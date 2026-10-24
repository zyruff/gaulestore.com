const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Render live check
app.get('/', (req, res) => {
    res.send("Backend is Running Live!");
});

// Top-up API Endpoint
app.post('/api/process-topup', async (req, res) => {
    console.log("--> INCOMING REQUEST RECEIVED FROM FRONTEND:", req.body);
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

        const response = await axios.post('https://androidartist.com/api/process-topup', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("AndroidArtist Response:", response.data);
        res.json(response.data);

    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
