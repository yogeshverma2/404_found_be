const express = require('express');
const router = express.Router();
const messageProcessor = require('../services/messageProcessor');
const whatsapp = require('../services/whatsapp');

// Webhook verification endpoint
router.get('/webhook', (req, res) => {
    // Your verify token (add this to .env)
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Handle incoming messages
router.post('/webhook', express.json(), async (req, res) => {
    try {
        const { body } = req;

        // Check if it's a WhatsApp message notification
        if (body.object === 'whatsapp_business_account') {
            if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from; // User's phone number
                const messageText = message.text.body;

                console.log(`Received message from ${from}: ${messageText}`);

                // Handle different message types
                await handleIncomingMessage(from, messageText);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

async function handleIncomingMessage(from, messageText) {
    const text = messageText.toLowerCase();

    if (text.startsWith(' ̰')) {
        const tradeId = messageText.split(' ')[2];
        if (!tradeId) {
            await whatsapp.sendMessage(from, 'Please provide a trade ID. Format: accept trade <trade_id>');
            return;
        }
        await messageProcessor.processTradeResponse(from, tradeId, 'accept');
    }
    else if (text.startsWith('counter')) {
        const parts = messageText.split(' ');
        if (parts.length < 4) {
            await whatsapp.sendMessage(from, 'Please provide trade ID and price. Format: counter <trade_id> <price>');
            return;
        }

        const tradeId = parts[2];
        const price = parseFloat(parts[3]);

        if (isNaN(price) || price <= 0) {
            await whatsapp.sendMessage(from, 'Please provide a valid price');
            return;
        }

        await messageProcessor.processTradeResponse(from, tradeId, 'counter', price);
    }
    else if (text.startsWith('broker accept')) {
        const orderId = messageText.split(' ')[2];
        if (!orderId) {
            await whatsapp.sendMessage(from, 'Please provide an order ID. Format: broker accept <order_id>');
            return;
        }
        await messageProcessor.processBrokerResponse(from, orderId, 'accept');
    }
    else {
        // Help message for unknown commands
        const helpMessage = `Available commands:\n` +
            `1. accept trade <trade_id>\n` +
            `2. counter <trade_id> <price>\n` +
            `3. broker accept <order_id>`;
        await whatsapp.sendMessage(from, helpMessage);
    }
}

module.exports = router; 