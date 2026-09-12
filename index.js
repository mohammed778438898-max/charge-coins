const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(rateLimit({ windowMs: 60_000, max: 30 }));

const DB_FILE = path.join(__dirname, 'txs.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

function readTxs() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE));
  } catch (e) {
    return [];
  }
}

function writeTxs(txs) {
  fs.writeFileSync(DB_FILE, JSON.stringify(txs, null, 2));
}

app.post('/send', (req, res) => {
  const { to, amount } = req.body || {};
  if (!to || amount === undefined) return res.status(400).json({ error: 'required: to, amount' });
  const txid = crypto.randomBytes(16).toString('hex');
  const tx = { txid, to, amount, status: 'confirmed', timestamp: new Date().toISOString() };
  const txs = readTxs();
  txs.push(tx);
  writeTxs(txs);
  return res.json({ success: true, txid, tx });
});

app.get('/txs', (_, res) => res.json(readTxs()));

app.get('/', (_, res) => res.send('Local test transaction simulator'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Test server listening on ${port}`));
