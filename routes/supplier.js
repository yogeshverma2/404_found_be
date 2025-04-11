const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { Order, Trade, User } = require('../config/database').models;
const whatsapp = require('../services/whatsapp');

// Get available trades
router.get('/trades', auth, checkRole(['supplier']), async (req, res) => {
    try {
        const trades = await Trade.findAll({
            where: { status: 'active' }
        });
        res.json(trades);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create order
router.post('/orders', auth, checkRole(['supplier']), async (req, res) => {
    try {
        const order = await Order.create({
            ...req.body,
            supplierId: req.user.id
        });
        res.status(201).json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Negotiate price and notify broker
router.put('/orders/:orderId/negotiate', auth, checkRole(['supplier']), async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.orderId, {
            include: [{
                model: User,
                as: 'broker',
                attributes: ['phone']
            }]
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        order.counter_offer = req.body.counter_offer;
        order.status = 'negotiating';
        await order.save();

        // Send WhatsApp notification to broker
        if (order.broker.phone) {
            await whatsapp.sendNegotiationUpdate(order.broker.phone, order);
        }

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 