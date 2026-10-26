const apiResponse = await axios.post('https://androidartist.com/api/process-topup', {
    api: apiKey,
    orderid: orderid,
    playerid: playerid,
    code: code,
    url: url
}, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Origin': 'https://androidartist.com',
        'Referer': 'https://androidartist.com/'
    },
    validateStatus: function (status) {
        return status < 500; // 500 भन्दा कमको status हरूलाई मात्र error नमानोस्
    }
});

// यदि HTML आयो भने रोक्नको लागि चेक राख्ने
if (typeof apiResponse.data === 'string' && apiResponse.data.includes('Just a moment')) {
    console.error("Cloudflare challenge intercepted the request!");
    return res.status(403).json({ 
        status: "error", 
        message: "Target server security (Cloudflare) blocked the automated request." 
    });
}
