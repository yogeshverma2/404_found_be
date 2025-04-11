const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { Trade, User, Order, Buyer, PurchaseOrder, Log, Invoice } = require('../config/database').models;
const whatsapp = require('../services/whatsapp');
const sequelize = require('sequelize');
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const invoicesDir = path.join(uploadsDir, 'invoices');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, invoicesDir);
    },
    filename: function (req, file, cb) {
        cb(null, `invoice_${Date.now()}.pdf`);
    }
});

const upload = multer({ storage: storage });

// Create trade and notify suppliers
router.post('/trade', auth, checkRole(['broker']), async (req, res) => {
    try {
        const trade = await Trade.create({
            ...req.body,
            broker_id: req.user.id
        });

        // Get all suppliers to notify them
        const suppliers = await User.findAll({
            where: { role: 'supplier', broker_id: req.user.id }
        });

        // Send WhatsApp notifications to all suppliers
        for (const supplier of suppliers) {
            if (supplier.phone) {
                await whatsapp.sendTrade(supplier.phone, trade);
            }
        }

        res.status(201).json(trade);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add supplier
router.post('/supplier', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { firm_name, phone, address } = req.body;
        const supplier = await User.create({
            firm_name,
            phone,
            address,
            role: 'supplier'
        });
        res.status(201).json(supplier);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all trades
router.get('/trades', auth, checkRole(['broker']), async (req, res) => {
    try {
        const trades = await Trade.findAll({
            where: { broker_id: req.user.id }
        });
        res.json(trades);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Confirm order and notify supplier
router.put('/orders/:orderId/confirm', auth, checkRole(['broker']), async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.orderId, {
            include: [{
                model: User,
                as: 'supplier',
                attributes: ['phone']
            }]
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        order.status = 'confirmed';
        await order.save();

        // Send WhatsApp notification to supplier
        if (order.supplier.phone) {
            await whatsapp.sendOrderConfirmation(order.supplier.phone, order);
        }

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get commission summary
router.get('/commissions/summary', auth, checkRole(['broker']), async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: {
                broker_id: req.user.id,
                status: ['confirmed', 'financed', 'delivered', 'completed']
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('supplier_commission_amount')), 'total_supplier_commission'],
                [sequelize.fn('SUM', sequelize.col('buyer_commission_amount')), 'total_buyer_commission'],
                [sequelize.fn('SUM', sequelize.col('total_commission')), 'total_commission'],
                'payment_status'
            ],
            group: ['payment_status']
        });

        res.json(orders);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get commission details by order
router.get('/commissions/orders', auth, checkRole(['broker']), async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: {
                broker_id: req.user.id,
                status: ['confirmed', 'financed', 'delivered', 'completed']
            },
            attributes: [
                'id',
                'trade_id',
                'supplier_commission_amount',
                'buyer_commission_amount',
                'total_commission',
                'payment_status',
                'status',
                'created_at'
            ],
            include: [
                {
                    model: User,
                    as: 'supplier',
                    attributes: ['firm_name', 'phone']
                },
                {
                    model: Trade,
                    attributes: ['crop', 'grade', 'quantity']
                }
            ]
        });

        res.json(orders);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update commission payment status
router.put('/commissions/:orderId/payment', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { payment_from } = req.body; // 'supplier' or 'buyer'
        const order = await Order.findByPk(req.params.orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update payment status
        if (payment_from === 'supplier' && order.payment_status === 'pending') {
            order.payment_status = 'supplier_commission_paid';
        } else if (payment_from === 'buyer' && order.payment_status === 'pending') {
            order.payment_status = 'buyer_commission_paid';
        } else if (payment_from === 'supplier' && order.payment_status === 'buyer_commission_paid' ||
            payment_from === 'buyer' && order.payment_status === 'supplier_commission_paid') {
            order.payment_status = 'all_paid';
        }

        await order.save();
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create PO from trade
router.post('/trades/:tradeId/purchase-orders', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { buyer_id, quantity } = req.body;
        const trade = await Trade.findByPk(req.params.tradeId);

        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        const buyer = await Buyer.findByPk(buyer_id);
        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        const totalAmount = quantity * trade.price;
        if (totalAmount > buyer.available_credit) {
            return res.status(400).json({ error: 'Insufficient credit limit' });
        }

        // Generate PO number
        const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const po = await PurchaseOrder.create({
            po_number: poNumber,
            trade_id: trade.id,
            buyer_id: buyer.id,
            supplier_id: trade.supplier_id,
            broker_id: req.user.id,
            quantity,
            price_per_qtl: trade.price,
            total_amount: totalAmount
        });

        // Update buyer's available credit
        buyer.available_credit -= totalAmount;
        await buyer.save();

        // Notify supplier via WhatsApp
        const supplier = await User.findByPk(trade.supplier_id);
        if (supplier.phone) {
            await whatsapp.sendPurchaseOrder(supplier.phone, po);
        }

        res.status(201).json(po);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get unread notifications
router.get('/notifications', auth, checkRole(['broker']), async (req, res) => {
    try {
        const logs = await Log.findAll({
            where: {
                broker_id: req.user.id,
                read: false
            },
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'actor',
                    attributes: ['firm_name', 'phone']
                }
            ]
        });

        res.json(logs);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Mark notifications as read
router.put('/notifications/read', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { notification_ids } = req.body;

        await Log.update(
            { read: true },
            {
                where: {
                    id: notification_ids,
                    broker_id: req.user.id
                }
            }
        );

        res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get notification count
router.get('/notifications/count', auth, checkRole(['broker']), async (req, res) => {
    try {
        const count = await Log.count({
            where: {
                broker_id: req.user.id,
                read: false
            }
        });

        res.json({ count });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get notification history
router.get('/notifications/history', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const logs = await Log.findAndCountAll({
            where: {
                broker_id: req.user.id
            },
            order: [['created_at', 'DESC']],
            limit,
            offset,
            include: [
                {
                    model: User,
                    as: 'actor',
                    attributes: ['firm_name', 'phone']
                }
            ]
        });

        res.json({
            logs: logs.rows,
            total: logs.count,
            pages: Math.ceil(logs.count / limit),
            current_page: page
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Broadcast trade to suppliers
router.post('/trade/broadcast', auth, checkRole(['broker']), async (req, res) => {
    try {
        const { trade_id } = req.body;

        // Validate trade_id
        if (!trade_id) {
            return res.status(400).json({ error: 'Trade ID is required' });
        }

        // Get trade details
        const trade = await Trade.findByPk(trade_id, {
            include: [{
                model: User,
                as: 'broker',
                attributes: ['id']
            }]
        });

        // Check if trade exists
        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        // Check if trade belongs to the broker
        if (trade.broker_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to broadcast this trade' });
        }

        // Check if trade is already broadcasted
        const existingBroadcast = await Log.findOne({
            where: {
                entity_type: 'trade',
                entity_id: trade_id,
                type: 'trade_broadcast'
            }
        });

        if (existingBroadcast) {
            return res.status(400).json({ error: 'Trade already broadcasted' });
        }

        // Check if trade is still valid
        if (new Date(trade.valid_till) < new Date()) {
            return res.status(400).json({ error: 'Trade validity has expired' });
        }

        // Get all active suppliers
        const suppliers = await User.findAll({
            where: {
                role: 'supplier',
                // status: 'active'
            }
        });

        if (suppliers.length === 0) {
            return res.status(400).json({ error: 'No active suppliers found' });
        }

        // Create individual logs and send WhatsApp messages
        const supplierLogs = [];
        for (const supplier of suppliers) {
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

            // Send messages in sequence
            await whatsapp.sendMessage(supplier.phone, tradeDetails);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between messages
            await whatsapp.sendMessage(supplier.phone, acceptMessage);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between messages
            await whatsapp.sendMessage(supplier.phone, counterMessage);
        }

        await Log.bulkCreate(supplierLogs);

        res.status(200).json({
            message: 'Trade broadcasted successfully',
            supplier_count: suppliers.length
        });

    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Error broadcasting trade' });
    }
});

// Get broadcast history
router.get('/broadcast-history', auth, checkRole(['broker']), async (req, res) => {
    try {
        const broadcasts = await Log.findAll({
            where: {
                broker_id: req.user.id,
                type: 'trade_broadcast'
            },
            include: [{
                model: Trade,
                attributes: ['crop', 'grade', 'price', 'quantity', 'valid_till']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json(broadcasts);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching broadcast history' });
    }
});

// Get supplier details
router.get('/supplier/:id', auth, checkRole(['broker']), async (req, res) => {
    try {
        const supplier = await User.findOne({
            where: {
                id: req.params.id,
                role: 'supplier'
            },
            attributes: ['id', 'name', 'email', 'phone', 'created_at']
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        res.json(supplier);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all suppliers
router.get('/suppliers', auth, checkRole(['broker']), async (req, res) => {
    try {
        const suppliers = await User.findAll({
            where: { role: 'supplier' },
            attributes: ['id', 'firm_name', 'phone', 'address', 'email', 'pan_number', 'aadhar_number', 'upi_id', 'bank_info'],
            order: [['created_at', 'DESC']]
        });
        res.json(suppliers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get supplier details for invoice
router.get('/invoice/suppliers/:logId', auth, checkRole(['broker']), async (req, res) => {
    try {
        const log = await Log.findByPk(req.params.logId, {
            include: [{
                model: User,
                as: 'supplier',
                attributes: ['id', 'firm_name', 'phone', 'address']
            }]
        });

        if (!log) {
            return res.status(404).json({ error: 'Log not found' });
        }
        const trade_id = log.entity_id;
        const order = await Order.findOne({
            where: {
                trade_id: trade_id
            },
            order: [['created_at', 'DESC']]
        });
        const current_supplier = await User.findByPk(log.actor_id, {
            attributes: ['id', 'firm_name', 'phone', 'address']
        });
        // Get all suppliers for dropdown
        const suppliers = await User.findAll({
            where: { role: 'supplier' },
            attributes: ['id', 'firm_name', 'phone', 'address']
        });

        res.json({
            current_supplier: current_supplier,
            log_details: log,
            order: {
                ...order,
                bill_from: `${current_supplier?.address} ${current_supplier?.firm_name} ${current_supplier?.phone} `,
                ship_from: `${current_supplier?.address} ${current_supplier?.firm_name} ${current_supplier?.phone} `,
            },
            invoice: {
                bill_from: `${current_supplier?.address} ${current_supplier?.firm_name} ${current_supplier?.phone} `,
                ship_from: `${current_supplier?.address} ${current_supplier?.firm_name} ${current_supplier?.phone} `,
                items: [{
                    crop: order.crop,
                    price: order.price,
                    quantity: order.quantity,
                    total_amount: order.total_amount
                }],
                order_id: order?.id || '',
                total_amount: order?.total_amount || 0,
                tax_amount: order?.tax_amount || 0,
                shipping_charges: order?.shipping_charges || 0,
                final_amount: order?.total_amount || 0,
                po_number: order?.po_number || '',
                broker_id: order?.broker_id || '',
                invoice_number: order?.invoice_number || ''
            },
            available_suppliers: suppliers
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create invoice
router.post('/invoice', auth, checkRole(['broker']), async (req, res) => {
    try {
        const {
            bill_from,
            ship_from,
            ship_to,
            bill_to,
            order_id,
            items,
            total_amount,
            tax_amount,
            shipping_charges,
            final_amount
        } = req.body;

        // Validate required fields
        if (!bill_from || !ship_from || !ship_to || !bill_to || !order_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create invoice record without invoice number
        const invoice = await Invoice.create({
            order_id,
            bill_from,
            ship_from,
            ship_to,
            bill_to,
            items: JSON.stringify(items),
            total_amount,
            tax_amount,
            shipping_charges,
            final_amount,
            status: 'pending',
            broker_id: req.user.id
        });

        // Get supplier details for notification
        const supplier = await User.findByPk(ship_from);
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Generate invoice link
        const invoiceLink = `${process.env.FRONTEND_URL}/invoices/${invoice.id}`;

        // Send WhatsApp notification to supplier
        const message = `📄 New Invoice Request!\n\n` +
            `Order ID: ${order_id}\n` +
            `Amount: ₹${final_amount}\n\n` +
            `Please provide your invoice number by replying:\n` +
            `invoice ${invoice.id} <your_invoice_number>`;

        await whatsapp.sendMessage(supplier.phone, message);

        res.status(201).json({
            message: 'Invoice request created successfully',
            invoice,
            invoice_link: invoiceLink
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update invoice number (for suppliers)
router.put('/invoice/:id/number', auth, checkRole(['supplier']), async (req, res) => {
    try {
        const { invoice_number } = req.body;

        if (!invoice_number) {
            return res.status(400).json({ error: 'Invoice number is required' });
        }

        const invoice = await Invoice.findOne({
            where: {
                id: req.params.id,
                ship_from: req.user.id // Ensure supplier owns this invoice
            }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (invoice.invoice_number) {
            return res.status(400).json({ error: 'Invoice number already set' });
        }

        // Update invoice with supplier's invoice number
        await invoice.update({ invoice_number });

        // Notify broker
        const broker = await User.findByPk(invoice.broker_id);
        if (broker && broker.phone) {
            const message = `📄 Invoice Number Updated!\n\n` +
                `Invoice ID: ${invoice.id}\n` +
                `Supplier Invoice Number: ${invoice_number}\n` +
                `Amount: ₹${invoice.final_amount}`;

            await whatsapp.sendMessage(broker.phone, message);
        }

        res.json({
            message: 'Invoice number updated successfully',
            invoice
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, '../uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Create dummy invoice
router.post('/invoice/dummy', auth, checkRole(['broker']), async (req, res) => {
    try {
        const {
            bill_from,
            ship_from,
            ship_to,
            bill_to,
            order_id,
            items,
            total_amount,
            tax_amount,
            shipping_charges,
            final_amount
        } = req.body;

        // Create PDF document
        const doc = new PDFDocument();
        const filename = `invoice_${Date.now()}.pdf`;
        const filePath = path.join(invoicesDir, filename);

        // Pipe the PDF to a file
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Add content to PDF
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Bill From
        doc.fontSize(12).text('Bill From:', { underline: true });
        doc.fontSize(10).text(bill_from);
        doc.moveDown();

        // Ship From
        doc.fontSize(12).text('Ship From:', { underline: true });
        doc.fontSize(10).text(ship_from);
        doc.moveDown();

        // Ship To
        doc.fontSize(12).text('Ship To:', { underline: true });
        doc.fontSize(10).text(ship_to);
        doc.moveDown();

        // Bill To
        doc.fontSize(12).text('Bill To:', { underline: true });
        doc.fontSize(10).text(bill_to);
        doc.moveDown();

        // Items Table
        doc.fontSize(12).text('Items:', { underline: true });
        doc.moveDown();

        // Table Header
        doc.fontSize(10).text('Crop', 50, doc.y);
        doc.text('Price', 200, doc.y);
        doc.text('Quantity', 300, doc.y);
        doc.text('Total', 400, doc.y);
        doc.moveDown();

        // Table Rows
        items.forEach(item => {
            doc.text(item.crop, 50, doc.y);
            doc.text(`₹${item.price}`, 200, doc.y);
            doc.text(item.quantity.toString(), 300, doc.y);
            doc.text(`₹${item.total_amount}`, 400, doc.y);
            doc.moveDown();
        });

        // Summary
        doc.moveDown();
        doc.fontSize(12).text('Summary:', { underline: true });
        doc.moveDown();
        doc.fontSize(10).text(`Total Amount: ₹${total_amount}`, 50, doc.y);
        doc.text(`Tax Amount: ₹${tax_amount}`, 50, doc.y + 20);
        doc.text(`Shipping Charges: ₹${shipping_charges}`, 50, doc.y + 40);
        doc.fontSize(12).text(`Final Amount: ₹${final_amount}`, 50, doc.y + 60, { bold: true });

        // Finalize PDF
        doc.end();

        // Wait for the write stream to finish
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Create invoice record
        const invoice = await Invoice.create({
            order_id,
            bill_from,
            ship_from,
            ship_to,
            bill_to,
            items: JSON.stringify(items),
            total_amount,
            tax_amount,
            shipping_charges,
            final_amount,
            status: 'draft',
            broker_id: req.user.id,
            file_path: `/broker/invoices/${filename}`
        });
        const broker = await User.findByPk(invoice.broker_id);
        if (broker && broker.phone) {
            const message = `📄 Invoice Number Updated!\n\n` +
                `Invoice ID: ${invoice.id}\n` +
                `Supplier Invoice Number: ${invoice_number}\n` +
                `Amount: ₹${invoice.final_amount}`;

            await whatsapp.sendMessage(broker.phone, message);
        }
        const invoiceLink = `https://v37b3klv-3000.inc1.devtunnels.ms/invoices/${invoice.id}/edit`;

        res.json({
            message: 'Dummy invoice created successfully',
            invoice,
            invoice_link: invoiceLink,
            pdf_url: `https://v37b3klv-3000.inc1.devtunnels.ms/broker/invoices/${filename}`
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Serve generated invoices
router.get('/invoices/:filename', (req, res) => {
    const filePath = path.join(invoicesDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${req.params.filename}`);
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Invoice not found' });
    }
});

// Get accepted trades logs
router.get('/logs/accepted-trades', auth, checkRole(['broker', 'financer']), async (req, res) => {
    try {
        const logs = await Log.findAll({
            where: {
                type: 'trade_accept',
                broker_id: req.user.id
            },
            include: [
                // {
                //     model: User,
                //     as: 'supplier',
                //     attributes: ['id', 'firm_name', 'phone', 'address']
                // },
                // {
                //     model: Trade,
                //     attributes: ['id', 'crop', 'grade', 'price', 'quantity', 'valid_till']
                // }
            ],
            order: [['created_at', 'DESC']]
        });
        Object.keys(logs).map(log => {
            log.message = log.message + ' Price is' + log?.details?.price;
        });

        // Transform logs to include order details if available
        // const logsWithOrders = await Promise.all(logs.map(async (log) => {
        //     const order = await Order.findOne({
        //         where: {
        //             trade_id: log.entity_id,
        //             supplier_id: log.actor_id
        //         },
        //         attributes: ['id', 'status', 'quantity', 'price_per_qtl', 'total_amount']
        //     });

        //     return {
        //         ...log.toJSON(),
        //         order: order || null
        //     };
        // }));

        res.json(logs);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get invoice details
router.get('/invoiceslist/details', auth, checkRole(['broker']), async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            where: {
                broker_id: req.user.id
            },
            attributes: [
                'id',
                'invoice_number',
                'total_amount',
                'bill_from',
                'ship_from',
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Transform the response to include supplier details
        const invoiceDetails = invoices.map(invoice => ({
            id: invoice.id,
            invoice_number: invoice.invoice_number || 'Not Assigned',
            total_amount: invoice.total_amount,
            supplier: {
                name: invoice.bill_from,
                address: invoice.ship_from
            },
            created_at: invoice.created_at
        }));

        res.json(invoiceDetails);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 