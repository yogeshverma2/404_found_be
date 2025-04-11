const axios = require('axios');
//'+918210473959'
class WhatsAppService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.baseUrl = `https://graph.facebook.com/v22.0/${this.phoneNumberId}`;
    }

    async sendMessage(phoneNumber, message) {
        try {
            phoneNumber = phoneNumber.slice(-10);
            const response = await axios.post(
                `${this.baseUrl}/messages`,
                // {
                //     messaging_product: "whatsapp",
                //     to: `+91${phoneNumber}`,
                //     type: "text",
                //     text: { body: message }
                // },
                {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": `+91${phoneNumber}`,
                    "type": "text",
                    "text": {
                        "preview_url": false,
                        "body": message
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('WhatsApp API Error:', error.response?.data || error.message);
            return false;
        }
    }

    async sendTrade(phone, trade) {
        try {
            // First message - Trade details
            const tradeDetails = `🌾 New Trade Alert!\n\n` +
                `Crop: ${trade.crop}\n` +
                `Grade: ${trade.grade}\n` +
                `Price: ₹${trade.price}/qtl\n` +
                `Quantity: ${trade.quantity} qtl\n` +
                `Valid Till: ${new Date(trade.valid_till).toLocaleString()}`;

            // Second message - Accept instruction
            const acceptMessage = `accept trade ${trade.id}`;

            // Third message - Counter offer instruction
            const counterMessage = `counter ${trade.id} <price>`;

            // Send messages in sequence with delays
            await this.sendMessage(phone, tradeDetails);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            await this.sendMessage(phone, acceptMessage);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            await this.sendMessage(phone, counterMessage);

            return true;
        } catch (error) {
            console.error('Error sending trade alert:', error);
            return false;
        }
    }

    async sendOrderConfirmation(phoneNumber, order) {
        const message = `🎉 Order Confirmed!\n\n` +
            `Order ID: ${order.id}\n` +
            `Quantity: ${order.quantity} qtl\n` +
            `Total Amount: ₹${order.total_amount}\n` +
            `Status: ${order.status}`;

        return this.sendMessage(phoneNumber, message);
    }

    async sendNegotiationUpdate(phoneNumber, order) {
        const message = `💬 New Price Negotiation\n\n` +
            `Order ID: ${order.id}\n` +
            `Counter Offer: ₹${order.counter_offer}/qtl`;

        return this.sendMessage(phoneNumber, message);
    }

    async sendPurchaseOrder(phoneNumber, po) {
        const message = `📋 New Purchase Order\n\n` +
            `PO Number: ${po.po_number}\n` +
            `Quantity: ${po.quantity} qtl\n` +
            `Price: ₹${po.price_per_qtl}/qtl\n` +
            `Total Amount: ₹${po.total_amount}\n\n` +
            `To generate invoice, reply with:\n` +
            `generate_invoice ${po.id} <your_invoice_number>`;

        return this.sendMessage(phoneNumber, message);
    }
}

module.exports = new WhatsAppService(); 