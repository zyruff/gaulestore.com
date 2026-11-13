require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Render को Environment Variable बाट Key तान्छ, नभए यहाँ लेखेको Key प्रयोग गर्छ
const ALIC_SECRET_KEY = process.env.ALIC_SECRET_KEY || 'YOUR_API_SECRET_KEY';
const BASE_URL = 'https://alicstore.com/api';

// Cloudflare र Server Block बाट बच्नको लागि साझा Headers
const apiHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

// ==========================================
// ०. होम पेज (Server चलेको छ कि छैन चेक गर्न)
// ==========================================
app.get('/', (req, res) => {
  res.send('Gaule Store ALIC API Server is Running!');
});

// ==========================================
// १. सबै Package ID र मूल्य (Variations) हेर्ने API
// ==========================================
app.get('/api/packages', async (req, res) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/variations`,
      { secret_key: ALIC_SECRET_KEY },
      { headers: apiHeaders }
    );

    // यदि ALIC Store ले डेटा पठायो भने सिधै देखाउने
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Variations Error:', error.response?.data || error.message);
    
    // Error आएमा पूरा विवरण ब्राउजरमै देखाउने ताकि समस्या थाहा होस्
    res.status(error.response?.status || 500).json({
      status: 'error',
      alic_status_code: error.response?.status || 'NO_RESPONSE',
      alic_response: error.response?.data || error.message
    });
  }
});

// ==========================================
// २. अर्डर पठाउने (Place Order) API
// ==========================================
app.post('/api/buy-topup', async (req, res) => {
  const { package_id, player_id, client_order_id, quantity } = req.body;

  // आवश्यक डेटा पठाइएको छ कि छैन चेक गर्ने
  if (!package_id || !player_id) {
    return res.status(400).json({
      status: 'error',
      message: 'package_id ra player_id aniwarya chha!'
    });
  }

  // यदि client_order_id पठाइएको छैन भने अटोमेटिक Unique ID बनाउने
  const orderIdToSend = client_order_id || `ORD_${Date.now()}`;

  try {
    const payload = {
      secret_key: ALIC_SECRET_KEY,
      package_id: Number(package_id),
      player_id: String(player_id),
      client_order_id: String(orderIdToSend),
      quantity: Number(quantity) || 1,
      webhook_url: 'https://gaule-store.onrender.com/api/webhook-receiver'
    };

    const response = await axios.post(
      `${BASE_URL}/place-order`,
      payload,
      { headers: apiHeaders }
    );

    // अर्डर सफल भयो भने Response पठाउने
    res.status(200).json({
      sent_client_order_id: orderIdToSend,
      alic_response: response.data
    });
  } catch (error) {
    console.error('Place Order Error:', error.response?.data || error.message);

    res.status(error.response?.status || 400).json({
      status: 'error',
      alic_status_code: error.response?.status || 'NO_RESPONSE',
      alic_response: error.response?.data || error.message
    });
  }
});

// ==========================================
// ३. Webhook Receiver (Order Complete/Fail अपडेट आउने ठाउँ)
// ==========================================
app.post('/api/webhook-receiver', (req, res) => {
  const { orderid, status, content } = req.body;

  console.log('--- Webhook Received ---');
  console.log('Order ID:', orderid);
  console.log('Status:', status);
  console.log('Message:', content);

  if (status === 'success') {
    // TODO: आफ्नो Database मा orderid लाई 'Completed' अपडेट गर्नुहोस्
    console.log(`✅ Order ${orderid} Completed!`);
  } else if (status === 'error') {
    // TODO: आफ्नो Database मा orderid लाई 'Failed' अपडेट गरी युजरलाई Refund दिनुहोस्
    console.log(`❌ Order ${orderid} Failed: ${content}`);
  }

  // ALIC Store लाई 200 OK पठाउनै पर्छ
  res.status(200).json({ received: true });
});

// ==========================================
// Server Start
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
