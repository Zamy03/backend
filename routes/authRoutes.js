const express = require('express');
const { register, verifyOtp, login, googleAuth, googleCallback, requestResetPassword, resetPassword} = require('../controllers/authController');
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');
const router = express.Router();

router.post('/register', register); // Endpoint untuk registrasi
router.post('/verify-otp', verifyOtp); // Endpoint untuk verifikasi OTP
router.post('/login', login);       // Endpoint untuk login

router.get('/google', googleAuth);

router.get('/google/callback', googleCallback);

router.post('/request-reset-password', requestResetPassword);

router.post('/reset-password', resetPassword);

module.exports = router;
