const express = require('express');
const authRoutes = require('./routes/authRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');
const produkRoutes = require('./routes/produkRoutes');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kategori', kategoriRoutes);
app.use('/api/produk', produkRoutes);

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
