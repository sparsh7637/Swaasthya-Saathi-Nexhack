const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Config
require('dotenv').config();
const { NGROK_DOMAIN } = require('./src/config/env');
const twilioClient = require('./src/config/twilio');

// Routes
const webhookRouter = require('./src/routes/webhook');

const app = express();

app.use('/static', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

// Twilio webhooks use x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Mount routes
app.use('/', webhookRouter({ twilioClient, ngrokDomain: NGROK_DOMAIN }));

app.listen(3000, () => {
  console.log('📡 WhatsApp OCR + Voice Bot running on http://localhost:3000');
});