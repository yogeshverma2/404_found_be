const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Trade = sequelize.define('Trade', {
        id: {
            type: DataTypes.STRING(36),
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        crop: {
            type: DataTypes.STRING,
            allowNull: false
        },
        grade: {
            type: DataTypes.STRING,
            allowNull: false
        },
        price: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        quantity: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false
        },
        valid_till: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'expired', 'negotiating', 'confirmed'),
            defaultValue: 'active'
        },
        broker_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        }
    }, {
        underscored: true,
        timestamps: true,
        tableName: 'trades'
    });

    return Trade;
}; 