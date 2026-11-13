const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com"
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: "https://rg-digital-store-default-rtdb.firebaseio.com"
    });
  }
  console.log("Firebase Admin & Realtime DB Initialized Successfully!");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

const rtdb = admin.database();
const PORT = process.env.PORT || 10000;
const MASTER_API_SECRET = process.env.MASTER_API_SECRET;
const MASTER_API_BASE = 'https://alicstore.com/api';

async function fetchMasterPackages() {
  try {
    if (!MASTER_API_SECRET) return;
    const response = await fetch(`${MASTER_API_BASE}/variations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_key: MASTER_API_SECRET })
    });
    const data = await response.json();
    if (data.status === 'success') {
      console.log("=== MASTER PANEL PACKAGES LOADED ===");
    }
  } catch (err) {
    console.error("Error fetching packages:", err.message);
  }
}

app.get('/api/packages', async (req, res) => {
  try {
    const response = await fetch(`${MASTER_API_BASE}/variations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_key: MASTER_API_SECRET })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Place Order API
app.post('/api/place-order', async (req, res) => {
  try {
    const { package_id, player_id, client_order_id, quantity } = req.body;

    if (!package_id || !player_id || !client_order_id) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const webhook_url = `${protocol}://${host}/api/webhook-receiver`;

    const masterResponse = await fetch(`${MASTER_API_BASE}/place-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_key: MASTER_API_SECRET,
        package_id: Number(package_id),
        player_id: String(player_id),
        client_order_id: String(client_order_id),
        quantity: Number(quantity || 1),
        webhook_url: webhook_url
      })
    });

    const masterData = await masterResponse.json();
    console.log("Master Panel Response:", masterData);

    res.status(masterResponse.status).json(masterData);
  } catch (error) {
    console.error("Place order error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Webhook Receiver API
app.post('/api/webhook-receiver', async (req, res) => {
  try {
    const { orderid, status, content } = req.body;
    console.log("Received Webhook Data from Alic:", req.body);

    if (!orderid) {
      return res.status(400).json({ status: 'error', message: 'Missing orderid in webhook' });
    }

    let updatedStatus = 'pending';
    if (status === 'success' || status === 'completed') {
      updatedStatus = 'complete';
    } else if (status === 'error' || status === 'failed' || status === 'cancelled') {
      updatedStatus = 'cancelled';
    } else {
      updatedStatus = status;
    }

    const targetOrderId = String(orderid);
    let orderUpdated = false;

    const ordersRef = rtdb.ref('orders');
    const snapshot = await ordersRef.once('value');

    if (snapshot.exists()) {
      const updates = {};
      snapshot.forEach((childSnapshot) => {
        const orderData = childSnapshot.val();
        
        // चाहे AlicStore ले नम्बर पठाओस् वा कस्टम आईडी, दुवैलाई म्याच गराउने
        if (
          String(orderData.clientOrderId) === targetOrderId || 
          String(orderData.apiOrderId) === targetOrderId ||
          childSnapshot.key === targetOrderId
        ) {
          updates[`${childSnapshot.key}/status`] = updatedStatus;
          updates[`${childSnapshot.key}/webhookMessage`] = content || '';
          orderUpdated = true;
        }
      });

      if (orderUpdated) {
        await ordersRef.update(updates);
        console.log(`Realtime DB Order (${targetOrderId}) successfully updated to: ${updatedStatus}`);
        return res.status(200).json({ status: 'success', message: 'Order status updated successfully' });
      }
    }

    console.warn(`Webhook order not found in Realtime DB: ${targetOrderId}`);
    return res.status(404).json({ status: 'error', message: 'Order not found' });

  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('GAULE STORE Server is Running Successfully! 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  fetchMasterPackages();
});
