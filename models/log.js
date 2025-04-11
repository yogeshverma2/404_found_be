const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Log = sequelize.define('Log', {
        id: {
            type: DataTypes.STRING(36),
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        broker_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('trade_accept', 'counter_offer', 'po_accept', 'invoice_generated', 'trade_created', 'trade_expired'),
            allowNull: false
        },
        message: {
            type: DataTypes.STRING,
            allowNull: false
        },
        entity_type: {
            type: DataTypes.ENUM('trade', 'order', 'purchase_order'),
            allowNull: false
        },
        entity_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        },
        actor_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        },
        actor_type: {
            type: DataTypes.ENUM('supplier', 'broker', 'financer'),
            allowNull: false
        },
        read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        details: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        underscored: true,
        timestamps: true,
        indexes: [
            {
                fields: ['broker_id']
            },
            {
                fields: ['entity_type', 'entity_id']
            }
        ]
    });

    return Log;
}; 