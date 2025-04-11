const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PurchaseOrder = sequelize.define('PurchaseOrder', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        order_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Orders',
                key: 'id'
            }
        },
        po_number: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        status: {
            type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
            defaultValue: 'draft'
        },
        terms_and_conditions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        }
    }, {
        underscored: true,
        timestamps: true
    });

    return PurchaseOrder;
}; 