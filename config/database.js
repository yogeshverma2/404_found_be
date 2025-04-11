const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false,
        define: {
            underscored: true,
            timestamps: true
        }
    }
);

// Import models
const User = require('../models/user')(sequelize);
const Trade = require('../models/trade')(sequelize);
const Order = require('../models/order')(sequelize);
const Buyer = require('../models/buyer')(sequelize);
const Financer = require('../models/financer')(sequelize);
const Invoice = require('../models/invoice')(sequelize);
// const PurchaseOrder = require('../models/purchaseOrder')(sequelize);
const Log = require('../models/log')(sequelize);
// const Invoice = require('../models/invoice')(sequelize);

// Define associations
User.hasMany(Trade, { foreignKey: 'broker_id' });
Trade.belongsTo(User, { foreignKey: 'broker_id', as: 'broker' });

User.hasMany(Order, { foreignKey: 'supplier_id' });
Order.belongsTo(User, { foreignKey: 'supplier_id', as: 'supplier' });

// Buyer.hasMany(PurchaseOrder, { foreignKey: 'buyer_id' });
// PurchaseOrder.belongsTo(Buyer, { foreignKey: 'buyer_id' });

User.hasMany(Log, { foreignKey: 'supplier_id' });
Log.belongsTo(User, { foreignKey: 'supplier_id', as: 'supplier' });


module.exports = {
    sequelize,
    models: {
        User,
        Trade,
        Order,
        Buyer,
        // PurchaseOrder,
        Log,
        Invoice,
        Financer
    }
}; 