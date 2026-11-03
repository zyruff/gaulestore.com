const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const BASE_URL = 'https://tzapi.tzsmm.com';
const API_KEY = process.env.API_SECRET || process.env.API_KEY; // Render ko environment variable anusar

// Outbound IP check garne function
async function checkOutboundIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        console.log(`Server Outbound IP Address: ${response.data.ip}`);
    } catch (error) {
        console.error('Could not fetch outbound IP:', error.message);
    }
}

// 1. Package List Endpoint
app.get('/api/packages', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/v1/user/packages`, {
            headers: { 'X-API-KEY': API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. Order Create Endpoint
app.post('/api/topup', async (req, res) => {
    const { playerId, packageId, voucherCode, userOrderId } = req.body;

    try {
        const response = await axios.post(`${BASE_URL}/api/v1/user/order/create`, {
            playerid: playerId,
            package: packageId,
            code: voucherCode,
            orderid: userOrderId,
            callback_url: 'https://gaule-store.onrender.com/api/webhook'
        }, {
            headers: { 'X-API-KEY': API_KEY }
        });

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Server Error' });
    }
});

// 3. Webhook Listener
app.post('/api/webhook', (req, res) => {
    const webhookData = req.body;
    console.log('Webhook Received:', webhookData);

    if (webhookData.status === 'success') {
        // Database ma order status "SUCCESS" update garnuhos
    } else {
        // Database ma order status "FAILED" update garnuhos
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await checkOutboundIP(); // Server start hune bittikai outbound IP print hunxa
});
