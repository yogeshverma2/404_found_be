const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Financer = sequelize.define('Financer', {
        id: {
            type: DataTypes.STRING(36),
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.STRING(36),
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        total_credit_limit: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        available_credit: {
            type: DataTypes.FLOAT(10, 2),
            allowNull: false,
            defaultValue: 0
        }
    }, {
        underscored: true,
        timestamps: true
    });

    return Financer;
}; 