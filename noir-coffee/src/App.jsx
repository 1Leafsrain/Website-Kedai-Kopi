import { useState, useEffect } from "react";

const rp = (n) => "Rp " + Number(n).toLocaleString("id-ID");

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
  const [stats, setStats] = useState({ total_orders: 0, revenue: 0, active_orders: 0, total_products: 0 });
  const [loadingMenu, setLoadingMenu] = useState(true);

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
  }, []);

  useEffect(() => {
    if (page === "admin") { fetchOrders(); fetchStats(); }
  }, [page]);

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

  const submitOrder = async () => {
    if (!form.name.trim()) return showToast("Nama harus diisi!");
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
      if (!res.ok) throw new Error("Gagal membuat pesanan");
      const order = await res.json();
      setOrders(prev => [order, ...prev]);
      setLastOrder(order);
      setCart([]);
      setForm({ name: "", phone: "", type: "dine_in", table: "", payment: "cash", notes: "" });
      setPage(PAGES.CONFIRM);
    } catch (err) { showToast("Gagal: " + err.message); }
  };

  const filteredMenu = activeCat === "all" ? menu : menu.filter(m => m.category_slug === activeCat);
  const featured = menu.filter(m => m.is_featured === 1);

  const statusLabel = { pending: "Menunggu", confirmed: "Dikonfirmasi", preparing: "Diproses", ready: "Siap Diambil", completed: "Selesai", cancelled: "Dibatalkan" };
  const statusColor = { pending: "#c8a96e", confirmed: "#88cc88", preparing: "#ccaa44", ready: "#60dd60", completed: "#8a8a7e", cancelled: "#c05050" };

  if (!mounted) return null;

  return (
    <div style={{ fontFamily: "'Inconsolata', monospace", background: "#0a0a08", color: "#f0ede6", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inconsolata:wght@300;400;500&display=swap');
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
          <div style={{ position: "absolute", top: 0, right: 0, width: 400, height: "100vh", background: "#1a1a16", borderLeft: "1px solid rgba(200,169,110,.15)", display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.25,.46,.45,.94)" }}>
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
          <div style={{ minHeight: "75vh", display: "flex", alignItems: "flex-end", padding: "5rem 3rem 4rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 65% 50%, rgba(200,169,110,.05) 0%, transparent 60%)" }} />
            <div style={{ position: "absolute", right: "6%", top: "50%", transform: "translateY(-50%)", fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(8rem,18vw,16rem)", color: "rgba(200,169,110,.04)", lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>☕</div>
            <div className="fade-in">
              <div style={{ fontSize: ".65rem", letterSpacing: ".4em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ display: "inline-block", width: 40, height: 1, background: "#c8a96e" }} />
                Kedai Kopi Bandung Sejak 2018
              </div>
              <h1 className="serif" style={{ fontSize: "clamp(3rem,8vw,6.5rem)", fontWeight: 300, lineHeight: .92, letterSpacing: "-.02em", marginBottom: "2rem" }}>
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

          {/* Featured */}
          <div style={{ padding: "0 3rem 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem" }}>
              <span style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e" }}>Rekomendasi Kami</span>
              <div style={{ flex: 1, height: 1, background: "rgba(138,138,126,.2)" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 1, background: "rgba(138,138,126,.1)", margin: "0 0 0" }}>
            {featured.map((item, i) => (
              <div key={item.id} className="card-hover" style={{ background: "#0a0a08", padding: "2.5rem 2rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: "1rem", right: "1.5rem", fontFamily: "'Cormorant Garamond',serif", fontSize: "4rem", color: "rgba(200,169,110,.05)", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".75rem" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 1, background: "rgba(138,138,126,.08)" }}>
                {filteredMenu.map(item => (
                  <div key={item.id} className="card-hover" style={{ background: "#0a0a08", padding: "1.75rem 2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ".6rem" }}>
                      <h4 className="serif" style={{ fontSize: "1.15rem", flex: 1, paddingRight: "1rem", lineHeight: 1.2 }}>{item.name}</h4>
                      <span style={{ color: "#c8a96e", fontSize: ".85rem", whiteSpace: "nowrap" }}>{rp(item.price)}</span>
                    </div>
                    <p style={{ color: "#8a8a7e", fontSize: ".78rem", lineHeight: 1.7, marginBottom: "1.25rem" }}>{item.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          <div style={{ borderTop: "1px solid rgba(138,138,126,.1)", padding: "3rem", textAlign: "center", color: "#4a4a42", fontSize: ".75rem", letterSpacing: ".15em" }}>
            <div className="serif" style={{ fontSize: "2rem", color: "#c8a96e", display: "block", marginBottom: ".5rem" }}>Noir Coffee</div>
            Jl. Braga No. 88, Bandung · Buka 08.00 — 22.00
          </div>
        </div>
      )}

      {/* ======================== CHECKOUT PAGE ======================== */}
      {page === PAGES.CHECKOUT && (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "7rem 2rem 4rem" }} className="fade-in">
          <button onClick={() => setPage(PAGES.MENU)} style={{ background: "none", border: "none", color: "#8a8a7e", fontSize: ".7rem", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: "2rem", display: "flex", alignItems: "center", gap: ".5rem" }}>← Kembali</button>
          <div style={{ fontSize: ".65rem", letterSpacing: ".35em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".75rem" }}>Konfirmasi Pesanan</div>
          <h1 className="serif" style={{ fontSize: "2.2rem", marginBottom: "2.5rem" }}>Detail Pemesanan</h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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
              <div>
                <label style={{ display: "block", fontSize: ".65rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".4rem" }}>Nomor Meja</label>
                <input className="input-noir" placeholder="Contoh: A1" value={form.table} onChange={e => setForm(f => ({ ...f, table: e.target.value }))} />
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
        <div style={{ paddingTop: "4.5rem", display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh" }} className="fade-in">
          {/* Sidebar */}
          <div style={{ background: "#1a1a16", borderRight: "1px solid rgba(138,138,126,.1)", padding: "2rem 0" }}>
            <div style={{ fontSize: ".6rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#4a4a42", padding: "0 1.5rem", marginBottom: "1rem" }}>Manajemen</div>
            {[{ icon: "⬡", label: "Dashboard" }, { icon: "◈", label: "Pesanan" }, { icon: "◎", label: "Produk" }].map(({ icon, label }) => (
              <div key={label} style={{ padding: ".65rem 1.5rem", display: "flex", gap: ".75rem", alignItems: "center", color: "#8a8a7e", fontSize: ".8rem", cursor: "default", borderLeft: "2px solid transparent" }}>
                {icon} {label}
              </div>
            ))}
            <div style={{ fontSize: ".6rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#4a4a42", padding: "1.5rem 1.5rem .75rem" }}>Navigasi</div>
            <button onClick={() => setPage(PAGES.MENU)} style={{ background: "none", border: "none", padding: ".65rem 1.5rem", display: "flex", gap: ".75rem", alignItems: "center", color: "#8a8a7e", fontSize: ".8rem", width: "100%", textAlign: "left" }}>← Lihat Toko</button>
          </div>

          {/* Content */}
          <div style={{ padding: "2.5rem" }}>
            <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: ".5rem" }}>Dashboard</div>
            <h1 className="serif" style={{ fontSize: "1.8rem", marginBottom: "2.5rem" }}>Selamat datang, <em>Barista.</em></h1>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(138,138,126,.08)", marginBottom: "3rem" }}>
              {[
                { label: "Pesanan Hari Ini", value: stats.total_orders, sub: "Total order masuk" },
                { label: "Pendapatan", value: "Rp " + Number(stats.revenue).toLocaleString("id-ID"), sub: "Order selesai (hari ini)" },
                { label: "Pesanan Aktif", value: stats.active_orders, sub: "Perlu diproses" },
                { label: "Total Produk", value: stats.total_products, sub: "Produk aktif" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0a0a08", padding: "2rem 1.5rem" }}>
                  <div style={{ fontSize: ".65rem", letterSpacing: ".25em", textTransform: "uppercase", color: "#8a8a7e", marginBottom: ".75rem" }}>{s.label}</div>
                  <div className="serif" style={{ fontSize: "2rem", color: "#c8a96e", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: ".75rem", color: "#4a4a42", marginTop: ".4rem" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Orders Table */}
            <div style={{ fontSize: ".65rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c8a96e", marginBottom: "1.25rem" }}>Daftar Pesanan</div>
            <div style={{ overflowX: "auto" }}>
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
            </div>

            {/* Products list */}
            <div style={{ marginTop: "3rem" }}>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}