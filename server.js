const express = require('express');
const axios = require('axios');
const cors = require('cors');

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

        // AndroidArtist Documentation अनुसार सही Payload[span_4](start_span)[span_4](end_span)
        const payload = {
            api: apiKey, // Docs अनुसार 'api' नाम हुनुपर्छ[span_5](start_span)[span_5](end_span)
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url || "https://gaule-store.onrender.com/api/webhook"
        };

        console.log("Sending Payload to AndroidArtist:", { ...payload, api: "*****" });

        const response = await axios.post('https://androidartist.com/api/process-topup', payload, {
            headers: {
                'Content-Type': 'application/json' // Docs अनुसार Content-Type[span_6](start_span)[span_6](end_span)
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

// Webhook Listener[span_7](start_span)[span_7](end_span)
app.post('/api/webhook', (req, res) => {
    console.log("Webhook Notification Received:", req.body);
    res.status(200).json({ status: "received" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
