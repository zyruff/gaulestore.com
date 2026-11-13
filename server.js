const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors'); // <--- 1. CORS प्याकेज इम्पोर्ट गरिएको

const app = express();

// Render वा प्रोक्सी सर्भरको लागि अति आवश्यक सेटिङहरू
app.set('trust proxy', 1);
app.use(cors()); // <--- 2. सबै डोमेनबाट आउने रिक्वेस्ट (CORS) अनुमति दिइएको
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin using Service Account JSON Environment Variable
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  console.log("Firebase Initialized Successfully using SERVICE_ACCOUNT JSON!");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

const db = admin.firestore();

const PORT = process.env.PORT || 10000;
const MASTER_API_SECRET = process.env.MASTER_API_SECRET;
const MASTER_API_BASE = 'https://alicstore.com/api';

// Function to fetch packages on startup & show in console table
async function fetchMasterPackages() {
  try {
    if (!MASTER_API_SECRET) {
      console.log("Could not fetch packages on startup (Check your MASTER_API_SECRET): Request failed with status code 401");
      return;
    }
    const response = await fetch(`${MASTER_API_BASE}/variations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_key: MASTER_API_SECRET })
    });
    const data = await response.json();
    if (data.status === 'success') {
      console.log("=== MASTER PANEL AVAILABLE PACKAGES ===");
      console.table(data.data.map((pkg, index) => ({
        index,
        package_id: pkg.package_id,
        name: pkg.name,
        title: pkg.title,
        price: pkg.price
      })));
    } else {
      console.error("Failed to fetch packages:", data);
    }
  } catch (err) {
    console.error("Error fetching packages on startup:", err.message);
  }
}

// 1. Get Packages API (for your frontend website)
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

// 2. Place Order API (Forwards order from your store to Alicstore Master Panel)
app.post('/api/place-order', async (req, res) => {
  try {
    const { package_id, player_id, client_order_id, quantity } = req.body;

    if (!package_id || !player_id || !client_order_id) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields (package_id, player_id, client_order_id)' });
    }

    // Render को लागि सुरक्षित तरिकाले https र host समात्ने
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

    await db.collection('orders').doc(String(client_order_id)).set({
      client_order_id: String(client_order_id),
      package_id: Number(package_id),
      player_id: String(player_id),
      quantity: Number(quantity || 1),
      master_order_id: masterData.orderid ? String(masterData.orderid) : null,
      status: 'pending', // सुरुमा database मा pending बस्छ
      response_content: masterData.content || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(masterResponse.status).json(masterData);
  } catch (error) {
    console.error("Place order error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. Webhook Receiver API (Receives order updates from Master Panel)
app.post('/api/webhook-receiver', async (req, res) => {
  try {
    const { orderid, status, content } = req.body;
    console.log("Received Webhook Data:", req.body);

    if (!orderid) {
      return res.status(400).json({ status: 'error', message: 'Missing orderid in webhook' });
    }

    // AlicStore बाट आएको status अनुसार database को status तय गर्ने
    let updatedStatus = 'pending';
    if (status === 'success') {
      updatedStatus = 'complete';
    } else if (status === 'error') {
      updatedStatus = 'cancelled';
    } else {
      updatedStatus = status; // यदि अर्को कुनै status आएमा जस्ताको तस्तै राख्ने
    }

    let orderRef = db.collection('orders').doc(String(orderid));
    let doc = await orderRef.get();

    if (!doc.exists) {
      const querySnapshot = await db.collection('orders').where('master_order_id', '==', String(orderid)).get();
      if (!querySnapshot.empty) {
        orderRef = querySnapshot.docs[0].ref;
        doc = querySnapshot.docs[0];
      }
    }

    if (doc.exists) {
      await orderRef.update({
        status: updatedStatus, // यहाँ 'complete' वा 'cancelled' सेभ हुन्छ
        webhook_content: content,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({ status: 'success', message: 'Order status updated successfully' });
    } else {
      console.warn(`Webhook order not found in database: ${orderid}`);
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

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
