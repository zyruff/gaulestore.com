const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// आफ्नो Alic Store को Secret Key यहाँ राख्नुहोला (वा Environment Variable प्रयोग गर्न सक्नुहुन्छ)
const ALIC_SECRET_KEY = process.env.ALIC_SECRET_KEY || "YOUR_API_SECRET_KEY";

// १. सप्लायरबाट सबै Variations (List) तान्ने API Endpoint
app.get('/api/variations', async (req, res) => {
    try {
        const response = await fetch('https://alicstore.com/api/variations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret_key: ALIC_SECRET_KEY
            })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch variations from supplier: ' + error.message 
        });
    }
});

// २. अर्डर प्लेस गर्ने API Endpoint (तपाईंको Frontend ले यसलाई कल गर्छ)
app.post('/api/create-order', async (req, res) => {
    try {
        const { package_id, player_id, client_order_id, quantity } = req.body;

        const response = await fetch('https://alicstore.com/api/place-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret_key: ALIC_SECRET_KEY,
                package_id: package_id,
                player_id: player_id,
                client_order_id: client_order_id,
                quantity: quantity || 1,
                webhook_url: "https://gaule-store.onrender.com/api/webhook-receiver"
            })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to place order: ' + error.message 
        });
    }
});

// ३. Webhook Receiver (अर्डर पूरा वा फेल हुँदा सप्लायरले यो URL मा डेटा पठाउँछ)
app.post('/api/webhook-receiver', (req, res) => {
    const webhookData = req.body;
    console.log("Webhook Received from Supplier:", webhookData);
    
    // यहाँ तपाईंले प्राप्त भएको orderid र status अनुसार Firebase वा Database अपडेट गर्न सक्नुहुन्छ।

    res.status(200).json({ 
        status: 'success', 
        message: 'Webhook received successfully' 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gaule Store Server is running on port ${PORT}`);
});
