const { Trade, Order, User } = require('../config/database').models;
const whatsapp = require('./whatsapp');
const { Log } = require('../config/database').models;

class MessageProcessor {
    async processTradeResponse(from, tradeId, action, counterOffer = null) {
        try {
            const trade = await Trade.findByPk(tradeId, {
                include: [{
                    model: User,
                    as: 'broker',
                    attributes: ['phone']
                }]
            });
            // get user by phone number
            const user = await User.findOne({
                where: {
                    phone: from.slice(-10)
                }
            });


            if (!trade) {
                return await whatsapp.sendMessage(from, 'Trade not found');
            }

            // Validate trade status
            if (trade.status !== 'active') {
                return await whatsapp.sendMessage(from, 'This trade is no longer active');
            }

            if (action === 'accept') {
                // Create order with supplier_accepted status
                const order = await Order.create({
                    trade_id: trade.id,
                    supplier_id: user.id,
                    broker_id: trade.broker_id,
                    quantity: trade.quantity,
                    price_per_qtl: trade.price,
                    total_amount: trade.price * trade.quantity,
                    supplier_commission_rate: 2.5, // Default commission rates
                    buyer_commission_rate: 2.5,    // Can be made configurable
                    status: 'supplier_accepted'
                });

                // Create log for supplier acceptance
                await Log.create({
                    broker_id: trade.broker_id,
                    type: 'trade_accept',
                    message: `Supplier ${user.firm_name} accepted trade for ${trade.crop}`,
                    entity_type: 'trade',
                    entity_id: trade.id,
                    actor_id: user.id,
                    actor_type: 'supplier',
                    details: {
                        crop: trade.crop,
                        quantity: trade.quantity,
                        price: trade.price,
                        total_amount: trade.price * trade.quantity
                    }
                });


                // Notify broker for acceptance
                await whatsapp.sendOrderConfirmation(trade.broker.phone, order);

                // Confirm to supplier
                await whatsapp.sendMessage(from,
                    'Trade accepted successfully!\n' +
                    'Waiting for broker confirmation.\n' +
                    `Price: ₹${trade.price}/qtl\n` +
                    `Quantity: ${trade.quantity} qtl\n` +
                    `Total amount: ₹${trade.price * trade.quantity}\n` +
                    `Commission rate: ${order.supplier_commission_rate}%\n` +
                    `Commission amount: ₹${order.supplier_commission_amount}`
                );
            }
            else if (action === 'counter') {
                // Validate counter offer
                if (counterOffer >= trade.price) {
                    return await whatsapp.sendMessage(from,
                        'Counter offer must be lower than the original price. ' +
                        `Current price: ₹${trade.price}/qtl`
                    );
                }

                // Create order with counter offer
                const order = await Order.create({
                    trade_id: trade.id,
                    supplier_id: from,
                    broker_id: trade.broker_id,
                    quantity: trade.quantity,
                    counter_offer: counterOffer,
                    total_amount: counterOffer * trade.quantity,
                    status: 'negotiating'
                });

                // Update trade status
                trade.status = 'negotiating';
                await trade.save();

                // Create log for counter offer
                await Log.create({
                    broker_id: trade.broker_id,
                    type: 'counter_offer',
                    message: `Supplier made counter offer of ₹${counterOffer}/qtl`,
                    entity_type: 'order',
                    entity_id: order.id,
                    actor_id: from,
                    actor_type: 'supplier',
                    details: {
                        original_price: trade.price,
                        counter_offer: counterOffer,
                        quantity: trade.quantity
                    }
                });

                // Notify broker
                await whatsapp.sendNegotiationUpdate(trade.broker.phone, order);

                // Confirm to supplier
                await whatsapp.sendMessage(from,
                    'Counter offer sent successfully!\n' +
                    `Original price: ₹${trade.price}/qtl\n` +
                    `Your offer: ₹${counterOffer}/qtl\n` +
                    `Quantity: ${trade.quantity} qtl\n` +
                    `Total amount: ₹${counterOffer * trade.quantity}`
                );
            }
        } catch (error) {
            console.error('Error processing trade response:', error);
            await whatsapp.sendMessage(from, 'Sorry, there was an error processing your request.');
        }
    }

    // Add method for broker's response
    async processBrokerResponse(from, orderId, action) {
        try {
            const order = await Order.findByPk(orderId, {
                include: [
                    {
                        model: User,
                        as: 'supplier',
                        attributes: ['phone']
                    },
                    {
                        model: Trade,
                        attributes: ['price', 'quantity']
                    }
                ]
            });

            if (!order) {
                return await whatsapp.sendMessage(from, 'Order not found');
            }

            if (order.broker_id !== from) {
                return await whatsapp.sendMessage(from, 'You are not authorized to respond to this order');
            }

            if (action === 'accept') {
                if (order.status === 'supplier_accepted') {
                    order.status = 'confirmed';
                    await order.save();

                    // Notify supplier
                    await whatsapp.sendMessage(order.supplier.phone,
                        '🎉 Broker has accepted the trade!\n' +
                        `Order ID: ${order.id}\n` +
                        `Price: ₹${order.Trade.price}/qtl\n` +
                        `Quantity: ${order.quantity} qtl\n` +
                        `Total amount: ₹${order.total_amount}`
                    );

                    // Confirm to broker
                    await whatsapp.sendMessage(from, 'Trade confirmed successfully!');
                } else {
                    await whatsapp.sendMessage(from, 'Invalid order status for acceptance');
                }
            }
            // Add more broker actions as needed
        } catch (error) {
            console.error('Error processing broker response:', error);
            await whatsapp.sendMessage(from, 'Sorry, there was an error processing your request.');
        }
    }
}

module.exports = new MessageProcessor(); 