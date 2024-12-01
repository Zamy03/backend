const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Setup storage untuk menyimpan file sementara di memory
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/; // Hanya menerima file gambar
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, jpg, png) are allowed'));
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // Batasi ukuran file (2MB)
});

module.exports = { upload };
