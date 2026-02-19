// src/routes/landing.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo AI — Crea preventivi professionali in 30 secondi</title>
  <meta name="description" content="L'assistente AI che genera preventivi dettagliati e realistici per qualsiasi professione. Provalo gratis.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e1e2d;line-height:1.6;font-size:15px;overflow-x:hidden}
    a{color:inherit;text-decoration:none}

    /* ── Topbar ── */
    .nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 40px;height:64px;display:flex;justify-content:space-between;align-items:center;transition:background .3s,box-shadow .3s}
    .nav.scrolled{background:rgba(26,26,46,.97);backdrop-filter:blur(16px);box-shadow:0 2px 20px rgba(0,0,0,.15)}
    .nav-logo{display:flex;align-items:center;gap:10px}
    .nav-logo-icon{width:32px;height:32px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.95rem;font-weight:700;color:#fff}
    .nav-logo span{font-size:1.05rem;font-weight:700;color:#fff;letter-spacing:-.02em}
    .nav-actions{display:flex;gap:10px;align-items:center}
    .nav-link{color:rgba(255,255,255,.65);font-size:.88rem;font-weight:500;padding:8px 18px;border-radius:8px;transition:all .2s}
    .nav-link:hover{color:#fff;background:rgba(255,255,255,.08)}
    .nav-cta{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:.88rem;font-weight:600;padding:9px 22px;border-radius:8px;box-shadow:0 2px 12px rgba(37,99,235,.3);transition:all .2s}
    .nav-cta:hover{box-shadow:0 4px 20px rgba(37,99,235,.45);transform:translateY(-1px)}

    /* ── Hero ── */
    .hero{background:linear-gradient(160deg,#0f0f23 0%,#1a1a2e 35%,#16213e 70%,#0f3460 100%);color:#fff;padding:160px 40px 100px;text-align:center;position:relative;overflow:hidden;min-height:90vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .hero::before{content:'';position:absolute;top:-40%;right:-20%;width:80%;height:120%;background:radial-gradient(ellipse,rgba(37,99,235,.08) 0%,transparent 60%);pointer-events:none}
    .hero::after{content:'';position:absolute;bottom:-30%;left:-10%;width:60%;height:80%;background:radial-gradient(ellipse,rgba(124,58,237,.06) 0%,transparent 60%);pointer-events:none}
    .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.25);padding:6px 16px;border-radius:24px;font-size:.8rem;font-weight:600;color:#93c5fd;margin-bottom:28px;position:relative}
    .hero h1{font-size:3.2rem;font-weight:800;letter-spacing:-.04em;margin-bottom:20px;line-height:1.1;max-width:720px;position:relative}
    .hero h1 .accent{background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .hero p{font-size:1.2rem;color:rgba(255,255,255,.55);max-width:540px;margin:0 auto 40px;line-height:1.7;position:relative}
    .hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative}
    .btn-hero{padding:15px 36px;border-radius:10px;font-size:1rem;font-weight:700;transition:all .25s;border:none;cursor:pointer}
    .btn-hero-primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 4px 24px rgba(37,99,235,.35)}
    .btn-hero-primary:hover{box-shadow:0 8px 32px rgba(37,99,235,.5);transform:translateY(-2px)}
    .btn-hero-secondary{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15)}
    .btn-hero-secondary:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25)}
    .hero-sub{margin-top:20px;font-size:.82rem;color:rgba(255,255,255,.3);position:relative}
    .hero-social-proof{display:flex;align-items:center;gap:12px;margin-top:36px;position:relative}
    .hero-avatars{display:flex}
    .hero-avatars span{width:32px;height:32px;border-radius:50%;border:2px solid #1a1a2e;margin-left:-8px;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff}
    .hero-avatars span:first-child{margin-left:0}
    .hero-social-text{font-size:.82rem;color:rgba(255,255,255,.45)}

    /* ── Section shared ── */
    .section{padding:96px 40px}
    .section-tag{display:inline-block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#2563eb;background:#eff6ff;padding:5px 14px;border-radius:20px;margin-bottom:14px}
    .section-title{font-size:2rem;font-weight:800;letter-spacing:-.03em;margin-bottom:12px;line-height:1.2}
    .section-sub{color:#6b7280;font-size:1.05rem;max-width:520px;line-height:1.7}
    .section-center{text-align:center}
    .section-center .section-sub{margin:0 auto 48px}

    /* ── How it works ── */
    .steps{background:#f8f9fb}
    .steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;max-width:1000px;margin:0 auto}
    .step-card{background:#fff;border-radius:16px;padding:36px 28px;box-shadow:0 1px 4px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.03);border:1px solid #f0f1f3;position:relative;transition:all .25s}
    .step-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.08)}
    .step-num{position:absolute;top:-14px;left:24px;width:28px;height:28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-radius:50%;font-size:.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(37,99,235,.3)}
    .step-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:20px}
    .step-card h3{font-size:1.08rem;font-weight:700;margin-bottom:8px}
    .step-card p{color:#6b7280;font-size:.88rem;line-height:1.65}

    /* ── For whom (tabs) ── */
    .audience{background:#fff}
    .audience-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:40px}
    .audience-tab{padding:10px 22px;border-radius:24px;font-size:.86rem;font-weight:600;border:1px solid #e5e7eb;background:#fff;color:#6b7280;cursor:pointer;transition:all .2s}
    .audience-tab:hover{border-color:#93c5fd;color:#2563eb;background:#f0f4ff}
    .audience-tab.active{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-color:transparent;box-shadow:0 2px 12px rgba(37,99,235,.25)}
    .audience-panels{max-width:800px;margin:0 auto}
    .audience-panel{display:none;animation:fadeUp .3s ease}
    .audience-panel.active{display:block}
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .audience-content{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center}
    .audience-features{display:flex;flex-direction:column;gap:14px}
    .audience-feature{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:#f8f9fb;border-radius:10px}
    .audience-feature-icon{width:32px;height:32px;border-radius:8px;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
    .audience-feature h4{font-size:.9rem;font-weight:600;margin-bottom:2px}
    .audience-feature p{font-size:.82rem;color:#6b7280;line-height:1.5}
    .audience-example{background:linear-gradient(135deg,#f8f9fb,#f0f4ff);border:1px solid #e5e7eb;border-radius:14px;padding:24px;font-size:.84rem}
    .audience-example-title{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:12px}
    .audience-example-items{display:flex;flex-direction:column;gap:8px}
    .audience-example-item{display:flex;justify-content:space-between;padding:8px 12px;background:#fff;border-radius:8px;border:1px solid #f0f1f3}
    .audience-example-item span:first-child{color:#374151;font-weight:500}
    .audience-example-item span:last-child{color:#2563eb;font-weight:600}

    /* ── Demo screenshot ── */
    .demo{background:#f8f9fb}
    .demo-frame{max-width:900px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.04);overflow:hidden}
    .demo-bar{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:10px 20px;display:flex;align-items:center;gap:8px}
    .demo-dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.15)}
    .demo-dot:nth-child(1){background:#ff5f57}
    .demo-dot:nth-child(2){background:#ffbd2e}
    .demo-dot:nth-child(3){background:#28ca42}
    .demo-url{margin-left:12px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.4);font-size:.75rem;padding:5px 16px;border-radius:6px;flex:1;max-width:320px}
    .demo-body{display:grid;grid-template-columns:200px 1fr;min-height:420px}
    .demo-sidebar{background:#1a1a2e;padding:24px 0;color:rgba(255,255,255,.5)}
    .demo-sidebar-logo{display:flex;align-items:center;gap:8px;padding:0 20px 24px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:16px}
    .demo-sidebar-logo .ds-icon{width:24px;height:24px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff}
    .demo-sidebar-logo span{font-size:.82rem;font-weight:600;color:#fff}
    .demo-nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;font-size:.82rem;font-weight:500;transition:all .15s;cursor:default}
    .demo-nav-item.active{background:rgba(37,99,235,.15);color:#fff;border-right:2px solid #2563eb}
    .demo-nav-item svg{width:16px;height:16px;opacity:.5}
    .demo-nav-item.active svg{opacity:1}
    .demo-main{padding:28px 32px;background:#f5f6f8}
    .demo-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .demo-topbar h3{font-size:1.05rem;font-weight:700;color:#1e1e2d}
    .demo-topbar-user{display:flex;align-items:center;gap:8px;font-size:.82rem;color:#888}
    .demo-topbar-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700}
    .demo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
    .demo-stat{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .demo-stat-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:2px}
    .demo-stat-value{font-size:1.15rem;font-weight:700;color:#1e1e2d}
    .demo-card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .demo-card-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:.82rem}
    .demo-card-row:last-child{border-bottom:none}
    .demo-badge{padding:3px 10px;border-radius:12px;font-size:.68rem;font-weight:600}

    /* ── CTA finale ── */
    .final{background:linear-gradient(160deg,#0f0f23 0%,#1a1a2e 50%,#16213e 100%);color:#fff;text-align:center;padding:96px 40px;position:relative;overflow:hidden}
    .final::before{content:'';position:absolute;top:-50%;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(37,99,235,.1) 0%,transparent 60%);pointer-events:none}
    .final h2{font-size:2.2rem;font-weight:800;margin-bottom:14px;position:relative;letter-spacing:-.02em}
    .final p{color:rgba(255,255,255,.5);font-size:1.05rem;max-width:460px;margin:0 auto 36px;line-height:1.7;position:relative}
    .final .btn-hero-primary{font-size:1.05rem;padding:16px 40px}

    /* ── Footer ── */
    .footer{padding:32px 40px;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb;background:#f8f9fb}
    .footer a{color:#6b7280;font-weight:500}
    .footer a:hover{color:#2563eb}

    /* ── Responsive ── */
    @media(max-width:900px){
      .steps-grid{grid-template-columns:1fr}
      .audience-content{grid-template-columns:1fr}
      .demo-body{grid-template-columns:1fr}
      .demo-sidebar{display:none}
    }
    @media(max-width:640px){
      .nav{padding:0 20px;height:56px}
      .hero{padding:120px 20px 72px;min-height:auto}
      .hero h1{font-size:2rem}
      .hero p{font-size:1rem}
      .section{padding:64px 20px}
      .section-title{font-size:1.5rem}
      .hero-btns{flex-direction:column;align-items:center}
      .demo-frame{border-radius:12px}
      .final h2{font-size:1.6rem}
    }
  </style>
</head>
<body>

  <!-- Nav -->
  <nav class="nav" id="mainNav">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">P</div>
      <span>Preventivo AI</span>
    </a>
    <div class="nav-actions">
      <a href="/auth/login" class="nav-link">Accedi</a>
      <a href="/auth/register" class="nav-cta">Prova gratis</a>
    </div>
  </nav>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-badge">Basato su intelligenza artificiale</div>
    <h1>Crea preventivi professionali<br>in <span class="accent">30 secondi</span></h1>
    <p>L'assistente AI per consulenti, tecnici, artigiani e professionisti. Descrivi il lavoro, l'AI genera voci dettagliate con costi realistici.</p>
    <div class="hero-btns">
      <a href="/auth/register" class="btn-hero btn-hero-primary">Prova gratis &rarr;</a>
      <a href="/auth/login" class="btn-hero btn-hero-secondary">Accedi</a>
    </div>
    <div class="hero-sub">Nessuna carta di credito richiesta &middot; Piano FREE incluso</div>
    <div class="hero-social-proof">
      <div class="hero-avatars">
        <span style="background:#2563eb">M</span>
        <span style="background:#7c3aed">A</span>
        <span style="background:#059669">G</span>
        <span style="background:#dc2626">L</span>
      </div>
      <span class="hero-social-text">Usato da professionisti in tutta Italia</span>
    </div>
  </section>

  <!-- Come funziona -->
  <section class="section steps section-center">
    <span class="section-tag">Come funziona</span>
    <h2 class="section-title">Tre passaggi, un preventivo perfetto</h2>
    <p class="section-sub">Dalla descrizione al PDF in meno di un minuto, con costi calibrati per il mercato italiano.</p>
    <div class="steps-grid">
      <div class="step-card">
        <div class="step-num">1</div>
        <div class="step-icon" style="background:#eff6ff;color:#2563eb">&#9998;</div>
        <h3>Descrivi il lavoro</h3>
        <p>Scrivi in linguaggio naturale cosa devi fare. Puoi anche usare la dettatura vocale. L'AI capisce metrature, materiali e complessit&agrave;.</p>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-icon" style="background:#f0fdf4;color:#16a34a">&#9881;</div>
        <h3>L'AI genera le voci</h3>
        <p>Costi unitari, margini suggeriti e livello di confidenza per ogni riga. Tutto modificabile prima di confermare.</p>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-icon" style="background:#faf5ff;color:#7c3aed">&#128196;</div>
        <h3>Invia al cliente</h3>
        <p>Genera il PDF, condividi il link pubblico. Il cliente pu&ograve; accettare online. Tu ricevi la notifica.</p>
      </div>
    </div>
  </section>

  <!-- Per chi -->
  <section class="section audience section-center">
    <span class="section-tag">Per chi &egrave;</span>
    <h2 class="section-title">Ogni professione, voci su misura</h2>
    <p class="section-sub">L'AI adatta terminologia e struttura dei costi alla tua categoria professionale.</p>

    <div class="audience-tabs">
      <button class="audience-tab active" data-tab="consulenti">Consulenti</button>
      <button class="audience-tab" data-tab="tecnici">Tecnici</button>
      <button class="audience-tab" data-tab="artigiani">Artigiani</button>
      <button class="audience-tab" data-tab="digital">Digital</button>
      <button class="audience-tab" data-tab="sanitario">Sanitario</button>
    </div>

    <div class="audience-panels">
      <!-- Consulenti -->
      <div class="audience-panel active" id="tab-consulenti">
        <div class="audience-content">
          <div class="audience-features">
            <div class="audience-feature">
              <div class="audience-feature-icon">&#9878;</div>
              <div>
                <h4>Parcella professionale</h4>
                <p>Onorario, studio pratica, consulenza. Mai "manodopera" o "materiali".</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128203;</div>
              <div>
                <h4>Spese e bolli</h4>
                <p>Voci accessorie, diritti, bolli e contributi calcolati in automatico.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#9881;</div>
              <div>
                <h4>Cassa previdenziale</h4>
                <p>Profili fiscali con contributo cassa (4%, 2%) e IVA automatici.</p>
              </div>
            </div>
          </div>
          <div class="audience-example">
            <div class="audience-example-title">Esempio: Avvocato &mdash; Contenzioso</div>
            <div class="audience-example-items">
              <div class="audience-example-item"><span>Studio e analisi pratica</span><span>350 &euro;</span></div>
              <div class="audience-example-item"><span>Redazione atto di diffida</span><span>500 &euro;</span></div>
              <div class="audience-example-item"><span>Consulenza e assistenza</span><span>800 &euro;</span></div>
              <div class="audience-example-item"><span>Spese accessorie e bolli</span><span>120 &euro;</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tecnici -->
      <div class="audience-panel" id="tab-tecnici">
        <div class="audience-content">
          <div class="audience-features">
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128209;</div>
              <div>
                <h4>Progettazione tecnica</h4>
                <p>Rilievo, progetto, computo metrico, direzione lavori.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128196;</div>
              <div>
                <h4>Pratiche e permessi</h4>
                <p>CILA, SCIA, accatastamenti, APE — tutto nelle voci giuste.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128200;</div>
              <div>
                <h4>Sopralluoghi</h4>
                <p>Voci specifiche per sopralluogo, analisi tecnica e relazioni.</p>
              </div>
            </div>
          </div>
          <div class="audience-example">
            <div class="audience-example-title">Esempio: Geometra &mdash; CILA + Progetto</div>
            <div class="audience-example-items">
              <div class="audience-example-item"><span>Rilievo stato di fatto</span><span>400 &euro;</span></div>
              <div class="audience-example-item"><span>Progetto architettonico</span><span>1.200 &euro;</span></div>
              <div class="audience-example-item"><span>Pratica CILA</span><span>600 &euro;</span></div>
              <div class="audience-example-item"><span>Direzione lavori</span><span>800 &euro;</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Artigiani -->
      <div class="audience-panel" id="tab-artigiani">
        <div class="audience-content">
          <div class="audience-features">
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128295;</div>
              <div>
                <h4>Manodopera e materiali</h4>
                <p>Costi realistici per ore di lavoro, forniture e posa.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128666;</div>
              <div>
                <h4>Trasferta e smaltimento</h4>
                <p>Voci per spostamento, trasporto e smaltimento rifiuti incluse.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128200;</div>
              <div>
                <h4>Margini personalizzabili</h4>
                <p>Imposta margine per voce o globale. L'AI apprende dal tuo storico.</p>
              </div>
            </div>
          </div>
          <div class="audience-example">
            <div class="audience-example-title">Esempio: Idraulico &mdash; Bagno completo</div>
            <div class="audience-example-items">
              <div class="audience-example-item"><span>Rimozione sanitari</span><span>120 &euro;</span></div>
              <div class="audience-example-item"><span>Fornitura e posa sanitari</span><span>580 &euro;</span></div>
              <div class="audience-example-item"><span>Rubinetteria termostatica</span><span>250 &euro;</span></div>
              <div class="audience-example-item"><span>Manodopera installazione</span><span>400 &euro;</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Digital -->
      <div class="audience-panel" id="tab-digital">
        <div class="audience-content">
          <div class="audience-features">
            <div class="audience-feature">
              <div class="audience-feature-icon">&#127912;</div>
              <div>
                <h4>Progettazione creativa</h4>
                <p>UX/UI, concept, moodboard, sviluppo — voci chiare per il cliente.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128257;</div>
              <div>
                <h4>Revisioni e consegna</h4>
                <p>Cicli di revisione, formati di consegna e licenze ben definiti.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128187;</div>
              <div>
                <h4>Licenze e asset</h4>
                <p>Stock, font, hosting — spese tecniche separate e trasparenti.</p>
              </div>
            </div>
          </div>
          <div class="audience-example">
            <div class="audience-example-title">Esempio: Web Designer &mdash; Sito aziendale</div>
            <div class="audience-example-items">
              <div class="audience-example-item"><span>Progettazione UX/UI</span><span>800 &euro;</span></div>
              <div class="audience-example-item"><span>Sviluppo responsive</span><span>1.500 &euro;</span></div>
              <div class="audience-example-item"><span>2 cicli di revisioni</span><span>300 &euro;</span></div>
              <div class="audience-example-item"><span>Consegna e deploy</span><span>200 &euro;</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sanitario -->
      <div class="audience-panel" id="tab-sanitario">
        <div class="audience-content">
          <div class="audience-features">
            <div class="audience-feature">
              <div class="audience-feature-icon">&#129657;</div>
              <div>
                <h4>Visite e trattamenti</h4>
                <p>Sedute, visite specialistiche, piani di trattamento strutturati.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128300;</div>
              <div>
                <h4>Esami diagnostici</h4>
                <p>Radiografie, analisi, ecografie — con costi di riferimento.</p>
              </div>
            </div>
            <div class="audience-feature">
              <div class="audience-feature-icon">&#128138;</div>
              <div>
                <h4>Materiali sanitari</h4>
                <p>Monouso, protesi, dispositivi medici come voci separate.</p>
              </div>
            </div>
          </div>
          <div class="audience-example">
            <div class="audience-example-title">Esempio: Odontoiatra &mdash; Impianto</div>
            <div class="audience-example-items">
              <div class="audience-example-item"><span>Prima visita + panoramica</span><span>80 &euro;</span></div>
              <div class="audience-example-item"><span>Impianto dentale</span><span>1.200 &euro;</span></div>
              <div class="audience-example-item"><span>Corona in ceramica</span><span>600 &euro;</span></div>
              <div class="audience-example-item"><span>Controlli post-intervento</span><span>150 &euro;</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Demo screenshot -->
  <section class="section demo section-center">
    <span class="section-tag">La piattaforma</span>
    <h2 class="section-title">Dashboard professionale</h2>
    <p class="section-sub">Tutto sotto controllo: preventivi, statistiche, clienti. Un'interfaccia pensata per lavorare veloce.</p>
    <div class="demo-frame">
      <div class="demo-bar">
        <span class="demo-dot"></span><span class="demo-dot"></span><span class="demo-dot"></span>
        <span class="demo-url">app.preventivoai.it/dashboard</span>
      </div>
      <div class="demo-body">
        <div class="demo-sidebar">
          <div class="demo-sidebar-logo">
            <div class="ds-icon">P</div>
            <span>Preventivo AI</span>
          </div>
          <div class="demo-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Dashboard
          </div>
          <div class="demo-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Nuovo preventivo
          </div>
          <div class="demo-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Listino prezzi
          </div>
          <div class="demo-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profilo
          </div>
        </div>
        <div class="demo-main">
          <div class="demo-topbar">
            <h3>Ciao, Marco</h3>
            <div class="demo-topbar-user">
              <div class="demo-topbar-avatar">M</div>
              Marco R.
            </div>
          </div>
          <div class="demo-stats">
            <div class="demo-stat"><div class="demo-stat-label">Totali</div><div class="demo-stat-value">12</div></div>
            <div class="demo-stat"><div class="demo-stat-label">Accettati</div><div class="demo-stat-value">8</div></div>
            <div class="demo-stat"><div class="demo-stat-label">Fatturato</div><div class="demo-stat-value">14.250 &euro;</div></div>
          </div>
          <div class="demo-card">
            <div class="demo-card-row"><span style="font-weight:600">Ristrutturazione bagno &mdash; Mario B.</span><span><span class="demo-badge" style="background:#d4edda;color:#155724">Accettato</span></span></div>
            <div class="demo-card-row"><span style="font-weight:600">Impianto elettrico &mdash; Laura G.</span><span><span class="demo-badge" style="background:#cce5ff;color:#004085">Inviato</span></span></div>
            <div class="demo-card-row"><span style="font-weight:600">Consulenza legale &mdash; Andrea M.</span><span><span class="demo-badge" style="background:#fff3cd;color:#856404">Bozza</span></span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA finale -->
  <section class="final">
    <h2>Crea il tuo primo preventivo</h2>
    <p>Registrati in 30 secondi. Piano gratuito incluso, nessuna carta di credito richiesta.</p>
    <a href="/auth/register" class="btn-hero btn-hero-primary">Registrati gratis &rarr;</a>
  </section>

  <!-- Footer -->
  <footer class="footer">
    &copy; 2026 Preventivo AI &mdash; <a href="/auth/login">Accedi</a> &middot; <a href="/auth/register">Registrati</a>
  </footer>

  <script>
  (function(){
    // Nav scroll effect
    var nav = document.getElementById('mainNav');
    window.addEventListener('scroll', function(){
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });

    // Audience tabs
    var tabs = document.querySelectorAll('.audience-tab');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        tabs.forEach(function(t){ t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.audience-panel').forEach(function(p){ p.classList.remove('active'); });
        var target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  })();
  </script>

</body>
</html>`);
});

module.exports = router;
