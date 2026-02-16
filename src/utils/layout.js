// src/utils/layout.js

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n) {
  return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SHARED_CSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;font-size:14px;line-height:1.6}

    /* ── Custom scrollbar ── */
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#c1c5cd;border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:#a0a5b0}

    /* ── Topbar ── */
    .topbar{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:0 32px;height:56px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
    .topbar h1{font-size:1rem;font-weight:700;letter-spacing:-.02em}
    .topbar .logo{color:#fff;text-decoration:none;display:flex;align-items:center;gap:8px}
    .topbar .logo-icon{width:28px;height:28px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700}
    .topbar nav{display:flex;align-items:center;gap:4px}
    .topbar nav a{color:rgba(255,255,255,.6);text-decoration:none;font-size:.82rem;padding:7px 14px;border-radius:6px;transition:all .2s;font-weight:500}
    .topbar nav a:hover{color:#fff;background:rgba(255,255,255,.1)}
    .topbar nav a.active{color:#fff;background:rgba(37,99,235,.4)}
    .topbar .user-info{font-size:.8rem;color:rgba(255,255,255,.55);font-weight:500}
    .topbar .logout-btn{background:transparent;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.18);padding:5px 16px;border-radius:6px;cursor:pointer;font-size:.78rem;transition:all .2s;font-weight:500}
    .topbar .logout-btn:hover{color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.06)}

    /* ── Layout ── */
    .wrap{max-width:960px;margin:0 auto;padding:32px 24px}

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
    .alert{padding:12px 18px;border-radius:8px;font-size:.86rem;margin-bottom:18px}
    .alert-success{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
    .alert-error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}

    /* ── Stats ── */
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:32px}
    .stat{background:#fff;border-radius:10px;padding:20px 22px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .stat .label{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:5px}
    .stat .value{font-size:1.3rem;font-weight:700;color:#1e1e2d}

    .empty{text-align:center;padding:48px;color:#9ca3af;font-size:.9rem}

    /* ── Smooth transitions ── */
    @media(prefers-reduced-motion:no-preference){
      .card,.btn,.field input,.field textarea,.field select{transition:all .2s ease}
    }

    /* ── Responsive ── */
    @media(max-width:640px){
      .topbar{padding:0 16px;height:auto;min-height:56px;flex-direction:column;padding:12px 16px;gap:8px}
      .topbar nav{flex-wrap:wrap;justify-content:center}
      .wrap{padding:20px 16px}
    }
`;

function page({ title, user, content, extraCss, script, activePage }) {
  const navItems = [
    { href: "/dashboard", label: "Dashboard", key: "dashboard" },
    { href: "/quotes/new", label: "Nuovo preventivo", key: "new" },
    { href: "/settings/prices", label: "Listino", key: "prices" },
    { href: "/profile", label: "Profilo", key: "profile" }
  ];
  const navHtml = navItems.map(n =>
    `<a href="${n.href}"${activePage === n.key ? ' class="active"' : ""}>${n.label}</a>`
  ).join("\n        ");

  const userNav = user ? `
  <div class="topbar">
    <div style="display:flex;align-items:center;gap:20px">
      <a href="/dashboard" class="logo">
        <div class="logo-icon">P</div>
        <h1>Preventivo AI</h1>
      </a>
      <nav>
        ${navHtml}
      </nav>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <span class="user-info">${esc(user.name)}</span>
      <button class="logout-btn" onclick="doLogout()">Esci</button>
    </div>
  </div>` : "";

  const logoutScript = user ? `
  function doLogout(){
    fetch('/auth/logout',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(){window.location.href='/auth/login'})
      .catch(function(){window.location.href='/auth/login'});
  }` : "";

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
  ${userNav}
  ${content}
  <script>${logoutScript}${script || ""}</script>
</body>
</html>`;
}

module.exports = { page, esc, fmt, SHARED_CSS };
