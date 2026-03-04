require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "noir_coffee_secret";

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "noir_coffee",
    waitForConnections: true,
    connectionLimit: 10,
});

const authenticate = (req, res, next) => {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Token diperlukan" });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa" }); }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
        return res.status(403).json({ error: "Akses ditolak" });
    next();
};

const optionalAuth = (req, res, next) => {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch { } }
    next();
};

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

(async () => {
    try {
        const [[{ cnt }]] = await pool.query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
        if (cnt === 0) {
            const hash = await bcrypt.hash("admin123", 10);
            await pool.query("INSERT INTO users (name, email, password, role) VALUES (?,?,?,'admin')", ["Admin", "admin@noircoffee.id", hash]);
            console.log("Admin default dibuat: admin@noircoffee.id / admin123");
        }
    } catch (err) { console.error("Seed admin gagal:", err.message); }
})();

// AUTH
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
        if (password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
        const [[existing]] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing) return res.status(400).json({ error: "Email sudah terdaftar" });
        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?,?,?,'user')", [name.trim(), email.trim().toLowerCase(), hash]);
        const [[user]] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [result.insertId]);
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({ user, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email dan password wajib diisi" });
        const [[user]] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
        if (!user) return res.status(401).json({ error: "Email atau password salah" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Email atau password salah" });
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        const { password: _pw, ...safeUser } = user;
        res.json({ user: safeUser, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
        const [[user]] = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
        if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// USER CRUD (admin)
app.get("/api/users", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, name, email, role, created_at FROM users ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/users", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
        if (role && !["guest", "user", "admin"].includes(role)) return res.status(400).json({ error: "Role tidak valid" });
        const [[existing]] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing) return res.status(400).json({ error: "Email sudah terdaftar" });
        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)", [name.trim(), email.trim().toLowerCase(), hash, role || "user"]);
        const [[user]] = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [result.insertId]);
        res.status(201).json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/users/:id", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (role && !["guest", "user", "admin"].includes(role)) return res.status(400).json({ error: "Role tidak valid" });
        const [[ex]] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
        if (!ex) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
        const upd = { name: name?.trim() || ex.name, email: email?.trim().toLowerCase() || ex.email, role: role || ex.role, updated_at: new Date() };
        if (password && password.length >= 6) upd.password = await bcrypt.hash(password, 10);
        const setCols = Object.keys(upd).map(k => `\`${k}\` = ?`).join(", ");
        await pool.query(`UPDATE users SET ${setCols} WHERE id = ?`, [...Object.values(upd), req.params.id]);
        const [[user]] = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.params.id]);
        res.json(user);
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Email sudah dipakai" });
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/users/:id", authenticate, requireRole("admin"), async (req, res) => {
    try {
        if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: "Tidak bisa menghapus akun sendiri" });
        const [[user]] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
        await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CATEGORIES & PRODUCTS (public)
app.get("/api/categories", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM categories ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.is_available = 1 ORDER BY p.category_id, p.id`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ORDERS
app.get("/api/orders", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const [orders] = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
        for (const order of orders) {
            const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/orders/my", authenticate, async (req, res) => {
    try {
        const [orders] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
        for (const order of orders) {
            const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/orders/:orderNumber", async (req, res) => {
    try {
        const [[order]] = await pool.query("SELECT * FROM orders WHERE order_number = ?", [req.params.orderNumber]);
        if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
        const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
        order.items = items;
        res.json(order);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/orders", optionalAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { customer_name, customer_phone, type, table_number, payment_method, notes, items } = req.body;
        if (type === "dine_in" && table_number) {
            const [[tbl]] = await conn.query("SELECT * FROM `tables` WHERE table_number = ? FOR UPDATE", [table_number]);
            if (!tbl) { await conn.rollback(); conn.release(); return res.status(400).json({ error: `Meja ${table_number} tidak ditemukan` }); }
            if (tbl.status === "occupied") { await conn.rollback(); conn.release(); return res.status(409).json({ error: `Meja ${table_number} sedang terpakai oleh pelanggan lain` }); }
        }
        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax = Math.round(subtotal * 0.1);
        const total = subtotal + tax;
        const order_number = await generateOrderNumber();
        const userId = req.user ? req.user.id : null;
        const [result] = await conn.query(
            `INSERT INTO orders (user_id, order_number, customer_name, customer_phone, type, table_number, status, payment_status, payment_method, subtotal, tax, total, notes, created_at, updated_at) VALUES (?,?,?,?,?,?, 'pending','unpaid',?,?,?,?,?, NOW(), NOW())`,
            [userId, order_number, customer_name, customer_phone || null, type, table_number || null, payment_method, subtotal, tax, total, notes || null]
        );
        const orderId = result.insertId;
        for (const item of items) {
            await conn.query(`INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal, created_at, updated_at) VALUES (?,?,?,?,?,?, NOW(), NOW())`, [orderId, item.product_id, item.product_name, item.price, item.quantity, item.price * item.quantity]);
        }
        if (type === "dine_in" && table_number) {
            await conn.query("UPDATE `tables` SET status='occupied', updated_at=NOW() WHERE table_number=?", [table_number]);
        }
        await conn.commit();
        const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ?", [orderId]);
        const [orderItems] = await conn.query("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
        order.items = orderItems;
        res.status(201).json(order);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { conn.release(); }
});

app.patch("/api/orders/:orderNumber/status", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
        if (!valid.includes(status)) return res.status(400).json({ error: "Status tidak valid" });
        const [[existingOrder]] = await pool.query("SELECT * FROM orders WHERE order_number = ?", [req.params.orderNumber]);
        if (!existingOrder) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
        const [result] = await pool.query("UPDATE orders SET status = ?, updated_at = NOW() WHERE order_number = ?", [status, req.params.orderNumber]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
        if (["completed", "cancelled"].includes(status) && existingOrder.type === "dine_in" && existingOrder.table_number) {
            await pool.query("UPDATE `tables` SET status='available', updated_at=NOW() WHERE table_number=?", [existingOrder.table_number]);
        }
        res.json({ success: true, status });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// TABLES
app.get("/api/tables", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM `tables` ORDER BY table_number");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/tables", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { table_number, capacity, location } = req.body;
        if (!table_number) return res.status(400).json({ error: "Nomor meja wajib diisi" });
        const [result] = await pool.query("INSERT INTO `tables` (table_number, capacity, location, status, created_at, updated_at) VALUES (?,?,?,'available',NOW(),NOW())", [table_number.trim().toUpperCase(), capacity || 4, location || null]);
        const [[table]] = await pool.query("SELECT * FROM `tables` WHERE id = ?", [result.insertId]);
        res.status(201).json(table);
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Nomor meja sudah ada" });
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/tables/:id", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const { table_number, capacity, location, status } = req.body;
        if (!table_number) return res.status(400).json({ error: "Nomor meja wajib diisi" });
        if (status && !["available", "occupied"].includes(status)) return res.status(400).json({ error: "Status meja tidak valid" });
        await pool.query("UPDATE `tables` SET table_number=?, capacity=?, location=?, status=?, updated_at=NOW() WHERE id=?", [table_number.trim().toUpperCase(), capacity || 4, location || null, status || "available", req.params.id]);
        const [[table]] = await pool.query("SELECT * FROM `tables` WHERE id = ?", [req.params.id]);
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });
        res.json(table);
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Nomor meja sudah ada" });
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/tables/:id", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const [[table]] = await pool.query("SELECT * FROM `tables` WHERE id = ?", [req.params.id]);
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });
        if (table.status === "occupied") return res.status(400).json({ error: "Tidak bisa menghapus meja yang sedang terpakai" });
        await pool.query("DELETE FROM `tables` WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// STATS (admin)
app.get("/api/stats", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const [[{ total_orders }]] = await pool.query("SELECT COUNT(*) AS total_orders FROM orders WHERE DATE(created_at) = CURDATE()");
        const [[{ revenue }]] = await pool.query("SELECT COALESCE(SUM(total),0) AS revenue FROM orders WHERE status='completed' AND DATE(created_at) = CURDATE()");
        const [[{ active_orders }]] = await pool.query("SELECT COUNT(*) AS active_orders FROM orders WHERE status IN ('pending','confirmed','preparing')");
        const [[{ total_products }]] = await pool.query("SELECT COUNT(*) AS total_products FROM products WHERE is_available = 1");
        const [[{ total_tables }]] = await pool.query("SELECT COUNT(*) AS total_tables FROM `tables`");
        const [[{ occupied_tables }]] = await pool.query("SELECT COUNT(*) AS occupied_tables FROM `tables` WHERE status = 'occupied'");
        const [[{ total_users }]] = await pool.query("SELECT COUNT(*) AS total_users FROM users");
        res.json({ total_orders, revenue, active_orders, total_products, total_tables, occupied_tables, total_users });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// REPORTS (admin)
app.get("/api/reports/sales", authenticate, requireRole("admin"), async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const start = req.query.start_date || today;
        const end = req.query.end_date || today;

        // Summary
        const [[summary]] = await pool.query(`
            SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS total_revenue,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_orders,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_orders,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN total END), 0) AS avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
        `, [start, end]);

        // Daily breakdown
        const [daily] = await pool.query(`
            SELECT
                DATE(created_at) AS date,
                COUNT(*) AS total_orders,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_orders,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS revenue
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `, [start, end]);

        // Top products
        const [topProducts] = await pool.query(`
            SELECT
                oi.product_name,
                SUM(oi.quantity) AS total_qty,
                SUM(oi.subtotal) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status = 'completed'
            GROUP BY oi.product_name
            ORDER BY total_qty DESC
            LIMIT 10
        `, [start, end]);

        // Orders list
        const [ordersList] = await pool.query(`
            SELECT id, order_number, customer_name, type, table_number, status, payment_method,
                   subtotal, tax, total, created_at
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
            ORDER BY created_at DESC
        `, [start, end]);

        res.json({ summary, daily, topProducts, orders: ordersList, period: { start, end } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Noir Coffee API berjalan di http://localhost:${PORT}`); });
