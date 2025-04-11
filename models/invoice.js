const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Invoice = sequelize.define('Invoice', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        invoice_number: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        order_id: {
            type: DataTypes.UUID,
            allowNull: false,
            // references: {
            //     model: 'Orders',
            //     key: 'id'
            // }
        },
        bill_from: {
            type: DataTypes.STRING,
            allowNull: false,
            // references: {
            //     model: 'Users',
            //     key: 'id'
            // }
        },
        ship_from: {
            type: DataTypes.STRING,
            allowNull: false,
            // references: {
            //     model: 'Users',
            //     key: 'id'
            // }
        },
        ship_to: {
            type: DataTypes.STRING,
            allowNull: false,
            // references: {
            //     model: 'Users',
            //     key: 'id'
            // }
        },
        bill_to: {
            type: DataTypes.STRING,
            allowNull: false,
            // references: {
            //     model: 'Users',
            //     key: 'id'
            // }
        },
        items: {
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                const rawValue = this.getDataValue('items');
                return rawValue ? JSON.parse(rawValue) : [];
            },
            set(value) {
                this.setDataValue('items', JSON.stringify(value));
            }
        },
        total_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        tax_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        shipping_charges: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        final_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        po_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('draft', 'pending', 'paid', 'cancelled'),
            defaultValue: 'pending'
        },
        broker_id: {
            type: DataTypes.STRING(36),
            allowNull: true,
            // references: {
            //     model: 'Users',
            //     key: 'id'
            // }
        },
        invoice_url: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        underscored: true,
        timestamps: true
    });

    return Invoice;
}; 