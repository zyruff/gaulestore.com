const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = 'QFKNFM1A62GQAB';

app.post('/get-variations', async (req, res) => {
    try {
        const response = await axios.post('https://alicstore.com/api/variations', {
            secret_key: SECRET_KEY
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/place-order', async (req, res) => {
    try {
        const { package_id, player_id, client_order_id, quantity, webhook_url } = req.body;
        const response = await axios.post('https://alicstore.com/api/place-order', {
            secret_key: SECRET_KEY,
            package_id,
            player_id,
            client_order_id,
            quantity,
            webhook_url
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
