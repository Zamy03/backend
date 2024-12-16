const express = require('express');
const { createTransaction, handlePaymentNotification, getAllTransactions, getTransactionByUserId } = require('../controllers/paymentController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/create', authenticateToken, createTransaction);
router.post('/notification', handlePaymentNotification);
router.get('/transactions', authenticateToken, getAllTransactions);
router.get('/transactions/:id', authenticateToken, getTransactionByUserId);

module.exports = router;