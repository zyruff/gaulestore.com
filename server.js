const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

const ALICSTORE_API_BASE = 'https://alicstore.com/api';
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'YOUR_API_SECRET_KEY';

/**
 * 1. Get Variations List Endpoint
 */
app.get('/api/get-variations', async (req, res) => {
    try {
        const response = await fetch(`${ALICSTORE_API_BASE}/variations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret_key: API_SECRET_KEY })
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * 2. Place Order Endpoint
 */
app.post('/api/create-order', async (req, res) => {
    try {
        const { package_id, player_id, client_order_id, quantity } = req.body;

        const payload = {
            secret_key: API_SECRET_KEY,
            package_id: package_id,
            player_id: player_id,
            client_order_id: client_order_id,
            quantity: quantity || 1,
            webhook_url: "https://gaule-store.onrender.com/api/webhook-receiver"
        };

        const response = await fetch(`${ALICSTORE_API_BASE}/place-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * 3. Incoming Webhook Receiver Endpoint
 */
app.post('/api/webhook-receiver', (req, res) => {
    const { orderid, status, content } = req.body;

    console.log(`[Webhook Received] Order ID: ${orderid}, Status: ${status}, Content: ${content}`);

    if (status === 'success') {
        // TODO: Update your database (Mark order as success)
        console.log(`Order ${orderid} completed successfully.`);
    } else {
        // TODO: Update your database (Mark order as failed/cancelled)
        console.log(`Order ${orderid} failed or cancelled.`);
    }

    res.status(200).json({ status: 'success', message: 'Webhook received successfully' });
});

// Server Start
app.listen(PORT, () => {
    console.log(`Reseller server is running on port ${PORT}`);
});
