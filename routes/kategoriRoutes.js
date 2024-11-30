const express = require('express');
const { getAllKategori, getKategoriById, createKategori, updateKategori, deleteKategori} = require('../controllers/kategoriController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');
const router = express.Router();

router.get('/all' , authenticateToken, getAllKategori); // Endpoint untuk mendapatkan semua kategori
router.get('/:id', authenticateToken, getKategoriById); // Endpoint untuk mendapatkan kategori berdasarkan ID
router.post('/create', authenticateToken, createKategori); // Endpoint untuk membuat kategori baru
router.put('/update/:id', authenticateToken, updateKategori); // Endpoint untuk mengupdate kategori berdasarkan ID
router.delete('/delete/:id', authenticateToken, deleteKategori); // Endpoint untuk menghapus kategori berdasarkan ID

module.exports = router;