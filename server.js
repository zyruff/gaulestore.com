// फ्रन्टएन्डबाट अर्डर रिसिभ गरेर AndroidArtist मा पठाउने API Route
app.post('/api/process-topup', async (req, res) => {
    console.log("--> INCOMING REQUEST RECEIVED FROM FRONTEND:", req.body);
    
    const { orderid, playerid, code, url } = req.body;
    const apiKey = process.env.API_SECRET; 

    if (!apiKey) {
        console.error("API Error: API_SECRET is missing in Render Environment variables!");
        return res.status(500).json({ status: "error", message: "Server API Secret missing" });
    }

    try {
        // await यहाँ async function भित्र राखिएको छ, त्यसैले अब Error आउँदैन
        const apiResponse = await axios.post('https://androidartist.com/api/process-topup', {
            api: apiKey,
            orderid: orderid,
            playerid: playerid,
            code: code,
            url: url
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/json',
                'Referer': 'https://androidartist.com/'
            }
        });

        console.log("AndroidArtist API Response:", apiResponse.data);
        return res.status(200).json(apiResponse.data);

    } catch (error) {
        console.error("API Error:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            status: "error", 
            message: error.response ? error.response.data : error.message 
        });
    }
});
