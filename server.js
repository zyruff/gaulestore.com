const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

// Render को रुट चेक गर्न
app.get('/', (req, res) => {
    res.send('Gaule Store Backend is running successfully!');
});

// फ्रन्टएन्डबाट अर्डर रिसिभ गर्ने API Route
app.post('/api/process-topup', async (req, res) => {
    console.log("--> INCOMING REQUEST RECEIVED FROM FRONTEND:", req.body);
    
    const { orderid, playerid, code, url } = req.body;
    const apiKey = process.env.API_SECRET; // Render को Environment Variable बाट तान्छ

    if (!apiKey) {
        console.error("API Error: API_SECRET is missing in Render Environment variables!");
        return res.status(500).json({ status: "error", message: "Server API Secret missing" });
    }

    try {
        // AndroidArtist API मा पठाउने
        const apiResponse = await axios.post('https://androidartist.com/api/process-topup', {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json'
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

// EXTERNAL API बाट आउने Webhook रिसिभ गर्ने Route (यहाँ थपिएको छ)
app.post('/api/webhook', (req, res) => {
    console.log("--> INCOMING WEBHOOK RECEIVED FROM API:", req.body);
    
    const { orderid, status, content } = req.body;

    if (status === "error") {
        console.error(`❌ Order Failed [${orderid}]:`, content);
    } else {
        console.log(`✅ Order Status Update [${orderid}]:`, status);
    }

    // सर्भरले वेबहुक सक्सेसफुली पायो भनेर 200 OK फर्काउने
    return res.status(200).json({ status: "success", message: "Webhook received successfully" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
