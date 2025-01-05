const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// **GET Semua Produk**
const getAllProduk = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('produk')
            .select(`
                id_produk,
                nama,
                deskripsi,
                kategori:kategori(jenis_kategori),
                gambar,
                qty,
                harga
            `);

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching produk', error: error.message });
    }
};


// **GET Produk Berdasarkan ID**
const getProdukById = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('produk')
            .select('id_produk, nama, deskripsi, kategori:kategori(jenis_kategori), gambar, qty, harga')
            .eq('id_produk', id)
            .single();

        if (error) throw error;

        if (!data) return res.status(404).json({ message: 'Produk not found' });

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching produk by ID', error: error.message });
    }
};

// **GET Produk Berdasarkan Kategori ID**
const getProdukByKategori = async (req, res) => {
    const { id } = req.params; 
    try {
        const { data, error } = await supabase
            .from('produk')
            .select(`id_produk, nama, deskripsi, kategori:kategori(jenis_kategori), gambar, qty, harga`)
            .eq('id_kategori', id); 
            

        if (error) throw error;

        if (!data.length) {
            return res.status(404).json({ message: 'Produk not found' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ message: 'Error fetching produk by kategori', error: error.message });
    }
};

// **POST Produk Baru**
const createProduk = async (req, res) => {
    const { nama, deskripsi, nama_kategori, qty, harga } = req.body;
    const file = req.file; // Ambil file dari Multer

    if (!nama || !deskripsi || !nama_kategori || !file || !qty || !harga) {
        return res.status(400).json({ message: 'All fields and file are required' });
    }

    try {
        // Cari ID kategori berdasarkan nama_kategori
        const { data: kategori, error: kategoriError } = await supabase
            .from('kategori')
            .select(`id_kategori,
                jenis_kategori`)
            .eq('jenis_kategori', nama_kategori)
            .single();
        if (kategoriError || !kategori) {
            return res.status(404).json({ message: 'Kategori not found' });
        }

        // Upload gambar ke Supabase Storage
        const fileName = `${uuidv4()}-${file.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('gambar') // Gunakan nama bucket "gambar"
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true, // Tambahkan jika perlu overwrite file dengan nama yang sama
            });

        if (uploadError) {
            throw new Error(`Error uploading file: ${uploadError.message}`);
        }

        // Tambahkan produk dengan nama file gambar
        const { data, error } = await supabase
            .from('produk')
            .insert([{ nama, deskripsi, id_kategori: kategori.id_kategori, gambar: fileName, qty, harga }])
            .select();

        if (error) throw error;

        res.status(201).json({ message: 'Produk created successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error creating produk', error: error.message });
    }
};

// **UPDATE Produk**
const updateProduk = async (req, res) => {
    const { id } = req.params;
    const { nama, deskripsi, nama_kategori, qty, harga } = req.body;
    const file = req.file; // Ambil file dari multer

    if (!nama || !deskripsi || !nama_kategori || !file || !qty || !harga) {
        return res.status(400).json({ message: 'All fields (nama, deskripsi, nama_kategori) are required' });
    }

    try {
        // Cari ID kategori berdasarkan nama_kategori
        const { data: kategori, error: kategoriError } = await supabase
            .from('kategori')
            .select('id_kategori')
            .eq('jenis_kategori', nama_kategori)
            .single();

        if (kategoriError || !kategori) {
            return res.status(404).json({ message: 'Kategori not found' });
        }

        let gambarFileName;

        if (file) {
            // Hapus gambar lama jika ada
            const { data: existingProduk, error: fetchError } = await supabase
                .from('produk')
                .select('gambar')
                .eq('id_produk', id)
                .single();

            if (fetchError || !existingProduk) {
                return res.status(404).json({ message: 'Produk not found' });
            }

            if (existingProduk.gambar) {
                await supabase.storage
                    .from('gambar') 
                    .remove([existingProduk.gambar]);
            }

            // Upload gambar baru ke Supabase Storage
            gambarFileName = `${uuidv4()}-${file.originalname}`;
            const { error: uploadError } = await supabase.storage
                .from('gambar') 
                .upload(gambarFileName, file.buffer, {
                    contentType: file.mimetype,
                });

            if (uploadError) {
                throw new Error('Error uploading new file to storage');
            }
        }

        // Update produk di database
        const { data, error } = await supabase
            .from('produk')
            .update({
                nama,
                deskripsi,
                id_kategori: kategori.id_kategori,
                ...(gambarFileName && { gambar: gambarFileName }),
                qty,
                harga,
            })
            .eq('id_produk', id)
            .select('id_produk, nama, deskripsi, kategori:kategori(jenis_kategori), gambar, qty, harga');

        if (error) throw error;

        if (!data.length) return res.status(404).json({ message: 'Produk not found' });

        res.status(200).json({ message: 'Produk updated successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error updating produk', error: error.message });
    }
};

// **DELETE Produk**
const deleteProduk = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('produk')
            .delete()
            .eq('id_produk', id)
            .select();

        if (error) throw error;

        if (!data.length) return res.status(404).json({ message: 'Produk not found' });

        res.status(200).json({ message: 'Produk deleted successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting produk', error: error.message });
    }
};

module.exports = { getAllProduk, getProdukById, getProdukByKategori,createProduk, updateProduk, deleteProduk };