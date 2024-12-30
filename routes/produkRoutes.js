const express = require('express');
const {
    getAllProduk,
    getProdukById,
    getProdukByKategori,
    createProduk,
    updateProduk,
    deleteProduk
} = require('../controllers/produkController');
const { upload } = require('../middlewares/multerMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Middleware JWT auth
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');
const router = express.Router();

router.get('/all', authenticateToken, getAllProduk);
router.get('/:id', authenticateToken, getProdukById);
router.get('/kategori/:id_kategori', authenticateToken, getProdukByKategori);
router.post('/create', authenticateToken, upload.single('file'),createProduk);
router.put('/update/:id', authenticateToken, upload.single('file'),updateProduk);
router.delete('/delete/:id', authenticateToken, deleteProduk);

module.exports = router;
