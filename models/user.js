const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.STRING(36),
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            // allowNull: false
        },
        role: {
            type: DataTypes.ENUM('broker', 'supplier', 'farmer', 'financer'),
            allowNull: false
        },
        firm_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        pan_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        aadhar_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        upi_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        bank_info: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        underscored: true,
        timestamps: true
    });

    User.beforeCreate(async (user) => {
        const salt = await bcrypt.genSalt(10);
        if (user.password) {
            user.password = await bcrypt.hash(user.password, salt);
        }
    });

    return User;
}; 