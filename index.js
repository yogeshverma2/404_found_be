const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/database').sequelize;
const authRoutes = require('./routes/auth');
const brokerRoutes = require('./routes/broker');
const supplierRoutes = require('./routes/supplier');
const webhookRoutes = require('./routes/webhook');
const financerRoutes = require('./routes/financer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON bodies
app.use(express.json());
app.use(cors());

// Routes
app.use('/auth', authRoutes);
app.use('/broker', brokerRoutes);
app.use('/supplier', supplierRoutes);
app.use('/webhook', webhookRoutes);
app.use('/financer', financerRoutes);

// Database sync and server start
sequelize.sync({ alter: true }).then(() => {
    console.log('Database synced successfully');
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch(err => {
    console.error('Database sync error:', err);
}); 