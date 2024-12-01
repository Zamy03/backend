const MidtransClient = require('midtrans-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const snap = new MidtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const createTransaction = async (req, res) => {
    const { id_produk, jumlah, total_harga, id_user } = req.body;

    try {
        const { data: users } = await supabase
            .from('users')
            .select('id, nama, email')
            .eq('id', id_user)
            .single();

        const { data: produk } = await supabase
            .from('produk')
            .select('id, nama, qty, harga')
            .eq('id', id_produk)
            .single();

        if (!produk) return res.status(404).json({ message: 'Produk not found' });
        if (produk.qty < jumlah) return res.status(400).json({ message: 'Not enough stock' });

        const transaction_id = `TX-${nanoid(4)}-TX-${nanoid(8)}`;
        const gross_amount = total_harga;

        const authString = btoa(`${process.env.MIDTRANS_SERVER_KEY}:`);
        const payload = {
            transaction_details: {
                order_id: transaction_id,
                gross_amount
            },
            item_details: [
                {
                    id: produk.id,
                    name: produk.nama,
                    quantity: produk.qty,
                    price: produk.harga,
                }
            ],
            customer_details: {
                name: users.nama,
                email: users.email,
            },
            callbacks: {
                finish: `${process.env.BASE_URL}/payment/finish`,
                error: `${process.env.BASE_URL}/payment/error`,
                pending: `${process.env.BASE_URL}/payment/pending`,
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

        if (!response.status === 201) {
            return res.status(500).json({ message: 'Error creating transaction', data });
        }

        const transaction = {
            transaksi_id,
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

        res.status(201).json({ message: 'Transaction created successfully' 
        , data: { 
            transaction_id,
        id_produk: produk.id,
        nama_produk: produk.nama,
        jumlah,
        gross_amount,
        id_user,
        snap_token: data.token,
        snap_url: data.redirect_url,
        status: 'pending'}
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating transaction', error: error.message });
    }
};

module.exports = { createTransaction };