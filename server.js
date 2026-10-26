const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');

// पहिले app डिफाइन गर्नुपर्छ
const app = express();
app.use(express.json());
app.use(cors());

// Firebase Admin SDK सेटअप
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "gaule-top-up-center",
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "gaule-top-up-center@appspot.gserviceaccount.com",
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
            }),
            databaseURL: "https://gaule-top-up-center-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Admin Initialized Successfully!");
    } catch (err) {
        console.error("Firebase Admin Initialization Error:", err.message);
    }
}

const db = admin.apps.length ? admin.database() : null;

// अब यहाँ तल app.get वा app.post हरू लेख्नुहोस्:
app.get('/', (req, res) => {
    res.send('Gaule Store Backend is running successfully!');
});

app.post('/api/process-topup', async (req, res) => {
    // ... तपाईंको कोड यहाँ राख्नुहोस् ...
});
