const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON Body Middleware
app.use(express.json());

// API Configuration Constants
const API_BASE_URL = 'https://androidartist.com/api/process-topup';
const API_SECRET = 'TPBD-XXXX-XXXX'; // Tapai ko original Merchant API Secret Key yaha rakhnus

// Tapai ko Render Live Webhook URL
const YOUR_WEBHOOK_URL = 'https://gaule-store.onrender.com/api/auto-topup/webhook';

// ==========================================
// 1. WEBHOOK LISTENER ENDPOINT
// ==========================================
/**
 * Express Route for processing callbacks/webhooks sent by AndroidArtist
 */
app.post('/api/webhook', (req, res) => {
    const data = req.body;

    console.log('\n================ WEBHOOK RECEIVED ================');
    console.log('Order ID:', data.orderid);
    console.log('Status  :', data.status);

    // Multi-Voucher Callback Parsing
    if (data.total_vouchers) {
        console.log(`[MULTI-VOUCHER] Total: ${data.total_vouchers} | Success: ${data.total_success} | Failed: ${data.total_failed}`);
        
        if (data.parts && Array.isArray(data.parts)) {
            data.parts.forEach((part) => {
                console.log(`  -> Part ${part.part} (${part.orderid}): ${part.status}`);
            });
        }
    }

    // Status logic handle garna:
    switch (data.status) {
        case 'success':
            console.log(' Message :', data.message || 'Transaction successful');
            // TODO: Database ma Order Status Update (PAID / DELIVERED) garnuhos
            break;

        case 'partial':
            console.log(' Warning :', data.message);
            // TODO: Partially complete bhako order lai database ma handle garnuhos
            break;

        case 'error':
            console.error(' Error   :', data.content || 'Transaction failed');
            // TODO: Database order update (FAILED / REFUND) garnuhos
            break;

        default:
            console.log(' Details :', data);
    }
    console.log('==================================================\n');

    // AndroidArtist server lai HTTP 200 OK Response pathaune
    return res.status(200).json({ status: 'received' });
});

// ==========================================
// 2. HELPER FUNCTIONS TO PROCESS TOP-UPS
// ==========================================

/**
 * Single UniPin Voucher TopUp
 */
async function processSingleVoucher(orderId, playerId, voucherCode) {
    try {
        const payload = {
            api: API_SECRET,
            orderid: String(orderId),
            playerid: String(playerId),
            code: voucherCode,
            url: YOUR_WEBHOOK_URL
        };

        const response = await axios.post(API_BASE_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('[Single TopUp Response]:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Single TopUp Error]:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Multi-Voucher TopUp (Comma Separated Codes)
 */
async function processMultiVoucher(orderId, playerId, voucherCodesArray) {
    try {
        const payload = {
            api: API_SECRET,
            orderid: String(orderId),
            playerid: String(playerId),
            code: voucherCodesArray.join(','), // Pin code haru comma le join garinchha
            url: YOUR_WEBHOOK_URL
        };

        const response = await axios.post(API_BASE_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('[Multi-Voucher Response]:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Multi-Voucher Error]:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Garena Shell Method TopUp
 */
async function processGarenaShell(orderId, playerId, packageId, username, password, autocode) {
    try {
        const payload = {
            api: API_SECRET,
            playerid: String(playerId),
            package: String(packageId),
            code: 'shell',
            orderid: String(orderId),
            url: YOUR_WEBHOOK_URL,
            username: String(username),
            password: String(password),
            autocode: String(autocode)
        };

        const response = await axios.post(API_BASE_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('[Garena Shell Response]:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Garena Shell Error]:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// ==========================================
// 3. SAMPLE TEST ENDPOINTS (OPTIONAL)
// ==========================================

// Single Voucher Trigger Route Example: GET http://localhost:3000/test-single
app.get('/test-single', async (req, res) => {
    try {
        const result = await processSingleVoucher(
            'ORD1001',
            '5930993272',
            'UPBD-Q-S-01473051 2237-3365-5974-7596'
        );
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Multi Voucher Trigger Route Example: GET http://localhost:3000/test-multi
app.get('/test-multi', async (req, res) => {
    try {
        const pins = [
            'UPBD-Q-S-01473051 2237-3365-5974-7596',
            'UPBD-Q-S-01472883 1942-3457-3412-6272'
        ];
    const result = await processMultiVoucher('MULTI_2001', '5930993272', pins);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Garena Shell Trigger Route Example: GET http://localhost:3000/test-shell
app.get('/test-shell', async (req, res) => {
    try {
        const result = await processGarenaShell(
            'SHELL1001',
            '5930993272',
            '67383',
            '6679515',
            'mypassword',
            '3MWJXGTEC'
        );
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Server Listen
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Listening for Webhooks at: ${YOUR_WEBHOOK_URL}`);
});
