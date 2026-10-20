const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// TopUp API Request Endpoint
app.post('/api/process-topup', async (req, res) => {
  try {
    const apiKey = process.env.API_SECRET;

    const payload = {
      secret: apiKey,
      ...req.body
    };

    const response = await axios.post('https://androidartist.com/api/process-topup', payload);
    res.json(response.data);
  } catch (error) {
    console.error("API Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ 
      error: error.message,
      details: error.response ? error.response.data : null 
    });
  }
});

// Webhook Listener
app.post('/api/webhook', (req, res) => {
  console.log("Webhook Notification Received:", req.body);
  res.status(200).json({ status: "received" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
