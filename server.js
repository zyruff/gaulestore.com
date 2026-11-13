const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// आफ्नो ALIC Store को Secret Key यहाँ राख्नुहोस्
const ALIC_SECRET_KEY = 'YOUR_API_SECRET_KEY'; 
const BASE_URL = 'https://alicstore.com/api';

// ==========================================
// १. सबै Package ID र मूल्य (Variations) हेर्ने API
// ==========================================
app.get('/api/packages', async (req, res) => {
  try {
    const response = await axios.post(`${BASE_URL}/variations`, {
      secret_key: ALIC_SECRET_KEY
    });

    // ब्राउजर वा Postman बाट सिधै Package ID, Name र Price हेर्न सकिन्छ
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Packages fetch garna samasya bhayo'
    });
  }
});

// ==========================================
// २. अर्डर पठाउने (Place Order) API
// ==========================================
app.post('/api/buy-topup', async (req, res) => {
  const { package_id, player_id, client_order_id, quantity } = req.body;

  try {
    const payload = {
      secret_key: ALIC_SECRET_KEY,
      package_id: Number(package_id),
      player_id: String(player_id),
      client_order_id: String(client_order_id), // हरेक अर्डरको लागि Unique ID हुनुपर्छ
      quantity: Number(quantity) || 1,
      webhook_url: 'https://gaule-store.onrender.com/api/webhook-receiver'
    };

    const response = await axios.post(`${BASE_URL}/place-order`, payload);
    
    // अर्डर Processing मा गयो, अब आफ्नो Database मा orderid सेभ गर्नुहोस्
    res.json(response.data);
  } catch (error) {
    // Insufficient balance वा Duplicate order को Error यहाँ आउँछ
    res.status(error.response?.status || 400).json({
      status: 'error',
      message: error.response?.data?.message || 'Order place garna samasya bhayo'
    });
  }
});

// ==========================================
// ३. Webhook Receiver (Order Complete/Fail अपडेट आउने ठाउँ)
// ==========================================
app.post('/api/webhook-receiver', (req, res) => {
  const { orderid, status, content } = req.body;

  console.log('Webhook Received:', { orderid, status, content });

  if (status === 'success') {
    // यहाँ आफ्नो Database मा 'orderid' (जुन तपाईंको client_order_id हो) लाई 'Completed' अपडेट गर्नुहोस्
    console.log(`Order ${orderid} সফল भयो!`);
  } else if (status === 'error') {
    // यहाँ आफ्नो Database मा अर्डरलाई 'Failed/Cancelled' अपडेट गर्नुहोस् र युजरको पैसा फिर्ता (Refund) दिनुहोस्
    console.log(`Order ${orderid} असफल भयो: ${content}`);
  }

  // ALIC Store लाई Webhook प्राप्त भयो भनेर 200 OK पठाउनु अनिवार्य छ
  res.status(200).json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
