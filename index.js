const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");

const app = express();
app.use(helmet());
app.use(bodyParser.json());

// التهيئة من المتغيرات البيئية
// يدعم SA_JSON (نص JSON كامل) أو SA_B64 (Base64 لملف JSON)
let saJson = process.env.SA_JSON || "";
if (!saJson && process.env.SA_B64) {
  try {
    saJson = Buffer.from(process.env.SA_B64, "base64").toString();
  } catch (e) {
    console.error("Invalid SA_B64"); process.exit(1);
  }
}
if (!saJson) {
  console.error("Missing SA_JSON or SA_B64 env"); process.exit(1);
}
const sa = JSON.parse(saJson);

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const FUNCTION_SECRET = process.env.ADMIN_SECRET || "dev_secret";
const MAX_AMOUNT = parseInt(process.env.MAX_AMOUNT || "100000", 10);
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || String(60 * 1000), 10); // افتراضي 1 دقيقة
const RATE_MAX = parseInt(process.env.RATE_MAX || "30", 10); // افتراضي 30 طلب/دقيقة

// rate limiter
const limiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// UUID v4 regex
const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeString(s, maxLen) {
  if (!s && s !== "") return "";
  s = String(s).trim();
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

app.post("/chargeCoins", async (req, res) => {
  try {
    const secret = req.get("x-admin-secret") || req.body.secret;
    if (!secret || secret !== FUNCTION_SECRET) return res.status(401).send({ error: "unauthorized" });

    let { user_id, amount, note, tx_id, admin_name } = req.body || {};
    user_id = sanitizeString(user_id, 100);
    note = sanitizeString(note || "", 500);
    admin_name = sanitizeString(admin_name || "mobile-admin", 100);

    if (!user_id || amount === undefined || !tx_id) {
      return res.status(400).send({ error: "user_id, amount and tx_id required" });
    }

    if (!UUIDv4.test(tx_id)) return res.status(400).send({ error: "tx_id must be a valid UUID v4" });

    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0 || amt > MAX_AMOUNT) {
      return res.status(400).send({ error: `invalid amount (1..${MAX_AMOUNT})` });
    }

    const logRef = db.collection("credit_logs").doc(tx_id);
    const logSnap = await logRef.get();
    if (logSnap.exists) {
      const currentSnap = await db.collection("users").doc(user_id).get();
      const currentCoins = currentSnap.exists ? (currentSnap.get("coins") || 0) : 0;
      return res.status(200).send({ status: "duplicate", message: "transaction already processed", user_id, current_coins: currentCoins });
    }

    const userRef = db.collection("users").doc(user_id);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      let current = 0;
      if (userSnap.exists) current = userSnap.get("coins") || 0;
      else tx.set(userRef, { coins: 0 });

      const newCoins = current + amt;
      tx.update(userRef, { coins: newCoins });

      tx.set(logRef, {
        admin: admin_name,
        user_id,
        amount: amt,
        note: note || "",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    const newSnap = await db.collection("users").doc(user_id).get();
    return res.status(200).send({ status: "ok", user_id, new_coins: newSnap.get("coins") });
  } catch (err) {
    console.error("chargeCoins error:", err);
    return res.status(500).send({ error: "internal", detail: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server started on port", port));
