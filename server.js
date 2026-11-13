const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // or native fetch in newer Node versions
const app = express();

app.use(express.json());
app.use(cors()); // Cross-Origin Resource Sharing enable garna ko lagi

// 1. Get Variations / Packages List from AlicStore
app.get('/api/variations', async (req, res) => {
    try {
        const alicResponse = await fetch('https://alicstore.com/api/variations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret_key: process.env.ALIC_SECRET_KEY // Render Environment Variable ma huna parxa
            })
        });

        const data = await alicResponse.json();
        res.status(alicResponse.status).json(data);
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

// 2. Create Order Endpoint (Called from your frontend)
app.post('/api/create-order', async (req, res) => {
    try {
        const { package_id, player_id, client_order_id, quantity } = req.body;

        const alicResponse = await fetch('https://alicstore.com/api/place-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret_key: process.env.ALIC_SECRET_KEY,
                package_id: package_id,
                player_id: player_id,
                client_order_id: client_order_id,
                quantity: quantity || 1,
                webhook_url: "https://gaule-store.onrender.com/api/webhook-receiver"
            })
        });

        const data = await alicResponse.json();
        res.status(alicResponse.status).json(data);
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

// 3. Webhook Receiver Endpoint (Called by AlicStore when order completes)
app.post('/api/webhook-receiver', (req, res) => {
    const { orderid, status, content } = req.body;
    
    // Yaha tapai Firebase Admin SDK use garera database update garna saknu hunxa
    console.log(`Webhook received for Order ID ${orderid}: Status -> ${status}, Content -> ${content}`);

    res.status(200).json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
