const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PurchaseOrder = sequelize.define('PurchaseOrder', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        buyer_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Buyers',
                key: 'id'
            }
        },
        order_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Orders',
                key: 'id'
            }
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        price_per_qtl: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        total_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'completed'),
            defaultValue: 'pending'
        }
    }, {
        underscored: true,
        timestamps: true
    });

    return PurchaseOrder;
}; 