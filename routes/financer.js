const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { Buyer, PurchaseOrder, Trade, User } = require('../config/database').models;
const whatsapp = require('../services/whatsapp');

// Add buyer
router.post('/buyers', auth, checkRole(['financer']), async (req, res) => {
    try {
        const buyer = await Buyer.create({
            ...req.body,
            financer_id: req.user.id,
            available_credit: req.body.credit_limit
        });
        res.status(201).json(buyer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all buyers
router.get('/buyers', auth, checkRole(['financer']), async (req, res) => {
    try {
        const buyers = await Buyer.findAll({
            where: { financer_id: req.user.id }
        });
        res.json(buyers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update buyer credit limit
router.put('/buyers/:id/credit', auth, checkRole(['financer']), async (req, res) => {
    try {
        const buyer = await Buyer.findByPk(req.params.id);
        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        const creditDiff = req.body.credit_limit - buyer.credit_limit;
        buyer.credit_limit = req.body.credit_limit;
        buyer.available_credit += creditDiff;
        await buyer.save();

        res.json(buyer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all POs
router.get('/purchase-orders', auth, checkRole(['financer']), async (req, res) => {
    try {
        const pos = await PurchaseOrder.findAll({
            include: [
                {
                    model: Buyer,
                    attributes: ['name', 'credit_limit', 'available_credit']
                },
                {
                    model: Trade,
                    attributes: ['crop', 'grade']
                }
            ]
        });
        res.json(pos);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all buyers with financing status
router.get('/buyers/all', auth, checkRole(['financer', 'broker']), async (req, res) => {
    try {
        // Get all financed buyers
        const financedBuyers = await Buyer.findAll({
            attributes: ['id', 'name', 'credit_limit', 'available_credit', 'financer_id', 'status']
        });

        // Get financer names
        const financerIds = [...new Set(financedBuyers.map(buyer => buyer.financer_id))];
        const financers = await User.findAll({
            where: {
                id: financerIds,
                role: 'financer'
            },
            attributes: ['id', 'firm_name', 'phone', 'email']
        });

        // Create a map of financer_id to financer details
        const financerMap = financers.reduce((acc, financer) => {
            acc[financer.id] = {
                firm_name: financer.firm_name,
                phone: financer.phone,
                email: financer.email
            };
            return acc;
        }, {});

        // Transform buyers to include both financed and non-financed versions
        const combinedBuyers = financedBuyers.flatMap(buyer => {
            const buyerData = buyer.toJSON();
            const financerDetails = financerMap[buyer.financer_id] || null;

            return [
                {
                    ...buyerData,
                    name: `${buyerData.name} (${financerDetails?.firm_name}  Credit limit ${buyerData?.credit_limit})`,
                    with_financing: true,
                    financer_details: financerDetails
                },
                {
                    ...buyerData,
                    id: buyerData.id + 'sdfsd',
                    with_financing: false,
                    credit_limit: null,
                    available_credit: null,
                    financer_details: null
                }
            ];
        });

        res.json(combinedBuyers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 