require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Database Pool ──────────────────────────────────────────────────────────
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "noir_coffee",
    waitForConnections: true,
    connectionLimit: 10,
});

// ─── Helper ─────────────────────────────────────────────────────────────────
const generateOrderNumber = async () => {
    const [[{ count }]] = await pool.query(
        "SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE()"
    );
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `KK${yy}${mm}${dd}${String(count + 1).padStart(3, "0")}`;
};

// ─── GET /api/categories ────────────────────────────────────────────────────
app.get("/api/categories", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM categories ORDER BY id");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/products ──────────────────────────────────────────────────────
app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1
      ORDER BY p.category_id, p.id
    `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/orders ────────────────────────────────────────────────────────
app.get("/api/orders", async (req, res) => {
    try {
        const [orders] = await pool.query(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100"
        );
        // Attach items to each order
        for (const order of orders) {
            const [items] = await pool.query(
                "SELECT * FROM order_items WHERE order_id = ?",
                [order.id]
            );
            order.items = items;
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/orders/:orderNumber ───────────────────────────────────────────
app.get("/api/orders/:orderNumber", async (req, res) => {
    try {
        const [[order]] = await pool.query(
            "SELECT * FROM orders WHERE order_number = ?",
            [req.params.orderNumber]
        );
        if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
        const [items] = await pool.query(
            "SELECT * FROM order_items WHERE order_id = ?",
            [order.id]
        );
        order.items = items;
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/orders ───────────────────────────────────────────────────────
app.post("/api/orders", async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const {
            customer_name,
            customer_phone,
            type,
            table_number,
            payment_method,
            notes,
            items, // [{ product_id, product_name, price, quantity }]
        } = req.body;

        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax = Math.round(subtotal * 0.1);
        const total = subtotal + tax;
        const order_number = await generateOrderNumber();

        const [result] = await conn.query(
            `INSERT INTO orders
        (order_number, customer_name, customer_phone, type, table_number,
         status, payment_status, payment_method, subtotal, tax, total, notes, created_at, updated_at)
       VALUES (?,?,?,?,?, 'pending','unpaid',?,?,?,?,?, NOW(), NOW())`,
            [
                order_number,
                customer_name,
                customer_phone || null,
                type,
                table_number || null,
                payment_method,
                subtotal,
                tax,
                total,
                notes || null,
            ]
        );
        const orderId = result.insertId;

        for (const item of items) {
            await conn.query(
                `INSERT INTO order_items
          (order_id, product_id, product_name, price, quantity, subtotal, created_at, updated_at)
         VALUES (?,?,?,?,?,?, NOW(), NOW())`,
                [
                    orderId,
                    item.product_id,
                    item.product_name,
                    item.price,
                    item.quantity,
                    item.price * item.quantity,
                ]
            );
        }

        await conn.commit();

        const [[order]] = await conn.query(
            "SELECT * FROM orders WHERE id = ?",
            [orderId]
        );
        const [orderItems] = await conn.query(
            "SELECT * FROM order_items WHERE order_id = ?",
            [orderId]
        );
        order.items = orderItems;

        res.status(201).json(order);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ─── PATCH /api/orders/:orderNumber/status ─────────────────────────────────
app.patch("/api/orders/:orderNumber/status", async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: "Status tidak valid" });
        }
        const [result] = await pool.query(
            "UPDATE orders SET status = ?, updated_at = NOW() WHERE order_number = ?",
            [status, req.params.orderNumber]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Pesanan tidak ditemukan" });
        }
        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/stats ─────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
    try {
        const [[{ total_orders }]] = await pool.query(
            "SELECT COUNT(*) AS total_orders FROM orders WHERE DATE(created_at) = CURDATE()"
        );
        const [[{ revenue }]] = await pool.query(
            "SELECT COALESCE(SUM(total),0) AS revenue FROM orders WHERE status='completed' AND DATE(created_at) = CURDATE()"
        );
        const [[{ active_orders }]] = await pool.query(
            "SELECT COUNT(*) AS active_orders FROM orders WHERE status IN ('pending','confirmed','preparing')"
        );
        const [[{ total_products }]] = await pool.query(
            "SELECT COUNT(*) AS total_products FROM products WHERE is_available = 1"
        );
        res.json({ total_orders, revenue, active_orders, total_products });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Noir Coffee API berjalan di http://localhost:${PORT}`);
});
