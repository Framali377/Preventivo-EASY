// src/utils/layout.js

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n) {
  return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function planInfo(user) {
  if (!user) return { label: "Free", cls: "plan-free", icon: "" };
  const p = user.plan || "free";
  const active = user.subscription_status === "active";
  if (p === "early" && active) return { label: "Early Bird", cls: "plan-early", icon: "&#9889;" };
  if (p === "standard" && active) return { label: "Standard", cls: "plan-standard", icon: "&#9733;" };
  if (p === "pay_per_use" || (user.credits && user.credits > 0)) return { label: "Pay-per-use", cls: "plan-ppu", icon: "&#9889;" };
  return { label: "Free", cls: "plan-free", icon: "" };
}

const SHARED_CSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;font-size:14px;line-height:1.6}

    /* ── Custom scrollbar ── */
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#c1c5cd;border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:#a0a5b0}

    /* ── Sidebar ── */
    .sidebar{position:fixed;top:0;left:0;bottom:0;width:220px;background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);color:#fff;z-index:110;display:flex;flex-direction:column;overflow-y:auto}
    .sidebar-logo{display:flex;align-items:center;gap:10px;padding:20px 20px 24px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:8px;text-decoration:none;color:#fff}
    .sidebar-logo-icon{width:30px;height:30px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;flex-shrink:0}
    .sidebar-logo span{font-size:.95rem;font-weight:700;letter-spacing:-.02em}
    .sidebar-nav{flex:1;padding:4px 0}
    .sidebar-link{display:flex;align-items:center;gap:10px;padding:10px 20px;color:rgba(255,255,255,.5);font-size:.84rem;font-weight:500;text-decoration:none;transition:all .15s;border-right:2px solid transparent}
    .sidebar-link:hover{color:rgba(255,255,255,.8);background:rgba(255,255,255,.04)}
    .sidebar-link.active{color:#fff;background:rgba(37,99,235,.15);border-right-color:#2563eb}
    .sidebar-link svg{width:18px;height:18px;opacity:.5;flex-shrink:0}
    .sidebar-link.active svg{opacity:1}
    .sidebar-bottom{padding:16px 20px;border-top:1px solid rgba(255,255,255,.06)}
    .sidebar-plan{display:inline-block;font-size:.68rem;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px}
    .sidebar-user{font-size:.78rem;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sidebar-logout{display:block;margin-top:10px;font-size:.78rem;color:rgba(255,255,255,.35);background:none;border:1px solid rgba(255,255,255,.1);padding:6px 14px;border-radius:6px;cursor:pointer;transition:all .15s;text-align:center;width:100%;font-family:inherit}
    .sidebar-logout:hover{color:#fff;border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.06)}

    /* ── Plan badge colors ── */
    .plan-free{background:rgba(255,243,205,.9);color:#856404}
    .plan-early{background:rgba(167,243,208,.9);color:#065f46}
    .plan-standard{background:rgba(147,197,253,.9);color:#1e40af}
    .plan-ppu{background:rgba(233,213,255,.9);color:#6b21a8}

    /* ── Topbar (slim, content area only) ── */
    .topbar{position:fixed;top:0;left:220px;right:0;z-index:100;background:#fff;height:52px;display:flex;justify-content:flex-end;align-items:center;padding:0 28px;border-bottom:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.03)}
    .topbar-user{display:flex;align-items:center;gap:10px;font-size:.84rem;color:#6b7280}
    .topbar-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700}
    .topbar-name{font-weight:500;color:#374151}

    /* ── Main content area ── */
    .app-body{margin-left:220px;padding-top:52px;min-height:100vh}

    /* ── Layout ── */
    .wrap{max-width:1100px;margin:0 auto;padding:32px 28px}

    /* ── Componenti condivisi ── */
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05),0 4px 16px rgba(0,0,0,.04);overflow:hidden;transition:box-shadow .2s}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 24px;border-radius:8px;font-size:.84rem;font-weight:600;cursor:pointer;border:none;text-decoration:none;text-align:center;transition:all .2s;line-height:1.4}
    .btn-primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.25)}
    .btn-primary:hover{background:linear-gradient(135deg,#1d4ed8,#1e40af);box-shadow:0 4px 12px rgba(37,99,235,.35);transform:translateY(-1px)}
    .btn-secondary{background:#f0f1f3;color:#444;border:1px solid #e2e4e8}
    .btn-secondary:hover{background:#e4e5e9;border-color:#d1d3d7}
    .btn-danger{background:#fff;color:#dc2626;border:1px solid #fca5a5}
    .btn-danger:hover{background:#fef2f2;border-color:#dc2626}
    .badge{padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;white-space:nowrap}
    .link{color:#2563eb;text-decoration:none;font-weight:500}
    .link:hover{text-decoration:underline}

    /* ── Form ── */
    .field{margin-bottom:22px}
    .field label{display:block;font-size:.76rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px}
    .field input,.field textarea,.field select{width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;font-family:inherit;transition:all .2s;background:#fff}
    .field input:focus,.field textarea:focus,.field select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    .field textarea{min-height:120px;resize:vertical;line-height:1.6}
    .field select{cursor:pointer;height:42px}
    .field .hint{font-size:.75rem;color:#9ca3af;margin-top:5px}

    /* ── Tabella ── */
    table{width:100%;border-collapse:collapse;font-size:.84rem}
    th{background:#f9fafb;text-align:left;padding:10px 14px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:1px solid #e5e7eb}
    td{padding:10px 14px;border-bottom:1px solid #f3f4f6}
    tr:hover{background:#f9fafb}
    .r{text-align:right;font-weight:500}
    .c{text-align:center}

    /* ── Alert ── */
    .alert{padding:14px 20px;border-radius:10px;font-size:.88rem;margin-bottom:18px;display:flex;align-items:center;gap:10px}
    .alert-success{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
    .alert-error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    .alert-warning{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
    .alert-info{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}

    /* ── Stats ── */
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:32px}
    .stat{background:#fff;border-radius:10px;padding:20px 22px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .stat .label{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:5px}
    .stat .value{font-size:1.3rem;font-weight:700;color:#1e1e2d}

    .empty{text-align:center;padding:48px;color:#9ca3af;font-size:.9rem}

    /* ── Progress bar ── */
    .progress-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin:8px 0}
    .progress-fill{height:100%;border-radius:4px;transition:width .4s ease}

    /* ── Smooth transitions ── */
    @media(prefers-reduced-motion:no-preference){
      .card,.btn,.field input,.field textarea,.field select{transition:all .2s ease}
    }

    /* ── Mobile hamburger ── */
    .hamburger{display:none;position:fixed;top:12px;left:12px;z-index:120;background:#1a1a2e;border:none;color:#fff;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:1.2rem;align-items:center;justify-content:center}

    /* ── Responsive ── */
    @media(max-width:800px){
      .sidebar{transform:translateX(-100%);transition:transform .25s ease;width:260px}
      .sidebar.open{transform:translateX(0)}
      .topbar{left:0}
      .app-body{margin-left:0}
      .hamburger{display:flex}
      .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:105}
      .sidebar-overlay.open{display:block}
      .wrap{padding:24px 16px}
    }
`;

// SVG icons for sidebar nav
const NAV_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  new: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  prices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

function page({ title, user, content, extraCss, script, activePage }) {
  const navItems = [
    { href: "/dashboard", label: "Dashboard", key: "dashboard" },
    { href: "/quotes/new", label: "Nuovo preventivo", key: "new" },
    { href: "/settings/prices", label: "Listino prezzi", key: "prices" },
    { href: "/profile", label: "Profilo", key: "profile" }
  ];

  const pi = planInfo(user);

  const sidebarNav = navItems.map(n =>
    `<a href="${n.href}" class="sidebar-link${activePage === n.key ? ' active' : ''}">${NAV_ICONS[n.key] || ''}${n.label}</a>`
  ).join("\n        ");

  const shell = user ? `
  <button class="hamburger" id="hamburgerBtn">&#9776;</button>
  <div class="sidebar-overlay" id="sidebarOverlay"></div>
  <aside class="sidebar" id="sidebar">
    <a href="/dashboard" class="sidebar-logo">
      <div class="sidebar-logo-icon">P</div>
      <span>Preventivo AI</span>
    </a>
    <nav class="sidebar-nav">
      ${sidebarNav}
    </nav>
    <div class="sidebar-bottom">
      <span class="sidebar-plan ${pi.cls}">${pi.label}</span>
      <div class="sidebar-user">${esc(user.name)}</div>
      <button class="sidebar-logout" onclick="doLogout()">Esci</button>
    </div>
  </aside>
  <header class="topbar">
    <div class="topbar-user">
      <span class="topbar-name">${esc(user.name)}</span>
      <div class="topbar-avatar">${esc(user.name.charAt(0).toUpperCase())}</div>
    </div>
  </header>
  <div class="app-body">
    ${content}
  </div>` : content;

  const logoutScript = user ? `
  function doLogout(){
    fetch('/auth/logout',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(){window.location.href='/auth/login'})
      .catch(function(){window.location.href='/auth/login'});
  }` : "";

  const mobileScript = user ? `
  (function(){
    var btn=document.getElementById('hamburgerBtn');
    var sidebar=document.getElementById('sidebar');
    var overlay=document.getElementById('sidebarOverlay');
    if(!btn)return;
    btn.addEventListener('click',function(){
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click',function(){
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  })();` : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Preventivo AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}${extraCss || ""}</style>
</head>
<body>
  ${shell}
  <script>${logoutScript}${mobileScript}${script || ""}</script>
</body>
</html>`;
}

module.exports = { page, esc, fmt, planInfo, SHARED_CSS };
