const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// **GET Semua Kategori**
const getAllKategori = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('kategori')
            .select('*');

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching kategori', error: error.message });
    }
};

// **GET Kategori Berdasarkan ID**
const getKategoriById = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('kategori')
            .select('*')
            .eq('id_kategori', id)
            .single();

        if (error) throw error;

        if (!data) return res.status(404).json({ message: 'Kategori not found' });

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching kategori by ID', error: error.message });
    }
};

// **POST Kategori Baru**
const createKategori = async (req, res) => {
    const { jenis_kategori } = req.body;

    if (!jenis_kategori) {
        return res.status(400).json({ message: 'jenis_kategori is required' });
    }

    try {
        const { data, error } = await supabase
            .from('kategori')
            .insert([{ jenis_kategori }]);

        if (error) throw error;

        res.status(201).json({ message: 'Kategori created successfully'});
    } catch (error) {
        res.status(500).json({ message: 'Error creating kategori', error: error.message });
    }
};

// **PUT Update Kategori**
const updateKategori = async (req, res) => {
    const { id } = req.params;
    const { jenis_kategori } = req.body;

    if (!jenis_kategori) {
        return res.status(400).json({ message: 'jenis_kategori is required' });
    }

    try {
        const { data, error } = await supabase
            .from('kategori')
            .update({ jenis_kategori })
            .eq('id_kategori', id)
            .select()

        if (error) throw error;

        if (!data.length) return res.status(404).json({ message: 'Kategori not found' });

        res.status(200).json({ message: 'Kategori updated successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error updating kategori', error: error.message });
    }
};

// **DELETE Kategori**
const deleteKategori = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('kategori')
            .delete()
            .eq('id_kategori', id)
            .select()

        if (error) throw error;

        res.status(200).json({ message: 'Kategori deleted successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting kategori', error: error.message });
    }
};

module.exports = { getAllKategori, getKategoriById, createKategori, updateKategori, deleteKategori };
