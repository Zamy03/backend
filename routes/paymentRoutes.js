const express = require('express');
const { createTransaction, handlePaymentNotification } = require('../controllers/paymentController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/create', authenticateToken, createTransaction);
router.post('/notification', handlePaymentNotification);

module.exports = router;