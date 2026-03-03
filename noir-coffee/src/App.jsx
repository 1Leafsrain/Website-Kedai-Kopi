import { useState, useEffect } from "react";

const rp = (n) => "Rp " + Number(n).toLocaleString("id-ID");

const CAT_ICONS = { kopi: "☕", "non-kopi": "🧋", minuman: "🥤", makanan: "🍽️", dessert: "🍰", camilan: "🫙", snack: "🫙", paket: "📦", teh: "🫖" };
const getCatIcon = (slug) => CAT_ICONS[(slug || "").toLowerCase()] || "◉";

// --- Grain SVG background ---
const GrainBg = () => (
  <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 999, opacity: 0.35 }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" opacity="0.08" />
  </svg>
);

// --- Pages ---
const PAGES = { MENU: "menu", CART: "cart", CHECKOUT: "checkout", CONFIRM: "confirm", TRACK: "track", ADMIN: "admin" };

export default function App() {
  const [page, setPage] = useState(PAGES.MENU);
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", type: "dine_in", table: "", payment: "cash", notes: "" });
  const [mounted, setMounted] = useState(false);

  // ─── API State ───────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [stats, setStats] = useState({ total_orders: 0, revenue: 0, active_orders: 0, total_products: 0, total_tables: 0, occupied_tables: 0 });
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [adminView, setAdminView] = useState("dashboard");

  // ─── Tables State ───────────────────────────────────────────────
  const [tables, setTables] = useState([]);
  const [tableForm, setTableForm] = useState({ table_number: "", capacity: 4, location: "" });
  const [editingTable, setEditingTable] = useState(null);
  const [tableFormOpen, setTableFormOpen] = useState(false);
  const [tableFormError, setTableFormError] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories([{ id: "all", name: "Semua", slug: "all" }, ...data]);
    } catch { setCategories([{ id: "all", name: "Semua", slug: "all" }]); }
  };

  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setMenu(data);
    } catch { setMenu([]); }
    finally { setLoadingMenu(false); }
  };

  const fetchTables = async () => {
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch { setTables([]); }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { setOrders([]); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch { /* keep defaults */ }
  };

  useEffect(() => {
    setMounted(true);
    fetchCategories();
    fetchMenu();
    fetchOrders();
    fetchStats();
    fetchTables();
  }, []);

  useEffect(() => {
    if (page === "admin") { fetchOrders(); fetchStats(); fetchTables(); setAdminView("dashboard"); }
  }, [page]);

  // Poll tables every 10s to keep status fresh
  useEffect(() => {
    const id = setInterval(fetchTables, 10000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    showToast(`${item.name} ditambahkan`);
    setCartOpen(true);
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0);
      return updated;
    });
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  const updateOrderStatus = async (orderNumber, status) => {
    try {
      await fetch(`/api/orders/${orderNumber}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setOrders(prev => prev.map(o => o.order_number === orderNumber ? { ...o, status } : o));
      fetchStats();
      if (["completed", "cancelled"].includes(status)) fetchTables();
    } catch { showToast("Gagal mengubah status"); }
  };

  const trackOrder = async () => {
    if (!trackInput.trim()) return;
    try {
      const res = await fetch(`/api/orders/${trackInput.trim()}`);
      if (res.status === 404) { setTrackResult("notfound"); return; }
      if (!res.ok) throw new Error();
      setTrackResult(await res.json());
    } catch { setTrackResult("notfound"); }
  };

  // ─── Table CRUD ────────────────────────────────────────────────────
  const openAddTable = () => {
    setEditingTable(null);
    setTableForm({ table_number: "", capacity: 4, location: "" });
    setTableFormError("");
    setTableFormOpen(true);
  };
  const openEditTable = (t) => {
    setEditingTable(t);
    setTableForm({ table_number: t.table_number, capacity: t.capacity, location: t.location || "" });
    setTableFormError("");
    setTableFormOpen(true);
  };
  const saveTable = async () => {
    if (!tableForm.table_number.trim()) return setTableFormError("Nomor meja wajib diisi");
    setTableFormError("");
    try {
      const method = editingTable ? "PUT" : "POST";
      const url = editingTable ? `/api/tables/${editingTable.id}` : "/api/tables";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tableForm, capacity: Number(tableForm.capacity) }),
      });
      const data = await res.json();
      if (!res.ok) return setTableFormError(data.error || "Gagal menyimpan meja");
      setTableFormOpen(false);
      fetchTables();
      fetchStats();
      showToast(editingTable ? "Meja diperbarui" : "Meja ditambahkan");
    } catch { setTableFormError("Gagal menyimpan meja"); }
  };
  const deleteTable = async (id) => {
    if (!window.confirm("Hapus meja ini?")) return;
    try {
      const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Gagal menghapus meja");
      fetchTables();
      fetchStats();
      showToast("Meja dihapus");
    } catch { showToast("Gagal menghapus meja"); }
  };
  const releaseTable = async (tableNumber) => {
    try {
      const tbl = tables.find(t => t.table_number === tableNumber);
      if (!tbl) return;
      await fetch(`/api/tables/${tbl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: tbl.table_number, capacity: tbl.capacity, location: tbl.location, status: "available" }),
      });
      fetchTables();
      showToast(`Meja ${tableNumber} dibebaskan`);
    } catch { showToast("Gagal membebaskan meja"); }
  };

  const submitOrder = async () => {
    if (!form.name.trim()) return showToast("Nama harus diisi!");
    if (form.type === "dine_in" && !form.table) return showToast("Pilih nomor meja terlebih dahulu!");
    try {
      const body = {
        customer_name: form.name,
        customer_phone: form.phone || null,
        type: form.type,
        table_number: form.type === "dine_in" ? form.table : null,
        payment_method: form.payment,
        notes: form.notes || null,
        items: cart.map(i => ({ product_id: i.id, product_name: i.name, price: Number(i.price), quantity: i.qty })),
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Refresh tables if table was occupied by another customer
        if (res.status === 409) { fetchTables(); setForm(f => ({ ...f, table: "" })); }
        throw new Error(data.error || "Gagal membuat pesanan");
      }
      setOrders(prev => [data, ...prev]);
      setLastOrder(data);
      setCart([]);
      setForm({ name: "", phone: "", type: "dine_in", table: "", payment: "cash", notes: "" });
      fetchTables();
      setPage(PAGES.CONFIRM);
    } catch (err) { showToast(err.message); }
  };

  const filteredMenu = activeCat === "all" ? menu : menu.filter(m => m.category_slug === activeCat);
  const featured = menu.filter(m => m.is_featured === 1);

  const statusLabel = { pending: "Menunggu", confirmed: "Dikonfirmasi", preparing: "Diproses", ready: "Siap Diambil", completed: "Selesai", cancelled: "Dibatalkan" };
  const statusColor = { pending: "#c8a96e", confirmed: "#88cc88", preparing: "#ccaa44", ready: "#60dd60", completed: "#8a8a7e", cancelled: "#c05050" };

  if (!mounted) return null;

  return (
    <div style={{ fontFamily: "'Inconsolata', monospace", background: "#0a0a08", color: "#f0ede6", minHeight: "100vh", width: "100%", position: "relative", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a08; }
        ::-webkit-scrollbar-thumb { background: #2a2a24; }
        button { cursor: pointer; font-family: inherit; }
        input, select, textarea { font-family: inherit; }
        .serif { font-family: 'Cormorant Garamond', serif !important; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateY(20px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        .fade-in { animation: fadeIn .5s ease forwards; }
        .card-hover { transition: background .25s; }
        .card-hover:hover { background: #1a1a16 !important; }
        .btn-gold { background:#c8a96e; color:#0a0a08; border:none; padding:.65rem 1.5rem; font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; transition: background .2s; }
        .btn-gold:hover { background:#a08a52; }
        .btn-outline { background:transparent; border:1px solid rgba(200,169,110,.4); color:#c8a96e; padding:.65rem 1.5rem; font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; transition: all .2s; }
        .btn-outline:hover { background:rgba(200,169,110,.1); }
        .input-noir { width:100%; background:#1a1a16; border:1px solid rgba(138,138,126,.2); color:#f0ede6; padding:.7rem 1rem; font-size:.9rem; outline:none; transition: border-color .2s; }
        .input-noir:focus { border-color:#c8a96e; }
        .input-noir::placeholder { color:#4a4a42; }
        .card-lift { transition: transform .3s ease, background .25s !important; }
        .card-lift:hover { transform: translateY(-5px); background: #111110 !important; }
        .cat-icon { width:34px; height:34px; border-radius:50%; background:rgba(200,169,110,.07); border:1px solid rgba(200,169,110,.14); display:inline-flex; align-items:center; justify-content:center; font-size:.95rem; flex-shrink:0; }
        .tag-cat { display:inline-block; background:rgba(200,169,110,.06); color:#c8a96e; border:1px solid rgba(200,169,110,.18); padding:.15rem .55rem; font-size:.58rem; letter-spacing:.15em; text-transform:uppercase; }
        .stat-card { transition: transform .2s, border-color .2s; border:1px solid transparent !important; }
        .stat-card:hover { transform:translateY(-3px); border-color:rgba(200,169,110,.2) !important; }
        .menu-item-accent { border-left:2px solid rgba(200,169,110,.15); transition: border-color .25s; }
        .menu-item-accent:hover { border-left-color:#c8a96e !important; }
        @media (max-width:900px) {
          .admin-layout { grid-template-columns:1fr !important; min-height:auto !important; }
          .admin-sidebar { flex-direction:row !important; padding:.75rem 1rem !important; border-right:none !important; border-bottom:1px solid rgba(138,138,126,.1) !important; }
          .stats-4 { grid-template-columns:repeat(2,1fr) !important; }
          .footer-cols { grid-template-columns:1fr 1fr !important; }
        }
        @media (max-width:768px) {
          .featured-grid { grid-template-columns:1fr 1fr !important; }
          .menu-grid { grid-template-columns:1fr !important; }
          .hero-deco { display:none !important; }
          .hero-content { padding:4rem 1.5rem 3rem !important; }
          .hero-title { font-size:clamp(2.4rem,9vw,3.8rem) !important; }
          .section-pad { padding:4rem 1.5rem !important; }
          .stats-strip { grid-template-columns:repeat(2,1fr) !important; }
          .footer-cols { grid-template-columns:1fr !important; }
          .checkout-wrap { padding:6rem 1.25rem 3rem !important; }
          .checkout-grid { grid-template-columns:1fr !important; }
          .cart-panel { width:100vw !important; max-width:100vw !important; }
          .nav-links { gap:1.2rem !important; }
        }
        @media (max-width:480px) {
          .featured-grid { grid-template-columns:1fr !important; }
          .stats-4 { grid-template-columns:1fr 1fr !important; }
          .stats-strip { grid-template-columns:1fr 1fr !important; }
        }
      `}</style>

      <GrainBg />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", background: "#1a1a16", border: "1px solid rgba(200,169,110,.3)", color: "#c8a96e", padding: ".7rem 1.5rem", fontSize: ".8rem", letterSpacing: ".1em", zIndex: 9999, animation: "toastIn .3s ease", whiteSpace: "nowrap" }}>
          ✓ {toast}
        </div>
      )}

      {/* Navbar */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "1.1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(200,169,110,.12)", background: "rgba(10,10,8,.92)", backdropFilter: "blur(12px)" }}>
        <button onClick={() => setPage(PAGES.MENU)} style={{ background: "none", border: "none", color: "#f0ede6", fontSize: "1.2rem", letterSpacing: ".25em", textTransform: "uppercase", fontFamily: "'Cormorant Garamond',serif", cursor: "pointer" }}>
          Noir <span style={{ color: "#c8a96e" }}>●</span> Coffee
        </button>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {[{ label: "Menu", p: PAGES.MENU }, { label: "Lacak", p: PAGES.TRACK }, { label: "Admin", p: PAGES.ADMIN }].map(({ label, p }) => (
            <button key={p} onClick={() => setPage(p)} style={{ background: "none", border: "none", color: page === p ? "#c8a96e" : "#8a8a7e", fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", transition: "color .2s" }}>
              {label}
            </button>
          ))}
          <button onClick={() => setCartOpen(true)} style={{ background: "none", border: "1px solid rgba(200,169,110,.35)", color: "#c8a96e", padding: ".45rem 1rem", display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", transition: "all .2s" }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(200,169,110,.1)"}
            onMouseOut={e => e.currentTarget.style.background = "none"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" /></svg>
            Keranjang
            {cartCount > 0 && <span style={{ background: "#c8a96e", color: "#0a0a08", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".65rem", fontWeight: 500 }}>{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* Cart Sidebar */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div onClick={() => setCartOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
          <div style={{ position: "absolute", top: 0, right: 0, width: 400, height: "100vh", background: "#1a1a16", borderLeft: "1px solid rgba(200,169,110,.15)", display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.25,.46,.45,.94)" }} className="cart-panel">
            <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid rgba(138,138,126,.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="serif" style={{ fontSize: "1.1rem", letterSpacing: ".05em" }}>Keranjang</span>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: "#8a8a7e", fontSize: "1.5rem", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "#4a4a42" }}>
                  <div style={{ fontSize: "2.5rem", opacity: .3, marginBottom: "1rem" }}>◉</div>
                  <p style={{ fontSize: ".85rem" }}>Keranjang kosong</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ display: "flex", gap: "1rem", padding: "1rem 0", borderBottom: "1px solid rgba(138,138,126,.08)", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div className="serif" style={{ fontSize: "1rem" }}>{item.name}</div>
                    <div style={{ color: "#c8a96e", fontSize: ".8rem", marginTop: ".2rem" }}>{rp(item.price)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginTop: ".5rem" }}>
                      {["−", item.qty, "+"].map((v, i) => i === 1 ? (
                        <span key={i} style={{ fontSize: ".85rem", minWidth: 20, textAlign: "center" }}>{v}</span>
                      ) : (
                        <button key={i} onClick={() => updateQty(item.id, i === 0 ? -1 : 1)} style={{ width: 24, height: 24, background: "none", border: "1px solid rgba(138,138,126,.3)", color: "#f0ede6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", transition: "border-color .2s" }}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="serif" style={{ color: "#c8a96e" }}>{rp(item.price * item.qty)}</div>
                    <button onClick={() => updateQty(item.id, -item.qty)} style={{ background: "none", border: "none", color: "#4a4a42", fontSize: ".8rem", marginTop: ".5rem", transition: "color .2s" }}
                      onMouseOver={e => e.currentTarget.style.color = "#c05050"} onMouseOut={e => e.currentTarget.style.color = "#4a4a42"}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: "1.5rem 2rem", borderTop: "1px solid rgba(138,138,126,.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <span style={{ fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e" }}>Total (incl. pajak 10%)</span>
                  <span className="serif" style={{ fontSize: "1.4rem", color: "#c8a96e" }}>{rp(total)}</span>
                </div>
                <button className="btn-gold" style={{ width: "100%", textAlign: "center" }} onClick={() => { setCartOpen(false); setPage(PAGES.CHECKOUT); }}>
                  Lanjut Pesan →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================== MENU PAGE ======================== */}
      {page === PAGES.MENU && (
        <div style={{ paddingTop: "4.5rem" }}>
          {/* Hero */}
          <div style={{ minHeight: "75vh", display: "flex", alignItems: "flex-end", padding: "5rem 3rem 4rem", position: "relative", overflow: "hidden" }} className="hero-content">
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 65% 50%, rgba(200,169,110,.07) 0%, transparent 60%)" }} />
            {/* Decorative rings */}
            <div className="hero-deco" style={{ position: "absolute", right: "5%", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
              <div style={{ width: 360, height: 360, border: "1px solid rgba(200,169,110,.06)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ width: 270, height: 270, border: "1px solid rgba(200,169,110,.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 185, height: 185, border: "1px solid rgba(200,169,110,.16)", borderRadius: "50%", background: "radial-gradient(circle, rgba(200,169,110,.04) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: ".5rem" }}>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3.5rem", color: "rgba(200,169,110,.35)", lineHeight: 1 }}>☕</span>
                    <span style={{ fontSize: ".5rem", letterSpacing: ".35em", textTransform: "uppercase", color: "rgba(200,169,110,.25)" }}>Noir Coffee</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="fade-in">
              <div style={{ fontSize: ".65rem", letterSpacing: ".4em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ display: "inline-block", width: 40, height: 1, background: "#c8a96e" }} />
                Kedai Kopi Bandung Sejak 2018
              </div>
              <h1 className="serif hero-title" style={{ fontSize: "clamp(3rem,8vw,6.5rem)", fontWeight: 300, lineHeight: .92, letterSpacing: "-.02em", marginBottom: "2rem" }}>
                Dituang<br />dengan <em style={{ color: "#c8a96e" }}>jiwa,</em><br />diminum<br />dengan rasa.
              </h1>
              <p style={{ maxWidth: 380, color: "#8a8a7e", fontSize: ".88rem", lineHeight: 1.8, marginBottom: "2.5rem" }}>
                Setiap cangkir adalah ritual. Biji pilihan dari berbagai penjuru nusantara, diseduh dengan teknik yang telah kami sempurnakan bertahun-tahun.
              </p>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button className="btn-gold" onClick={() => document.getElementById("menu-section").scrollIntoView({ behavior: "smooth" })}>Lihat Menu</button>
                <button className="btn-outline" onClick={() => setPage(PAGES.TRACK)}>Lacak Pesanan</button>
              </div>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="stats-strip" style={{ borderTop: "1px solid rgba(138,138,126,.1)", borderBottom: "1px solid rgba(138,138,126,.1)", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[
              { value: "2018", label: "Berdiri Sejak" },
              { value: "40+", label: "Pilihan Menu" },
              { value: "08–22", label: "Jam Buka" },
              { value: "★ 4.9", label: "Rating Pelanggan" },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: "1.5rem 2rem", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(138,138,126,.1)" : "none" }}>
                <div className="serif" style={{ fontSize: "1.8rem", color: "#c8a96e", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginTop: ".35rem" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Featured */}
          <div style={{ padding: "0 3rem 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem" }}>
              <span style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e" }}>Rekomendasi Kami</span>
              <div style={{ flex: 1, height: 1, background: "rgba(138,138,126,.2)" }} />
            </div>
          </div>
          <div className="featured-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 1, background: "rgba(138,138,126,.1)", margin: "0 0 0" }}>
            {featured.map((item, i) => (
              <div key={item.id} className="card-hover card-lift" style={{ background: "#0a0a08", padding: "2.5rem 2rem", position: "relative", overflow: "hidden", borderTop: "2px solid rgba(200,169,110,.18)" }}>
                <div style={{ position: "absolute", bottom: "1rem", right: "1.5rem", fontFamily: "'Cormorant Garamond',serif", fontSize: "4rem", color: "rgba(200,169,110,.05)", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".75rem" }}>
                  <span className="cat-icon">{getCatIcon(item.category_slug)}</span>
                  {item.category_name}
                </div>
                <h3 className="serif" style={{ fontSize: "1.6rem", marginBottom: ".75rem", lineHeight: 1.1 }}>{item.name}</h3>
                <p style={{ color: "#8a8a7e", fontSize: ".78rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>{item.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#c8a96e", fontSize: ".85rem" }}>{rp(item.price)}</span>
                  <button onClick={() => addToCart(item)} style={{ background: "none", border: "1px solid rgba(200,169,110,.3)", color: "#c8a96e", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", transition: "all .2s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "#c8a96e"; e.currentTarget.style.color = "#0a0a08"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#c8a96e"; }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Full Menu */}
          <div style={{ padding: "5rem 3rem" }} id="menu-section">
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2.5rem" }}>
              <span style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e" }}>Menu Lengkap</span>
              <div style={{ flex: 1, height: 1, background: "rgba(138,138,126,.2)" }} />
            </div>
            {/* Filter */}
            <div style={{ display: "flex", gap: 0, marginBottom: "2.5rem", borderBottom: "1px solid rgba(138,138,126,.15)", overflowX: "auto" }}>
              {categories.map(cat => {
                const catKey = cat.slug || cat.id;
                return (
                  <button key={catKey} onClick={() => setActiveCat(catKey)} style={{ background: "none", border: "none", borderBottom: activeCat === catKey ? "2px solid #c8a96e" : "2px solid transparent", color: activeCat === catKey ? "#c8a96e" : "#8a8a7e", padding: ".65rem 1.25rem", fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: -1, whiteSpace: "nowrap", transition: "all .2s" }}>
                    {cat.name}
                  </button>
                );
              })}
            </div>
            {/* Grid */}
            {loadingMenu ? (
              <div style={{ textAlign: "center", padding: "4rem 0", color: "#4a4a42", fontSize: ".85rem", letterSpacing: ".15em" }}>Memuat menu...</div>
            ) : (
              <div className="menu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 1, background: "rgba(138,138,126,.08)" }}>
                {filteredMenu.map(item => (
                  <div key={item.id} className="card-hover card-lift menu-item-accent" style={{ background: "#0a0a08", padding: "1.75rem 2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ".6rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flex: 1, paddingRight: "1rem" }}>
                        <span className="cat-icon" style={{ fontSize: ".85rem", width: 30, height: 30 }}>{getCatIcon(item.category_slug)}</span>
                        <h4 className="serif" style={{ fontSize: "1.15rem", lineHeight: 1.2 }}>{item.name}</h4>
                      </div>
                      <span style={{ color: "#c8a96e", fontSize: ".85rem", whiteSpace: "nowrap" }}>{rp(item.price)}</span>
                    </div>
                    <p style={{ color: "#8a8a7e", fontSize: ".78rem", lineHeight: 1.7, marginBottom: "1.25rem", paddingLeft: "2.4rem" }}>{item.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "2.4rem" }}>
                      <span style={{ fontSize: ".6rem", letterSpacing: ".15em", textTransform: "uppercase", color: "#4a4a42" }}>
                        {item.is_featured === 1 && "★ Featured · "}{item.category_name}
                      </span>
                      <button onClick={() => addToCart(item)} style={{ background: "none", border: "none", color: "#8a8a7e", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", borderBottom: "1px solid transparent", transition: "all .2s", paddingBottom: ".1rem" }}
                        onMouseOver={e => { e.currentTarget.style.color = "#c8a96e"; e.currentTarget.style.borderBottomColor = "rgba(200,169,110,.4)"; }}
                        onMouseOut={e => { e.currentTarget.style.color = "#8a8a7e"; e.currentTarget.style.borderBottomColor = "transparent"; }}>
                        + Pesan
                      </button>
                    </div>
                  </div>
                ))}
              </div>)}          </div>

          {/* Footer */}
          <footer style={{ borderTop: "1px solid rgba(138,138,126,.1)", background: "#050503" }}>
            <div className="footer-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "2.5rem", maxWidth: 1100, margin: "0 auto", padding: "3rem 3rem 2rem" }}>
              <div>
                <div className="serif" style={{ fontSize: "2rem", color: "#c8a96e", marginBottom: ".6rem" }}>Noir Coffee</div>
                <p style={{ fontSize: ".82rem", color: "#8a8a7e", lineHeight: 1.8, maxWidth: 300 }}>Setiap cangkir adalah ritual. Biji pilihan dari berbagai penjuru nusantara, diseduh dengan teknik yang telah kami sempurnakan bertahun-tahun.</p>
              </div>
              <div>
                <div style={{ fontSize: ".6rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Lokasi</div>
                <div style={{ fontSize: ".82rem", color: "#8a8a7e", lineHeight: 1.9 }}>
                  <div>Jl. Braga No. 88</div>
                  <div>Bandung, Jawa Barat</div>
                  <div style={{ marginTop: ".5rem", color: "#f0ede6" }}>+62 811 2345 6789</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: ".6rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Jam Buka</div>
                <div style={{ fontSize: ".82rem", color: "#8a8a7e", lineHeight: 1.9 }}>
                  <div>Senin – Jumat</div>
                  <div style={{ color: "#f0ede6" }}>08.00 – 22.00 WIB</div>
                  <div style={{ marginTop: ".5rem" }}>Sabtu – Minggu</div>
                  <div style={{ color: "#f0ede6" }}>07.00 – 23.00 WIB</div>
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(138,138,126,.08)", padding: "1.25rem 3rem", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
              <span style={{ color: "#4a4a42", fontSize: ".7rem", letterSpacing: ".12em" }}>© 2025 Noir Coffee. All rights reserved.</span>
              <span style={{ color: "#4a4a42", fontSize: ".7rem", letterSpacing: ".12em" }}>Bandung, Indonesia</span>
            </div>
          </footer>
        </div>
      )}

      {/* ======================== CHECKOUT PAGE ======================== */}
      {page === PAGES.CHECKOUT && (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "7rem 2rem 4rem" }} className="fade-in checkout-wrap">
          <button onClick={() => setPage(PAGES.MENU)} style={{ background: "none", border: "none", color: "#8a8a7e", fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: "2rem", display: "flex", alignItems: "center", gap: ".5rem" }}>← Kembali</button>
          <div style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".75rem" }}>Konfirmasi Pesanan</div>
          <h1 className="serif" style={{ fontSize: "2.2rem", marginBottom: "2.5rem" }}>Detail Pemesanan</h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="checkout-grid">
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Nama Pemesan *</label>
              <input className="input-noir" placeholder="Nama kamu" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>No. Telepon</label>
              <input className="input-noir" placeholder="08xx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Tipe Pesanan</label>
              <select className="input-noir" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="dine_in">Dine In</option>
                <option value="takeaway">Takeaway</option>
              </select>
            </div>
            {form.type === "dine_in" && (
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".75rem" }}>
                  Pilih Meja *
                  <button type="button" onClick={fetchTables} style={{ marginLeft: ".75rem", background: "none", border: "none", color: "#c8a96e", fontSize: ".6rem", letterSpacing: ".15em", cursor: "pointer", textTransform: "uppercase" }}>↺ Refresh</button>
                </label>
                {tables.length === 0 ? (
                  <div style={{ padding: "1rem", background: "#1a1a16", border: "1px solid rgba(138,138,126,.15)", fontSize: ".82rem", color: "#4a4a42", textAlign: "center" }}>
                    Tidak ada meja tersedia
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: ".5rem" }}>
                    {tables.map(t => {
                      const isOccupied = t.status === "occupied";
                      const isSelected = form.table === t.table_number;
                      return (
                        <button key={t.id} type="button" onClick={() => !isOccupied && setForm(f => ({ ...f, table: t.table_number }))}
                          disabled={isOccupied}
                          style={{
                            padding: ".6rem .4rem", background: isOccupied ? "rgba(30,30,26,.5)" : isSelected ? "rgba(200,169,110,.15)" : "#1a1a16",
                            border: isOccupied ? "1px solid rgba(138,138,126,.1)" : isSelected ? "1px solid #c8a96e" : "1px solid rgba(138,138,126,.2)",
                            color: isOccupied ? "#4a4a42" : isSelected ? "#c8a96e" : "#8a8a7e",
                            cursor: isOccupied ? "not-allowed" : "pointer", transition: "all .2s", textAlign: "center", position: "relative",
                          }}>
                          <div style={{ fontSize: ".9rem", fontFamily: "'Cormorant Garamond',serif", marginBottom: ".2rem", lineHeight: 1 }}>{t.table_number}</div>
                          <div style={{ fontSize: ".55rem", letterSpacing: ".12em", textTransform: "uppercase" }}>
                            {isOccupied ? "Terpakai" : `${t.capacity} kursi`}
                          </div>
                          {isOccupied && (
                            <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#c05050" }} />
                          )}
                          {!isOccupied && (
                            <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#5c8a5c" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {form.table && (
                  <div style={{ marginTop: ".5rem", fontSize: ".72rem", color: "#c8a96e", letterSpacing: ".1em" }}>
                    ✓ Meja {form.table} dipilih
                    <button type="button" onClick={() => setForm(f => ({ ...f, table: "" }))}
                      style={{ marginLeft: ".75rem", background: "none", border: "none", color: "#4a4a42", cursor: "pointer", fontSize: ".7rem" }}>✕ batal</button>
                  </div>
                )}
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Metode Bayar</label>
              <select className="input-noir" value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))}>
                <option value="cash">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Catatan</label>
              <textarea className="input-noir" rows={2} placeholder="Permintaan khusus..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "none" }} />
            </div>
          </div>

          {/* Order summary */}
          <div style={{ border: "1px solid rgba(138,138,126,.15)", padding: "1.5rem", margin: "2rem 0" }}>
            <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Ringkasan Pesanan</div>
            {cart.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: ".3rem 0", fontSize: ".85rem" }}>
                <span>{i.name} <span style={{ color: "#8a8a7e" }}>×{i.qty}</span></span>
                <span style={{ color: "#c8a96e" }}>{rp(i.price * i.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(138,138,126,.15)", marginTop: ".75rem", paddingTop: ".75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", color: "#8a8a7e", marginBottom: ".3rem" }}>
                <span>Subtotal</span><span>{rp(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", color: "#8a8a7e", marginBottom: ".75rem" }}>
                <span>PPN 10%</span><span>{rp(tax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e" }}>Total</span>
                <span className="serif" style={{ fontSize: "1.4rem", color: "#c8a96e" }}>{rp(total)}</span>
              </div>
            </div>
          </div>

          <button className="btn-gold" style={{ width: "100%", padding: ".85rem", fontSize: ".8rem" }} onClick={submitOrder}>
            Buat Pesanan →
          </button>
        </div>
      )}

      {/* ======================== CONFIRM PAGE ======================== */}
      {page === PAGES.CONFIRM && lastOrder && (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "7rem 2rem 4rem" }} className="fade-in">
          <div style={{ width: 56, height: 56, border: "1px solid rgba(200,169,110,.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem", color: "#c8a96e", fontSize: "1.3rem" }}>✓</div>
          <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".5rem" }}>{lastOrder.order_number}</div>
          <h1 className="serif" style={{ fontSize: "2.4rem", marginBottom: ".5rem" }}>Pesanan Diterima</h1>
          <p style={{ color: "#8a8a7e", fontSize: ".85rem", marginBottom: "3rem" }}>Terima kasih, <strong style={{ color: "#f0ede6" }}>{lastOrder.customer_name}</strong>. Pesananmu sedang kami proses.</p>

          <div style={{ border: "1px solid rgba(138,138,126,.15)", padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Status Pesanan</div>
            {[
              ["Status", <span style={{ border: "1px solid rgba(200,169,110,.4)", color: "#c8a96e", padding: ".2rem .6rem", fontSize: ".65rem", letterSpacing: ".15em", textTransform: "uppercase" }}>Menunggu</span>],
              ["Tipe", lastOrder.type === "dine_in" ? `Dine In${lastOrder.table_number ? " · Meja " + lastOrder.table_number : ""}` : "Takeaway"],
              ["Pembayaran", (lastOrder.payment_method || "").toUpperCase() + " · Belum Dibayar"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "1px solid rgba(138,138,126,.08)", fontSize: ".85rem" }}>
                <span style={{ color: "#8a8a7e" }}>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid rgba(138,138,126,.15)", padding: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Item Pesanan</div>
            {(lastOrder.items || []).map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: ".5rem 0", borderBottom: "1px solid rgba(138,138,126,.08)", fontSize: ".85rem" }}>
                <span className="serif">{item.product_name} <span style={{ color: "#8a8a7e" }}>×{item.quantity}</span></span>
                <span style={{ color: "#c8a96e" }}>{rp(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <span style={{ fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e" }}>Total</span>
              <span className="serif" style={{ fontSize: "1.4rem", color: "#c8a96e" }}>{rp(lastOrder.total)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button className="btn-outline" onClick={() => setPage(PAGES.MENU)}>← Menu</button>
            <button className="btn-gold" onClick={() => { setTrackInput(lastOrder.order_number); setTrackResult(null); setPage(PAGES.TRACK); }}>Lacak Pesanan</button>
          </div>
        </div>
      )}

      {/* ======================== TRACK PAGE ======================== */}
      {page === PAGES.TRACK && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "7rem 2rem 4rem" }} className="fade-in">
          <div style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".75rem" }}>— Lacak Pesanan</div>
          <h1 className="serif" style={{ fontSize: "2.4rem", marginBottom: ".75rem" }}>Cek Status<br />Pesananmu</h1>
          <p style={{ color: "#8a8a7e", fontSize: ".85rem", marginBottom: "2.5rem" }}>Masukkan nomor pesanan yang kamu terima.</p>

          <div style={{ display: "flex" }}>
            <input className="input-noir" placeholder="Contoh: KK2603010001" value={trackInput} onChange={e => setTrackInput(e.target.value)} style={{ borderRight: "none", flex: 1 }}
              onKeyDown={e => e.key === "Enter" && trackOrder()} />
            <button className="btn-gold" style={{ whiteSpace: "nowrap" }} onClick={trackOrder}>Cari</button>
          </div>

          {trackResult === "notfound" && (
            <div style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", borderLeft: "2px solid #c05050", background: "rgba(139,46,46,.08)", fontSize: ".85rem" }}>
              Pesanan tidak ditemukan.
            </div>
          )}

          {trackResult && trackResult !== "notfound" && (() => {
            const o = trackResult;
            const steps = ["pending", "confirmed", "preparing", "ready", "completed"];
            const curIdx = steps.indexOf(o.status);
            const labels = ["Diterima", "Konfirmasi", "Diproses", "Siap", "Selesai"];
            return (
              <div style={{ marginTop: "2.5rem" }}>
                <div style={{ height: 1, background: "rgba(138,138,126,.15)", margin: "0 0 2rem" }} />
                {/* Progress */}
                <div style={{ display: "flex", position: "relative", marginBottom: "2.5rem" }}>
                  <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 1, background: "rgba(138,138,126,.2)", zIndex: 0 }} />
                  {steps.map((s, i) => (
                    <div key={s} style={{ flex: 1, textAlign: "center", position: "relative", zIndex: 1 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", margin: "0 auto", border: `1px solid ${i <= curIdx ? "#c8a96e" : "rgba(138,138,126,.3)"}`, background: i < curIdx ? "#c8a96e" : i === curIdx ? "#1a1a16" : "#0a0a08", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {i < curIdx && <span style={{ color: "#0a0a08", fontSize: ".6rem" }}>✓</span>}
                        {i === curIdx && <span style={{ background: "#c8a96e", width: 8, height: 8, borderRadius: "50%", display: "block" }} />}
                      </div>
                      <div style={{ fontSize: ".55rem", letterSpacing: ".08em", textTransform: "uppercase", marginTop: ".4rem", color: i <= curIdx ? "#c8a96e" : "#4a4a42" }}>{labels[i]}</div>
                    </div>
                  ))}
                </div>
                {/* Info */}
                <div style={{ border: "1px solid rgba(138,138,126,.15)", padding: "1.5rem" }}>
                  <div style={{ color: "#c8a96e", fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", marginBottom: "1rem" }}>{o.order_number}</div>
                  {[["Pemesan", o.customer_name], ["Tipe", o.type === "dine_in" ? `Dine In${o.table_number ? " · Meja " + o.table_number : ""}` : "Takeaway"], ["Total", rp(o.total)]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: ".4rem 0", borderBottom: "1px solid rgba(138,138,126,.08)", fontSize: ".85rem" }}>
                      <span style={{ color: "#8a8a7e" }}>{k}</span><span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ======================== ADMIN PAGE ======================== */}
      {page === PAGES.ADMIN && (
        <div className="admin-layout fade-in" style={{ paddingTop: "4.5rem", display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh" }}>
          {/* Sidebar */}
          <div className="admin-sidebar" style={{ background: "#1a1a16", borderRight: "1px solid rgba(138,138,126,.1)", padding: "2rem 0" }}>
            <div style={{ fontSize: ".6rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#4a4a42", padding: "0 1.5rem", marginBottom: "1rem" }}>Manajemen</div>
            {[{ icon: "⬡", label: "Dashboard", view: "dashboard" }, { icon: "◈", label: "Pesanan", view: "pesanan" }, { icon: "◉", label: "Meja", view: "meja" }, { icon: "◎", label: "Produk", view: "produk" }].map(({ icon, label, view }) => (
              <button key={label} onClick={() => setAdminView(view)} style={{ background: "none", border: "none", borderLeft: `2px solid ${adminView === view ? "#c8a96e" : "transparent"}`, padding: ".65rem 1.5rem", display: "flex", gap: ".75rem", alignItems: "center", color: adminView === view ? "#c8a96e" : "#8a8a7e", fontSize: ".8rem", width: "100%", textAlign: "left", cursor: "pointer", transition: "color .2s, border-color .2s" }}>
                {icon} {label}
              </button>
            ))}
            <div style={{ fontSize: ".6rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#4a4a42", padding: "1.5rem 1.5rem .75rem" }}>Navigasi</div>
            <button onClick={() => setPage(PAGES.MENU)} style={{ background: "none", border: "none", padding: ".65rem 1.5rem", display: "flex", gap: ".75rem", alignItems: "center", color: "#8a8a7e", fontSize: ".8rem", width: "100%", textAlign: "left" }}>← Lihat Toko</button>
          </div>

          {/* Content */}
          <div style={{ padding: "2.5rem" }}>
            <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".5rem" }}>Dashboard</div>
            <h1 className="serif" style={{ fontSize: "1.8rem", marginBottom: "2.5rem" }}>Selamat datang, <em>Barista.</em></h1>

            {/* Stats */}
            {(adminView === "dashboard") && <div className="stats-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(138,138,126,.08)", marginBottom: "3rem" }}>
              {[
                { label: "Pesanan Hari Ini", value: stats.total_orders, sub: "Total order masuk", icon: "📋" },
                { label: "Pendapatan", value: "Rp " + Number(stats.revenue).toLocaleString("id-ID"), sub: "Order selesai (hari ini)", icon: "💰" },
                { label: "Pesanan Aktif", value: stats.active_orders, sub: "Perlu diproses", icon: "⏳" },
                { label: "Meja Terpakai", value: `${stats.occupied_tables || 0}/${stats.total_tables || 0}`, sub: "Dari total meja", icon: "🪑" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ background: "#0a0a08", padding: "2rem 1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ".75rem" }}>
                    <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#8a8a7e" }}>{s.label}</div>
                    <span style={{ fontSize: "1.1rem", opacity: .4 }}>{s.icon}</span>
                  </div>
                  <div className="serif" style={{ fontSize: "2rem", color: "#c8a96e", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: ".75rem", color: "#4a4a42", marginTop: ".4rem" }}>{s.sub}</div>
                </div>
              ))}
            </div>}

            {/* Orders Table */}
            {(adminView === "dashboard" || adminView === "pesanan") && <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.25rem" }}>Daftar Pesanan</div>}
            {(adminView === "dashboard" || adminView === "pesanan") && <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
                <thead>
                  <tr>
                    {["No. Pesanan", "Pelanggan", "Tipe", "Total", "Status", "Waktu", "Ubah Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: ".65rem 1rem", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", borderBottom: "1px solid rgba(138,138,126,.15)", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.order_number || o.id} style={{ transition: "background .15s" }}
                      onMouseOver={e => e.currentTarget.style.background = "rgba(200,169,110,.02)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", color: "#c8a96e", fontFamily: "'Cormorant Garamond',serif" }}>{o.order_number}</td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>{o.customer_name}</td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", color: "#8a8a7e" }}>{o.type === "dine_in" ? `Dine In${o.table_number ? " · " + o.table_number : ""}` : "Takeaway"}</td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>{rp(o.total)}</td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>
                        <span style={{ border: `1px solid ${statusColor[o.status]}50`, color: statusColor[o.status], padding: ".2rem .6rem", fontSize: ".6rem", letterSpacing: ".15em", textTransform: "uppercase" }}>
                          {statusLabel[o.status]}
                        </span>
                      </td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", color: "#8a8a7e" }}>
                        {o.created_at ? new Date(o.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>
                        <select value={o.status} onChange={e => updateOrderStatus(o.order_number, e.target.value)}
                          style={{ background: "none", border: "1px solid rgba(138,138,126,.2)", color: "#8a8a7e", padding: ".3rem .5rem", fontFamily: "'Inconsolata',monospace", fontSize: ".7rem", cursor: "pointer", outline: "none" }}>
                          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v} style={{ background: "#1a1a16" }}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}

            {/* ─── MEJA VIEW ─────────────────────────────────────────────── */}
            {adminView === "meja" && (
              <div>
                {/* Table Form Modal */}
                {tableFormOpen && (
                  <div style={{ position: "fixed", inset: 0, zIndex: 500 }}>
                    <div onClick={() => setTableFormOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.75)" }} />
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#1a1a16", border: "1px solid rgba(200,169,110,.2)", padding: "2.5rem", width: "min(420px,90vw)" }}>
                      <h3 className="serif" style={{ fontSize: "1.5rem", marginBottom: "1.75rem" }}>{editingTable ? "Edit Meja" : "Tambah Meja"}</h3>
                      {tableFormError && (
                        <div style={{ marginBottom: "1rem", padding: ".7rem 1rem", borderLeft: "2px solid #c05050", background: "rgba(139,46,46,.1)", fontSize: ".8rem", color: "#d06060" }}>{tableFormError}</div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                          <label style={{ display: "block", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Nomor Meja *</label>
                          <input className="input-noir" placeholder="Contoh: A1" value={tableForm.table_number} onChange={e => setTableForm(f => ({ ...f, table_number: e.target.value.toUpperCase() }))} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Kapasitas (kursi)</label>
                          <input className="input-noir" type="number" min={1} max={20} placeholder="4" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Lokasi</label>
                          <input className="input-noir" placeholder="Contoh: Area Dalam, Area Luar" value={tableForm.location} onChange={e => setTableForm(f => ({ ...f, location: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: ".75rem", marginTop: "2rem" }}>
                        <button className="btn-outline" style={{ flex: 1 }} onClick={() => setTableFormOpen(false)}>Batal</button>
                        <button className="btn-gold" style={{ flex: 1 }} onClick={saveTable}>{editingTable ? "Simpan" : "Tambah"}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                  <div>
                    <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".25rem" }}>Manajemen Meja</div>
                    <div style={{ color: "#8a8a7e", fontSize: ".82rem" }}>
                      {tables.filter(t => t.status === "available").length} tersedia · {tables.filter(t => t.status === "occupied").length} terpakai · {tables.length} total
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>
                    <button onClick={fetchTables} style={{ background: "none", border: "1px solid rgba(138,138,126,.2)", color: "#8a8a7e", padding: ".5rem .9rem", fontSize: ".65rem", letterSpacing: ".15em", textTransform: "uppercase", transition: "all .2s" }}
                      onMouseOver={e => e.currentTarget.style.borderColor = "rgba(200,169,110,.4)"}
                      onMouseOut={e => e.currentTarget.style.borderColor = "rgba(138,138,126,.2)"}>↺ Refresh</button>
                    <button className="btn-gold" onClick={openAddTable}>+ Tambah Meja</button>
                  </div>
                </div>

                {/* Floor Plan Visual */}
                <div style={{ marginBottom: "2.5rem" }}>
                  <div style={{ fontSize: ".6rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.25rem", display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <span>Denah Meja</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", color: "#5c8a5c" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#5c8a5c", display: "inline-block" }} />Tersedia</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", color: "#c05050" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c05050", display: "inline-block" }} />Terpakai</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: ".75rem" }}>
                    {tables.map(t => {
                      const isOccupied = t.status === "occupied";
                      return (
                        <div key={t.id} style={{
                          position: "relative", padding: "1.25rem .75rem .9rem", background: isOccupied ? "rgba(192,80,80,.08)" : "rgba(92,138,92,.06)",
                          border: `1px solid ${isOccupied ? "rgba(192,80,80,.3)" : "rgba(92,138,92,.25)"}`, textAlign: "center", transition: "all .2s",
                        }}>
                          <div style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: isOccupied ? "#c05050" : "#5c8a5c" }} />
                          <div className="serif" style={{ fontSize: "1.8rem", color: isOccupied ? "#c05050" : "#c8a96e", lineHeight: 1, marginBottom: ".3rem" }}>{t.table_number}</div>
                          <div style={{ fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".2rem" }}>{t.capacity} kursi</div>
                          {t.location && <div style={{ fontSize: ".55rem", color: "#4a4a42", letterSpacing: ".08em" }}>{t.location}</div>}
                          <div style={{ fontSize: ".6rem", letterSpacing: ".12em", textTransform: "uppercase", marginTop: ".4rem", color: isOccupied ? "#c05050" : "#5c8a5c" }}>
                            {isOccupied ? "Terpakai" : "Tersedia"}
                          </div>
                          {isOccupied && (
                            <button onClick={() => releaseTable(t.table_number)}
                              style={{ marginTop: ".5rem", background: "none", border: "1px solid rgba(192,80,80,.3)", color: "#c05050", padding: ".3rem .5rem", fontSize: ".55rem", letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", width: "100%", transition: "all .2s" }}
                              onMouseOver={e => { e.currentTarget.style.background = "rgba(192,80,80,.15)"; }}
                              onMouseOut={e => { e.currentTarget.style.background = "none"; }}>
                              Bebaskan
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Table List */}
                <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1rem" }}>Daftar Meja</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
                    <thead>
                      <tr>
                        {["Nomor Meja", "Kapasitas", "Lokasi", "Status", "Aksi"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: ".65rem 1rem", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", borderBottom: "1px solid rgba(138,138,126,.15)", fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tables.map(t => (
                        <tr key={t.id} onMouseOver={e => e.currentTarget.style.background = "rgba(200,169,110,.02)"} onMouseOut={e => e.currentTarget.style.background = "none"}>
                          <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", fontFamily: "'Cormorant Garamond',serif", fontSize: "1rem", color: "#c8a96e" }}>{t.table_number}</td>
                          <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", color: "#8a8a7e" }}>{t.capacity} orang</td>
                          <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)", color: "#8a8a7e" }}>{t.location || "—"}</td>
                          <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>
                            <span style={{ border: `1px solid ${t.status === "occupied" ? "rgba(192,80,80,.4)" : "rgba(92,138,92,.4)"}`, color: t.status === "occupied" ? "#c05050" : "#5c8a5c", padding: ".2rem .6rem", fontSize: ".6rem", letterSpacing: ".15em", textTransform: "uppercase" }}>
                              {t.status === "occupied" ? "Terpakai" : "Tersedia"}
                            </span>
                          </td>
                          <td style={{ padding: ".8rem 1rem", borderBottom: "1px solid rgba(138,138,126,.07)" }}>
                            <div style={{ display: "flex", gap: ".5rem" }}>
                              <button onClick={() => openEditTable(t)}
                                style={{ background: "none", border: "1px solid rgba(138,138,126,.2)", color: "#8a8a7e", padding: ".3rem .6rem", fontSize: ".65rem", letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", transition: "all .2s" }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(200,169,110,.4)"; e.currentTarget.style.color = "#c8a96e"; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(138,138,126,.2)"; e.currentTarget.style.color = "#8a8a7e"; }}>
                                Edit
                              </button>
                              <button onClick={() => deleteTable(t.id)} disabled={t.status === "occupied"}
                                style={{ background: "none", border: "1px solid rgba(138,138,126,.2)", color: t.status === "occupied" ? "#4a4a42" : "#8a8a7e", padding: ".3rem .6rem", fontSize: ".65rem", letterSpacing: ".12em", textTransform: "uppercase", cursor: t.status === "occupied" ? "not-allowed" : "pointer", transition: "all .2s", opacity: t.status === "occupied" ? .4 : 1 }}
                                onMouseOver={e => { if (t.status !== "occupied") { e.currentTarget.style.borderColor = "rgba(192,80,80,.4)"; e.currentTarget.style.color = "#c05050"; } }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(138,138,126,.2)"; e.currentTarget.style.color = "#8a8a7e"; }}>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Products list */}
            {(adminView === "dashboard" || adminView === "produk") && <div style={{ marginTop: adminView === "produk" ? "0" : "3rem" }}>
              <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.25rem" }}>Produk</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 1, background: "rgba(138,138,126,.08)" }}>
                {menu.map(p => (
                  <div key={p.id} style={{ background: "#0a0a08", padding: "1.25rem 1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span className="serif" style={{ fontSize: "1rem" }}>{p.name}</span>
                      <span style={{ color: "#c8a96e", fontSize: ".8rem" }}>{rp(p.price)}</span>
                    </div>
                    <div style={{ fontSize: ".65rem", letterSpacing: ".15em", textTransform: "uppercase", color: "#4a4a42", marginTop: ".4rem" }}>
                      {p.category_name}{p.is_featured === 1 && " · ★"}
                    </div>
                  </div>
                ))}
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}