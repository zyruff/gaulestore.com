async function processAutoTopUp(playerId, membershipType) {
  // membershipType को नाम Firebase सँग मिल्नुपर्छ: 'weekly-membership' वा 'monthly-membership'
  const voucherRef = firebase.database().ref(`auto-top-up/${membershipType}`);

  voucherRef.once('value', async (snapshot) => {
    const vouchers = snapshot.val();

    if (!vouchers) {
      alert("Out of Stock! यो मेम्बरसिपको भौचर अहिले उपलब्ध छैन।");
      return;
    }

    // पहिलो उपलब्ध भौचरको Key र Code लिने (जस्तै v1)
    const voucherKeys = Object.keys(vouchers);
    const selectedKey = voucherKeys[0];
    const voucherCode = vouchers[selectedKey];

    if (!voucherCode) {
      alert("Out of Stock! भौचर कोड खाली छ।");
      return;
    }

    try {
      // १. Render ब्याकएन्डमा रिक्वेस्ट पठाउने
      const response = await fetch('https://gaule-store.onrender.com/api/process-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderid: "GAULE_" + Date.now(),
          playerid: playerId,
          code: voucherCode
        })
      });

      const result = await response.json();
      console.log("Top-up Response:", result);

      if (result.status === 'success' || result.success) {
        // २. सफल भएपछि प्रयोग भइसकेको भौचर Firebase बाट अटोमेटिक हटाउने
        await firebase.database().ref(`auto-top-up/${membershipType}/${selectedKey}`).remove();
        alert("Top-up Successful! डाइमण्ड सफलतापूर्वक अकाउन्टमा गयो।");
      } else {
        alert("Top-up Failed: " + (result.message || JSON.stringify(result)));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Server Error! कृपया पछि फेري प्रयास गर्नुहोस्।");
    }
  });
}
