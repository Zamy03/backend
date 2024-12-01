const express = require('express');
const { createTransaction } = require('../controllers/paymentController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/create', authenticateToken, createTransaction);

module.exports = router;