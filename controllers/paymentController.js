const MidtransClient = require('midtrans-client');
const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const snap = new MidtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const createTransaction = async (req, res) => {
    const { id_produk, jumlah, total_harga } = req.body;
    const id_user = req.user.id; // ID user dari token JWT

    try {
        const { data: users } = await supabase
            .from('users')
            .select('id, nama, email')
            .eq('id', id_user)
            .single();

        if (!users) return res.status(404).json({ message: 'User not found' });

        const { data: produk } = await supabase
            .from('produk')
            .select('id, nama, qty, harga')
            .eq('id', id_produk)
            .single();

        if (!produk) return res.status(404).json({ message: 'Product not found' });
        if (produk.qty < jumlah) return res.status(400).json({ message: 'Not enough stock' });

        const transaction_id = `TX-${nanoid(4)}-TX-${nanoid(8)}`;
        const gross_amount = total_harga;

        const authString = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');
        const payload = {
            transaction_details: {
                order_id: transaction_id,
                gross_amount
            },
            item_details: [
                {
                    id: produk.id,
                    name: produk.nama,
                    quantity: jumlah,
                    price: produk.harga,
                }
            ],
            customer_details: {
                name: users.nama,
                email: users.email,
            }
        };

        const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Basic ${authString}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.status !== 201) {
            return res.status(500).json({ message: 'Error creating transaction', data });
        }

        const transaction = {
            transaksi_id: transaction_id,
            id_produk: produk.id,
            nama_produk: produk.nama,
            jumlah,
            gross_amount,
            id_user,
            snap_token: data.token,
            snap_url: data.redirect_url,
            status: 'pending'
        };

        const { error } = await supabase
            .from('transactions')
            .insert([transaction]);

        if (error) throw error;

        // Update stok produk
        const { error: updateError } = await supabase
            .from('produk')
            .update({ qty: produk.qty - jumlah })
            .eq('id', produk.id);

        if (updateError) throw updateError;

        res.status(201).json({
            message: 'Transaction created successfully',
            data: {
                transaction_id,
                id_produk: produk.id,
                nama_produk: produk.nama,
                jumlah,
                gross_amount,
                id_user,
                snap_token: data.token,
                snap_url: data.redirect_url,
                status: 'pending'
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating transaction', error: error.message });
    }
};

module.exports = { createTransaction };
