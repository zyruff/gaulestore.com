// ==========================================
// 1. Process Top-Up Endpoint
// ==========================================
app.post('/api/topup', async (req, res) => {
  try {
    const { 
      api, 
      orderid, 
      playerid, 
      code, 
      url, 
      package: pkg, 
      username, 
      password, 
      autocode 
    } = req.body;

    // Basic Validation
    if (!api || !orderid || !playerid || !code || !url) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: api, orderid, playerid, code, and url are required.'
      });
    }

    // Payload construction
    const payload = {
      api,
      orderid,
      playerid,
      code,
      url // 👈 सुनिश्चित गर्नुहोस् कि यो https://gaule-store.onrender.com/api/auto-topup/webhook हो
    };

    if (code === 'shell') {
      if (!pkg || !username || !password || !autocode) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters for Garena Shell topup.'
        });
      }
      payload.package = pkg;
      payload.username = username;
      payload.password = password;
      payload.autocode = autocode;
    }

    // 🔍 1. AndroidArtist मा के डेटा जाँदैछ Log गर्ने
    console.log('--- Sending Top-Up Request to AndroidArtist ---');
    console.log(JSON.stringify(payload, null, 2));

    // Sending request to androidartist API
    const response = await axios.post(API_BASE_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 🔍 2. AndroidArtist ले के रिप्लाई दियो Log गर्ने
    console.log('--- AndroidArtist Immediate Response ---');
    console.log(JSON.stringify(response.data, null, 2));

    return res.status(200).json(response.data);

  } catch (error) {
    console.error('TopUp API Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process topup request',
      details: error.response ? error.response.data : error.message
    });
  }
});
