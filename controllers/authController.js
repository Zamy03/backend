const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sendEmail = require('./../middlewares/nodemailerMiddleware');
const cron = require('node-cron');

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

// const register = async (req, res) => {
//     const { nama, no_hp, email, password } = req.body; // Hilangkan `role` dari input

//     try {
//         // Periksa apakah email sudah digunakan
//         const { data: existingUser } = await supabase
//             .from('users')
//             .select('*')
//             .eq('email', email)
//             .single();

//         if (existingUser) return res.status(400).json({ message: 'Email already registered' });

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Tetapkan `role` sebagai "pelanggan" secara default
//         const role = 'pelanggan';

//         // Simpan data ke tabel users
//         const { error } = await supabase
//             .from('users')
//             .insert([{ nama, no_hp, email, password: hashedPassword, role }]);

//         if (error) throw error;

//         res.status(201).json({ message: 'User registered successfully' });
//     } catch (error) {
//         res.status(500).json({ message: 'Error registering user', error: error.message });
//     }
// };

const register = async (req, res) => {
    const { nama, no_hp, email, password } = req.body;

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

        // Generate OTP
        let otp = crypto.randomInt(100000, 999999); // Generate 6 digit OTP
        let otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // OTP valid for 2 minutes

        // ✅ SPECIAL CASE: fixed OTP untuk email tertentu
        if (email === 'gomutzy@gmail.com') {
            otp = 123456; // fixed
            otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // biar tidak cepat expired
        }

        // Simpan data ke tabel users
        const { error } = await supabase
            .from('users')
            .insert([{ 
                nama, 
                no_hp, 
                email, 
                password: hashedPassword, 
                role: 'pelanggan', 
                verifikasi: 'pending', // Default status
                otp, 
                expired_time: otpExpiry
            }]);

        if (error) throw error;

        // Kirim OTP ke email
        const emailResponse = await sendEmail({
            to: email,
            subject: 'OTP Verification',
            text: `Your OTP for registration is ${otp}. This OTP is valid for 2 minutes.`,
            html: `<p>Your OTP for registration is <strong>${otp}</strong>.</p><p>This OTP is valid for 2 minutes.</p>`,
        });

        if (!emailResponse.success) {
            return res.status(500).json({ message: 'Failed to send OTP email', error: emailResponse.error });
        }

        res.status(201).json({ message: 'User registered successfully. Please verify your email with the OTP sent.' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Cari user berdasarkan email
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Periksa apakah OTP cocok dan masih berlaku
        if (user.otp !== parseInt(otp)) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        // Update status verifikasi menjadi true dan hapus OTP
        const { error: updateError } = await supabase
            .from('users')
            .update({ verifikasi: true, otp: null, expired_time: null })
            .eq('email', email);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'User verified successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying OTP', error: error.message });
    }
};

// Jalankan setiap 1 menit
cron.schedule('*/1 * * * *', async () => {
    try {
        // Periksa user dengan OTP yang sudah kadaluarsa dan belum diverifikasi
        const { data: expiredUsers, error } = await supabase
            .from('users')
            .select('*')
            .lte('expired_time', new Date())
            .eq('verifikasi', 'pending');

        if (error || !expiredUsers || expiredUsers.length === 0) return;

        // Update status menjadi denied
        for (const user of expiredUsers) {
            await supabase
                .from('users')
                .update({ verifikasi: 'denied', otp: null, expired_time: null })
                .eq('email', user.email);
        }

        console.log('Updated verification status for expired OTPs');
    } catch (error) {
        console.error('Error updating expired OTPs:', error.message);
    }
});

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
            { id_user: user.id_user, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '18h' }
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
                    no_hp: '-',         
                    email: data.email,  // Email dari Google
                    password: '',       // bisa memberikan password default jika perlu
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
            { id_user: existingUser.id_user, role: existingUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '18h' }
        );

         // Redirect ke frontend dengan token di query string
         const frontendUrl = `https://proyek-3-proyek.github.io/tokline.github.io/index.html?token=${token}`;
         res.redirect(frontendUrl);

    } catch (error) {
        res.status(500).json({ message: 'Error logging in with Google', error: error.message });
    }
};

const requestResetPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // Cari user berdasarkan email
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate OTP (6 digit angka) dan masa berlaku OTP
        const otp = crypto.randomInt(100000, 999999);
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 menit dari sekarang

        // Simpan OTP dan masa berlaku di database
        const { error: updateError } = await supabase
            .from("users")
            .update({ otp, expired_time: otpExpiry })
            .eq("email", email);

        if (updateError) throw updateError;

        // Kirim OTP ke email pengguna
        const emailSent = await sendEmail({
            to: email,
            subject: "Reset Password OTP",
            text: `Your OTP for resetting password is: ${otp}`,
            html: `<p>Your OTP for resetting password is: <strong>${otp}</strong>. It is valid for 2 minutes.</p>`,
        });

        if (!emailSent.success) {
            return res.status(500).json({ message: "Failed to send OTP email", error: emailSent.error });
        }

        res.status(200).json({ message: "OTP sent to email successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error requesting reset password", error: error.message });
    }
};

const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        // Cari user berdasarkan email
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password dan hapus OTP
        const { error: updateError } = await supabase
            .from("users")
            .update({
                password: hashedPassword,
                otp: null,
                expired_time: null,
            })
            .eq("email", email);

        if (updateError) throw updateError;

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
};

module.exports = { register, verifyOtp, login, googleAuth, googleCallback, requestResetPassword, resetPassword };
