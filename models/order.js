const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        trade_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        supplier_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        broker_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        quantity: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        price_per_qtl: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        total_amount: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        supplier_commission_rate: {
            type: DataTypes.FLOAT(4, 2),
            allowNull: false,
            defaultValue: 0
        },
        supplier_commission_amount: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        buyer_commission_rate: {
            type: DataTypes.FLOAT(4, 2),
            allowNull: false,
            defaultValue: 0
        },
        buyer_commission_amount: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        total_commission: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM(
                'pending',
                'supplier_accepted',
                'broker_accepted',
                'negotiating',
                'confirmed',
                'financed',
                'delivered',
                'completed'
            ),
            defaultValue: 'pending'
        },
        counter_offer: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: true
        },
        payment_status: {
            type: DataTypes.ENUM(
                'pending',
                'supplier_commission_paid',
                'buyer_commission_paid',
                'all_paid'
            ),
            defaultValue: 'pending'
        }
    }, {
        underscored: true,
        timestamps: true,
        hooks: {
            beforeCreate: (order) => {
                order.supplier_commission_amount = (order.total_amount * order.supplier_commission_rate) / 100;
                order.buyer_commission_amount = (order.total_amount * order.buyer_commission_rate) / 100;
                order.total_commission = order.supplier_commission_amount + order.buyer_commission_amount;
            }
        }
    });

    return Order;
}; 