const MidtransClient = require('midtrans-client');
const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const snap = new MidtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// const updateStatusBasedOnMidtrans = async (transaction_id, data) => {
//     const hash = crypto.createHash('sha512').update(`${data.order_id}${data.status_code}${data.gross_amount}${data.payment_type}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');

//     if (data.signature_key !== hash) {
//         return {
//             status: 'error',
//             message: 'Invalid signature key'
//         }
//     }

//     let responseData = null;
//     let transactionStatus = data.transaction_status;
//     let fraudStatus = data.fraud_status;

//     if (transactionStatus === 'capture') {
//         if (fraudStatus === 'accept') {
//             const transaction = await transactionService.UpdateTransactionStatus(transaction_id, status : 'success');
//         }
//     }else if (transactionStatus === 'settlement') {
//     } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
//     }else if (transactionStatus === 'pending') {
//     }
// }
const createTransaction = async (req, res) => {
    const { id_produk, jumlah, total_harga } = req.body;
    const id_user = req.user.id; // ID user dari token JWT

    try {
        const { data: user } = await supabase
            .from('users')
            .select('id_user, nama, no_hp, email')
            .eq('id_user', id_user)
            .single();

        if (!user) return res.status(404).json({ message: 'User not found' });

        const { data: produk } = await supabase
            .from('produk')
            .select('id_produk, nama, qty, harga')
            .eq('id_produk', id_produk)
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
                    id: produk.id_produk,
                    name: produk.nama,
                    quantity: jumlah,
                    price: produk.harga,
                }
            ],
            customer_details: {
                first_name: user.nama,
                phone: user.no_hp ? user.no_hp.replace(/^0/, "+62") : "-", // Ubah 0 menjadi +62,
                email: user.email,
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
            id_produk: produk.id_produk,
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

        console.log("User Data:", user);
        console.log("Payload to Midtrans:", payload);

        if (error) throw error;

        // Update stok produk
        const { error: updateError } = await supabase
            .from('produk')
            .update({ qty: produk.qty - jumlah })
            .eq('id_produk', produk.id_produk);

        if (updateError) throw updateError;

        res.status(201).json({
            message: 'Transaction created successfully',
            data: {
                transaction_id,
                id_produk: produk.id_produk,
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

// Fungsi untuk menangani notifikasi pembayaran
async function handlePaymentNotification(req, res) {
    try {
      const notification = req.body;
  
      // Verifikasi notifikasi dari Midtrans
      const transactionStatus = notification.transaction_status;
      const transaksiId = notification.order_id; // Ganti dari order_id ke transaksi_id
  
      console.log("Notifikasi diterima untuk Transaksi ID:", transaksiId);
      console.log("Status Transaksi:", transactionStatus);
  
      // Tentukan status baru
      let newStatus = "";
      if (transactionStatus === "settlement" || transactionStatus === "capture") {
        newStatus = "paid"; // Pembayaran berhasil
      } else if (transactionStatus === "pending") {
        newStatus = "pending"; // Menunggu pembayaran
      } else if (
        transactionStatus === "cancel" ||
        transactionStatus === "deny" ||
        transactionStatus === "expire"
      ) {
        newStatus = "failed"; // Pembayaran gagal
      }
  
      if (newStatus) {
        // Update status di tabel transaction Supabase
        const { data, error } = await supabase
          .from("transactions") // Nama tabel diubah dari transactions ke transaction
          .update({ status: newStatus })
          .eq("transaksi_id", transaksiId); // Ganti dari order_id ke transaksi_id
  
        if (error) {
          console.error("Gagal mengupdate status di Supabase:", error);
          return res.status(500).json({ message: "Gagal mengupdate status transaksi." });
        }
  
        console.log("Status transaksi berhasil diperbarui di Supabase:", data);
        return res.status(200).json({ message: "Notifikasi diterima dan diproses." });
      } else {
        return res.status(400).json({ message: "Status transaksi tidak dikenali." });
      }
    } catch (error) {
      console.error("Error memproses notifikasi:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  // Get all transactions
  const getAllTransactions = async (req, res) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*');
  
    if (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ message: "Error fetching transactions." });
    }
  
    return res.status(200).json(data);
  }

  // Get transaction by user ID
  const getTransactionByUserId = async (req, res) => {
    const { id } = req.params;
  
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id_user', id);
  
    if (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ message: "Error fetching transactions." });
    }
  
    return res.status(200).json(data);
  }
  
// const transactionCallback = async (req, res) => {
//     const { transaction_id } = req.params;

//     transactionService.getTransactionById(transaction_id)
//         .then((transaction) => {
//             if(transaction){

//             }

//             if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

//             const { status } = req.body;
//             const { id_produk, jumlah } = transaction;

//             if (status === 'capture') {
            
//             } else if (status === 'settlement') {
                
//             }
//         });

//     res.status(200).json({ status: 'Success', 
//         message: 'OK' 
//     });
// }

module.exports = { createTransaction, handlePaymentNotification, getAllTransactions, getTransactionByUserId };
