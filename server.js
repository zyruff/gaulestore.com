const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend files serve गर्ने (public फोल्डरबाट)
app.use(express.static(path.join(__dirname, 'public')));

// 1. TopUp API Endpoint (Frontend बाट कल हुन्छ)
app.post('/api/topup', async (req, res) => {
    try {
        const { playerId, packageId, dbKey, userOrderId } = req.body;
        
        console.log(`[TopUp Request] Player ID: ${playerId}, Package: ${dbKey}, Order ID: ${userOrderId}`);

        // TODO: यहाँ UniPin API वा आफ्नो Provider को API Request राख्न सक्नुहुन्छ।
        // अहिलेको लागि टेस्ट गर्न सफल (success) भएको रेस्पोन्स पठाएको छ।
        
        return res.status(200).json({
            status: 'success',
            order_id: userOrderId || 'GAULE-' + Date.now(),
            message: 'TopUp request processed successfully.'
        });
    } catch (error) {
        console.error("TopUp Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// 2. UniPin Webhook Endpoint
app.post('/webhook/unipin', (req, res) => {
    const webhookData = req.body;
    
    console.log("Webhook Received from UniPin:", webhookData);

    /*
      प्राप्त हुने Webhook Data को उदाहरण:
      {
        orderid: 'GULE-57746743t',
        status: 'success',
        code: 'UPBD-N-S-17540558 2242-1297-1279-3463',
        package: 'Weekly Membership',
        player_id: '9383892022'
      }
    */

    // यहाँ Firebase वा Database मा अर्डरको Status Update गर्न सक्नुहुन्छ।

    return res.status(200).json({ received: true });
});

// मुख्य होमपेजको लागि index.html देखाइदिने
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Gaule Store Server running on port ${PORT}`);
});
