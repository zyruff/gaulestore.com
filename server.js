const express = require('express');
const app = express();

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration from Environment Variables (Render Dashboard bata set garne)
const SECRET_KEY = process.env.ALICSTORE_SECRET_KEY || "YOUR_API_SECRET_KEY";
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || "https://rg-digital-store-reseller.onrender.com";

// 1. Home Route
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>RG Digital Store API</title></head>
            <body style="font-family: Arial; padding: 20px; background: #f9f9f9;">
                <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2>RG Digital Store Reseller Server is Live! 🚀</h2>
                    <p>To view available variations and package IDs, click below:</p>
                    <a href="/variations" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Package IDs & Variations</a>
                </div>
            </body>
        </html>
    `);
});

// 2. View Variations & Package IDs (Package ID herna ko lagi)
app.get('/variations', async (req, res) => {
    try {
        const response = await fetch('https://alicstore.com/api/variations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ secret_key: SECRET_KEY })
        });

        const data = await response.json();

        if (data.status === 'success') {
            let html = `
                <html>
                <head>
                    <title>Available Packages - RG Digital Store</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 30px; background: #f9f9f9; }
                        h2 { color: #333; }
                        table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden; }
                        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                        th { background-color: #007bff; color: white; }
                        tr:hover { background-color: #f1f1f1; }
                        .back-link { display: inline-block; margin-bottom: 20px; text-decoration: none; color: #007bff; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <a href="/" class="back-link">← Back to Home</a>
                    <h2>Available Packages & IDs</h2>
                    <table>
                        <tr>
                            <th>Package ID</th>
                            <th>Name</th>
                            <th>Title</th>
                            <th>Price (Tk)</th>
                        </tr>
            `;

            data.data.forEach(pkg => {
                html += `
                    <tr>
                        <td><b>${pkg.package_id}</b></td>
                        <td>${pkg.name}</td>
                        <td>${pkg.title}</td>
                        <td>${pkg.price}</td>
                    </tr>
                `;
            });

            html += `</table></body></html>`;
            res.send(html);
        } else {
            res.status(401).json({ error: "Failed to fetch variations", details: data });
        }
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// 3. Place Order API Endpoint
app.post('/api/create-order', async (req, res) => {
    try {
        const { package_id, player_id, client_order_id, quantity } = req.body;

        const payload = {
            secret_key: SECRET_KEY,
            package_id: package_id,
            player_id: player_id,
            client_order_id: client_order_id || `ORD_${Date.now()}`,
            quantity: quantity || 1,
            webhook_url: `${RENDER_EXTERNAL_URL}/api/webhook-receiver`
        };

        const response = await fetch('https://alicstore.com/api/place-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

// 4. Webhook Receiver Endpoint (AlicStore le yo endpoint ma order status pathauncha)
app.post('/api/webhook-receiver', (req, res) => {
    const webhookData = req.body;
    
    console.log("Received Webhook Notification:", webhookData);

    // Yaha order status update garne logic rakhna saknu huncha (e.g., Database update)
    // webhookData format: { "orderid": "...", "status": "success/error", "content": "..." }

    // Always respond with 200 OK so AlicStore knows webhook was received successfully
    res.status(200).json({ status: "received" });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`RG Digital Store Server is running on port ${PORT}`);
});
