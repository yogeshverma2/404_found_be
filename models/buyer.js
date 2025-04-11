const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Buyer = sequelize.define('Buyer', {
        id: {
            type: DataTypes.STRING(36),
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        financer_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        credit_limit: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        available_credit: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        underscored: true,
        timestamps: true
    });

    return Buyer;
}; 