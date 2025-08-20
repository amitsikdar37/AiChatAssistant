const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;

// GET /webhook for verification (Instagram only)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// POST /webhook to receive Instagram events
app.post('/webhook', (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  const body = req.body;
  
  // Handle Instagram messages only
  if (body.object === 'instagram') {
    handleInstagramMessages(body);
  }
});

// Instagram message handler
function handleInstagramMessages(body) {
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(message => {
      if (message.message) {
        // Skip if message is from your own page/bot
        if (message.sender.id === PAGE_ID) {
          console.log('🤖 Skipping own message');
          return;
        }

        // Skip if it's an echo of our bot's reply
        if (message.message.text?.includes('I\'m an AI assistant powered by multiple personas')) {
          console.log('🔄 Skipping bot echo');
          return;
        }

        console.log(`📸 Instagram: ${message.sender.id} → "${message.message.text || 'Non-text'}"`);
        processInstagramMessage(message);
      }
    });
  });
}

// Instagram message processing with reply
async function processInstagramMessage(message) {
  try {
    if (!message.message.text) return;
    
    const userMessage = message.message.text;
    const senderId = message.sender.id;
    const defaultReply = `Hi! Thanks for your message: "${userMessage}". I'm an AI assistant powered by multiple personas. How can I help you today? 🤖`;
    
    await sendInstagramReply(senderId, defaultReply);
    
  } catch (error) {
    console.error('❌ Instagram error:', error.message);
  }
}

// Send Instagram reply function
async function sendInstagramReply(recipientId, messageText) {
  try {
    // Skip if ID looks like system/page ID
    if (recipientId === PAGE_ID || recipientId.length < 10) {
      console.log('⚠️ Invalid recipient ID, skipping');
      return;
    }

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PAGE_ID}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText }
      },
      {
        headers: {
          'Authorization': `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Instagram reply sent');
    return response.data;
    
  } catch (error) {
    // Don't log full error for "no matching user" - it's expected
    if (error.response?.data?.error?.code === 100) {
      console.log('⚠️ User not found (likely unauthorized/invalid)');
    } else {
      console.error('❌ Send error:', error.response?.data?.error?.message || error.message);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Instagram AI Assistant server running on port ${PORT}`);
});
