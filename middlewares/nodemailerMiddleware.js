const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail', // Ganti dengan layanan email lain jika bukan Gmail
    auth: {
        user: process.env.EMAIL_USER, // Email pengirim
        pass: process.env.EMAIL_PASS  // App Password
    }
});

// Middleware untuk mengirim email
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = sendEmail;
