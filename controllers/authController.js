const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const google = require('googleapis').google;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const OAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://backend-eight-phi-75.vercel.app/api/auth/google/callback'
);

const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

const authorizationUrl = OAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
});

const register = async (req, res) => {
    const { nama, no_hp, email, password } = req.body; // Hilangkan `role` dari input

    try {
        // Periksa apakah email sudah digunakan
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) return res.status(400).json({ message: 'Email already registered' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tetapkan `role` sebagai "pelanggan" secara default
        const role = 'pelanggan';

        // Simpan data ke tabel users
        const { error } = await supabase
            .from('users')
            .insert([{ nama, no_hp, email, password: hashedPassword, role }]);

        if (error) throw error;

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Cari user berdasarkan email
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) return res.status(400).json({ message: 'Invalid email or password' });

        // Verifikasi password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid email or password' });

        // Generate token JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login successful', token });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

const googleAuth = (req, res) => {
    res.redirect(authorizationUrl);
};

const googleCallback = async (req, res) => {
    const { code } = req.query;

    try {
        // Dapatkan token dari Google menggunakan kode yang diterima
        const { tokens } = await OAuth2Client.getToken(code);
        OAuth2Client.setCredentials(tokens);

        // Ambil data user dari Google
        const oauth2 = google.oauth2({ version: 'v2', auth: OAuth2Client });
        const { data } = await oauth2.userinfo.get();

        if (!data) {
            return res.status(500).json({ message: 'Error fetching user data from Google' });
        }

        // Cek apakah pengguna sudah ada di Supabase
        let { data: existingUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', data.email)
            .single();

        // Jika tidak ada, buat pengguna baru
        if (!existingUser) {
            const { error: insertError } = await supabase
                .from('users')
                .insert([{
                    nama: data.name,    // Nama pengguna dari Google
                    no_hp: '-',         // Anda bisa mengubah ini untuk meminta no_hp di saat login atau registrasi
                    email: data.email,  // Email dari Google
                    password: '',       // Anda bisa memberikan password default jika perlu
                    role: 'pelanggan'   // Tentukan role default
                }]);

            if (insertError) {
                return res.status(500).json({ message: 'Error creating new user', error: insertError.message });
            }

            // Ambil user yang baru dimasukkan
            const { data: newUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', data.email)
                .single();

            existingUser = newUser;
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: existingUser.id, role: existingUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '18h' }
        );

        // Kembalikan token ke pengguna
        res.json({ message: 'Login successful', token });
        res.redirect('https://proyek-3-proyek.github.io/tokline.github.io/index.html');

    } catch (error) {
        res.status(500).json({ message: 'Error logging in with Google', error: error.message });
    }
};


module.exports = { register, login, googleAuth, googleCallback };
