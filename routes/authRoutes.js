const express = require('express');
const { register, login, googleAuth, googleCallback} = require('../controllers/authController');
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');
const router = express.Router();

router.post('/register', register); // Endpoint untuk registrasi
router.post('/login', login);       // Endpoint untuk login

router.get('/google', googleAuth);

router.get('/google/callback', googleCallback);

module.exports = router;
