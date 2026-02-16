// src/routes/newQuote.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { getUserById, saveQuote, getQuoteById, updateQuote, deleteQuote } = require("../utils/storage");
const claude = require("../utils/claude");
const pricingEngine = require("../utils/pricingEngine");
const feedback = require("../utils/feedback");
const itemLibrary = require("../utils/itemLibrary");
const requirePlan = require("../middleware/requirePlan");
const { getUserPrompt } = require("../utils/userPrompts");
const { page, esc, fmt } = require("../utils/layout");
const { sendOrLog } = require("../utils/mailer");
const { buildQuoteEmailHTML } = require("../utils/emailTemplates");
const path = require("path");
const fs = require("fs");

// ── Load professions and tax profiles ──
const professions = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/professions.json"), "utf-8"));
const taxProfiles = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tax_profiles.json"), "utf-8"));

// ── GET /quotes/item-search — Autocomplete voci ──

router.get("/item-search", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Non autenticato" });

  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ success: true, items: [] });

  const items = itemLibrary.searchItems(user.id, user.priceList || [], q);
  res.json({ success: true, items });
});

// ── POST /quotes/re-estimate-row — Ri-stima singola voce ──

router.post("/re-estimate-row", requirePlan, async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Non autenticato" });

  const { description, user_input, pricing_preset } = req.body;
  if (!description || !user_input) {
    return res.status(400).json({ success: false, error: "Descrizione e input utente obbligatori" });
  }

  try {
    const result = await claude.reEstimateSingleItem({
      user_id: user.id,
      professional: { name: user.name, category: user.category, city: user.city },
      description,
      user_input,
      pricing_preset: pricing_preset || "standard"
    });

    const processed = pricingEngine.processAiSuggestions([result])[0];
    res.json({ success: true, item: processed });
  } catch (err) {
    console.error("Re-estimate error:", err.message);
    res.status(500).json({ success: false, error: "Errore durante la ri-stima" });
  }
});

// ── GET /quotes/new — Wizard 3 step ──

router.get("/new", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  // Category placeholders for Step 2
  const categoryPlaceholders = {
    idraulico: "Es. Ristrutturazione completa bagno 8mq: sostituzione tubazioni, installazione sanitari sospesi Ideal Standard, piatto doccia 80x120, rubinetteria termostatica...",
    elettricista: "Es. Rifacimento impianto elettrico appartamento 90mq: nuovo quadro elettrico, 25 punti luce, 15 prese, predisposizione domotica, certificazione...",
    edilizia: "Es. Ristrutturazione cucina 12mq: demolizione e rifacimento massetto, posa pavimento gres 60x60, rasatura e tinteggiatura pareti, controsoffitto in cartongesso...",
    imbianchino: "Es. Tinteggiatura appartamento 100mq: rasatura pareti e soffitti, due mani di pittura lavabile, velatura decorativa parete soggiorno, stuccatura crepe...",
    falegname: "Es. Realizzazione armadio a muro su misura 280x300cm: struttura in multistrato, ante scorrevoli con specchio, ripiani interni, cassettiera, illuminazione LED...",
    giardiniere: "Es. Progettazione e realizzazione giardino 200mq: impianto irrigazione automatico 6 zone, posa prato a rotoli, aiuole con piante mediterranee, vialetto in pietra...",
    altro: "Descrivi il lavoro nel modo più dettagliato possibile: tipo di intervento, metrature, materiali desiderati, specifiche tecniche..."
  };

  // User's category for auto-selection
  const userCategory = user.category || "";

  // Build profession <option> groups
  const professionOptions = professions.categories.map(cat =>
    `<optgroup label="${esc(cat.group)}">${cat.items.map(p =>
      `<option value="${esc(p)}"${userCategory === p ? " selected" : ""}>${esc(p.charAt(0).toUpperCase() + p.slice(1))}</option>`
    ).join("")}</optgroup>`
  ).join("");

  // Build tax profile <option> list
  const userTaxProfile = user.taxProfile || "ordinario_22";
  const taxProfileOptions = taxProfiles.map(tp =>
    `<option value="${esc(tp.id)}"${userTaxProfile === tp.id ? " selected" : ""}>${esc(tp.name)}</option>`
  ).join("");

  const extraCss = `
    /* ── Stepper ── */
    .stepper{display:flex;justify-content:center;gap:0;margin-bottom:36px;position:relative}
    .step-item{display:flex;align-items:center;gap:0}
    .step-circle{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.88rem;border:2.5px solid #e2e4e8;color:#aaa;background:#fff;transition:all .3s;position:relative;z-index:1}
    .step-circle.active{border-color:#2563eb;color:#fff;background:linear-gradient(135deg,#2563eb,#1d4ed8);box-shadow:0 2px 8px rgba(37,99,235,.3)}
    .step-circle.done{border-color:#22c55e;color:#fff;background:#22c55e}
    .step-label{font-size:.74rem;color:#aaa;text-align:center;margin-top:8px;font-weight:500;transition:color .3s}
    .step-label.active{color:#2563eb;font-weight:600}
    .step-label.done{color:#22c55e}
    .step-line{width:70px;height:2.5px;background:#e2e4e8;align-self:center;margin:0 6px;transition:background .3s;border-radius:2px}
    .step-line.done{background:#22c55e}
    .step-col{display:flex;flex-direction:column;align-items:center}

    /* ── Pannelli step ── */
    .step-panel{display:none;animation:fadeIn .3s ease}
    .step-panel.active{display:block}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    /* ── Step 2 enhancements ── */
    .desc-wrap{position:relative}
    .desc-wrap textarea{padding-right:52px}
    .voice-btn{position:absolute;right:10px;top:38px;width:36px;height:36px;border-radius:50%;border:none;background:#f0f1f3;color:#666;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;font-size:1.1rem}
    .voice-btn:hover{background:#e4e5e9;color:#2563eb}
    .voice-btn.recording{background:#ef4444;color:#fff;animation:pulse-rec 1.2s ease-in-out infinite}
    @keyframes pulse-rec{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
    .char-counter{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:.75rem;color:#9ca3af}
    .char-counter .count{font-weight:500}
    .char-counter .count.good{color:#22c55e}
    .char-counter .count.short{color:#f59e0b}
    .suggestion-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
    .suggestion-chip{padding:5px 12px;border-radius:20px;font-size:.76rem;background:#f0f4ff;color:#2563eb;border:1px solid #dbeafe;cursor:pointer;transition:all .15s;font-weight:500}
    .suggestion-chip:hover{background:#dbeafe;border-color:#93c5fd}

    /* ── Preview card layout (Step 3) ── */
    .preview-section{margin-top:20px}
    .job-summary{background:linear-gradient(135deg,#f0f4ff,#f8f9ff);border:1px solid #dbeafe;border-radius:10px;padding:16px 20px;margin-bottom:20px}
    .job-summary-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px;font-weight:600}
    .job-summary-text{font-size:.9rem;color:#1e1e2d;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .client-summary{display:flex;align-items:center;gap:10px;background:#f8f9fb;border-radius:10px;padding:12px 18px;margin-bottom:16px;font-size:.88rem}
    .client-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem}

    /* ── Item cards ── */
    .item-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
    .item-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;transition:all .2s}
    .item-card:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .item-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
    .item-card-desc{flex:1}
    .item-card-desc input{border:1px solid transparent;background:transparent;padding:4px 8px;border-radius:6px;font-size:.9rem;font-family:inherit;font-weight:500;width:100%;transition:all .15s;color:#1e1e2d}
    .item-card-desc input:hover{border-color:#e5e7eb;background:#f9fafb}
    .item-card-desc input:focus{border-color:#2563eb;outline:none;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
    .item-card-actions{display:flex;gap:2px;flex-shrink:0}
    .item-card-actions button{background:none;border:none;cursor:pointer;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#9ca3af;transition:all .15s;font-size:.88rem}
    .item-card-actions button:hover{color:#2563eb;background:#f0f4ff}
    .item-card-fields{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px}
    @media(max-width:640px){.item-card-fields{grid-template-columns:1fr 1fr;gap:6px}}
    .item-field{display:flex;flex-direction:column}
    .item-field-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:3px;font-weight:600}
    .item-field input{border:1px solid #e5e7eb;background:#f9fafb;padding:7px 10px;border-radius:6px;font-size:.85rem;font-family:inherit;text-align:right;transition:all .15s;width:100%}
    .item-field input:focus{border-color:#2563eb;outline:none;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
    .item-field .subtotal-value{padding:7px 10px;font-size:.9rem;font-weight:600;color:#1e1e2d;text-align:right}
    .item-card-badge{margin-top:8px}

    /* ── Modified input highlight ── */
    .item-field input.modified{background:#fffde7;border-color:#f59e0b}

    /* ── Confidence badges ── */
    .conf-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;cursor:help}
    .conf-badge.high{background:#ecfdf5;color:#065f46}
    .conf-badge.medium{background:#fffbeb;color:#92400e}
    .conf-badge.low{background:#fef2f2;color:#991b1b}
    .conf-badge-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .conf-badge.high .conf-badge-dot{background:#22c55e}
    .conf-badge.medium .conf-badge-dot{background:#f59e0b}
    .conf-badge.low .conf-badge-dot{background:#ef4444}

    /* ── Needs input row ── */
    .needs-input-bar{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;gap:8px;font-size:.82rem;flex-wrap:wrap}
    .needs-input-bar input{border:1px solid #fde68a;background:#fff;padding:5px 10px;border-radius:6px;font-size:.82rem;font-family:inherit;flex:1;min-width:160px}
    .needs-input-bar input:focus{border-color:#f59e0b;outline:none}
    .needs-input-bar button{padding:5px 14px;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid #f59e0b;background:#fef3c7;color:#92400e;transition:all .15s;white-space:nowrap}
    .needs-input-bar button:hover{background:#fde68a}

    /* ── Totals block ── */
    .totals-card{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 24px;color:#fff;margin-bottom:20px}
    .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)}
    .totals-row.grand{font-size:1.35rem;font-weight:700;color:#fff;border-top:1px solid rgba(255,255,255,.15);padding-top:12px;margin-top:8px}

    .notes-box{background:#f8f9fb;border-left:3px solid #2563eb;padding:14px 18px;border-radius:0 8px 8px 0;font-size:.9rem;line-height:1.6;margin-bottom:20px}

    /* ── Loading overlay ── */
    .loading{display:none;text-align:center;padding:48px 24px}
    .loading.active{display:block}
    .spinner{width:44px;height:44px;border:3px solid rgba(37,99,235,.15);border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .loading p{color:#888;font-size:.9rem}
    .loading-dots{display:inline-flex;gap:4px;margin-top:12px}
    .loading-dots span{width:6px;height:6px;background:#2563eb;border-radius:50%;animation:bounce .6s ease-in-out infinite}
    .loading-dots span:nth-child(2){animation-delay:.1s}
    .loading-dots span:nth-child(3){animation-delay:.2s}
    @keyframes bounce{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}

    /* ── Azioni ── */
    .step-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:24px}

    /* ── Barra azioni sopra cards ── */
    .table-actions{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
    .table-actions button{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;border:1px solid #e2e4e8;background:#fff;color:#444;transition:all .15s}
    .table-actions button:hover{background:#f0f4ff;border-color:#2563eb;color:#2563eb}
    .table-actions button svg{width:14px;height:14px}

    /* ── Autocomplete dropdown ── */
    .ac-wrap{position:relative}
    .ac-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #d1d5db;border-radius:0 0 8px 8px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:50;max-height:220px;overflow-y:auto;display:none}
    .ac-dropdown.open{display:block}
    .ac-item{padding:10px 14px;cursor:pointer;font-size:.82rem;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;transition:background .1s}
    .ac-item:hover{background:#f0f4ff}
    .ac-source{font-size:.7rem;color:#888;white-space:nowrap}
  `;

  const content = `
  <div class="wrap" style="max-width:740px">
    <div class="card" style="padding:36px">

      <!-- Stepper -->
      <div class="stepper">
        <div class="step-col">
          <div class="step-circle active" id="sc1">1</div>
          <div class="step-label active" id="sl1">Cliente</div>
        </div>
        <div class="step-line" id="line1"></div>
        <div class="step-col">
          <div class="step-circle" id="sc2">2</div>
          <div class="step-label" id="sl2">Lavoro</div>
        </div>
        <div class="step-line" id="line2"></div>
        <div class="step-col">
          <div class="step-circle" id="sc3">3</div>
          <div class="step-label" id="sl3">Anteprima</div>
        </div>
      </div>

      <div id="error" class="alert alert-error" style="display:none"></div>

      <!-- STEP 1: Cliente -->
      <div class="step-panel active" id="panel1">
        <h2 style="font-size:1.15rem;margin-bottom:4px;font-weight:700">Chi è il tuo cliente?</h2>
        <p style="color:#888;font-size:.85rem;margin-bottom:24px">Inserisci i dati di contatto del cliente a cui vuoi inviare il preventivo.</p>

        <div class="field">
          <label for="clientName">Nome e cognome</label>
          <input type="text" id="clientName" required placeholder="es. Mario Bianchi">
        </div>
        <div class="field">
          <label for="clientEmail">Email</label>
          <input type="email" id="clientEmail" required placeholder="es. mario@email.com">
        </div>

        <div class="step-actions">
          <button class="btn btn-primary" id="toStep2">Avanti</button>
          <a href="/dashboard" class="btn btn-secondary">Annulla</a>
        </div>
      </div>

      <!-- STEP 2: Lavoro -->
      <div class="step-panel" id="panel2">
        <h2 style="font-size:1.15rem;margin-bottom:4px;font-weight:700">Descrivi il lavoro</h2>
        <p style="color:#888;font-size:.85rem;margin-bottom:24px">Più dettagli inserisci, più il preventivo sarà preciso e professionale.</p>

        <div class="field">
          <label for="profession">Professione</label>
          <select id="profession">
            <option value="">Seleziona professione</option>
            ${professionOptions}
          </select>
        </div>

        <div class="field desc-wrap">
          <label for="desc">Descrizione del lavoro</label>
          <textarea id="desc" required placeholder="${esc(categoryPlaceholders[userCategory] || categoryPlaceholders.altro)}" style="min-height:160px"></textarea>
          <button type="button" class="voice-btn" id="voiceBtn" title="Dettatura vocale">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <div class="char-counter">
            <span id="charHint">Minimo raccomandato: 50 caratteri</span>
            <span class="count" id="charCount">0</span>
          </div>
          <div class="suggestion-chips" id="suggestionChips"></div>
        </div>

        <div class="field">
          <label for="taxProfile">Profilo fiscale</label>
          <select id="taxProfile">
            ${taxProfileOptions}
          </select>
          <div class="hint" id="taxProfileNote"></div>
        </div>

        <div class="field">
          <label for="paymentTerms">Modalità di pagamento</label>
          <select id="paymentTerms">
            <option value="bonifico_30">Bonifico bancario a 30 giorni</option>
            <option value="bonifico_immediato">Bonifico bancario immediato</option>
            <option value="acconto_50">50% acconto + saldo a fine lavori</option>
            <option value="acconto_30">30% acconto + saldo a fine lavori</option>
            <option value="rata_30_60_90">Rata 30/60/90 giorni</option>
            <option value="fine_lavori">Pagamento a fine lavori</option>
            <option value="contanti">Contanti alla consegna</option>
          </select>
        </div>

        <div class="step-actions">
          <button class="btn btn-primary" id="generateBtn">Genera preventivo</button>
          <button class="btn btn-secondary" id="backTo1">Indietro</button>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading" id="loadingPanel">
        <div class="spinner"></div>
        <p>Generazione in corso...</p>
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>

      <!-- STEP 3: Anteprima -->
      <div class="step-panel" id="panel3">
        <h2 style="font-size:1.15rem;margin-bottom:4px;font-weight:700">Anteprima del preventivo</h2>
        <p style="color:#888;font-size:.85rem;margin-bottom:20px">Modifica costi e margini cliccando sui valori. I prezzi si aggiornano in automatico.</p>

        <!-- Riepilogo cliente -->
        <div class="client-summary">
          <div class="client-avatar" id="clientAvatar"></div>
          <div>
            <div style="font-weight:600" id="summaryClient"></div>
            <div style="font-size:.8rem;color:#888" id="summaryEmail"></div>
          </div>
        </div>

        <!-- Riepilogo lavoro -->
        <div class="job-summary">
          <div class="job-summary-label">Descrizione lavoro</div>
          <div class="job-summary-text" id="summaryJob"></div>
        </div>

        <!-- Barra azioni -->
        <div class="table-actions">
          <button type="button" id="addRowBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi voce
          </button>
          <button type="button" id="marginAllBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Margine % a tutte
          </button>
          <button type="button" id="exportCsvBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>

        <!-- Card voci -->
        <div class="preview-section">
          <div class="item-cards" id="lineItems"></div>

          <div id="totalsCard" class="totals-card">
            <div class="totals-row"><span>Imponibile</span><span id="subtotal"></span></div>
            <div class="totals-row" id="cassaRow" style="display:none"><span>Contributo cassa 4%</span><span id="cassaAmount"></span></div>
            <div class="totals-row"><span id="ivaLabel">IVA 22%</span><span id="taxes"></span></div>
            <div class="totals-row grand"><span>Totale</span><span id="total"></span></div>
          </div>

          <div id="generationBadge" style="text-align:center;margin-top:16px">
            <span id="genBadgeText" style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:.78rem;font-weight:600;letter-spacing:.02em"></span>
          </div>
        </div>

        <div class="step-actions">
          <button class="btn btn-primary" id="confirmBtn">Conferma e salva</button>
          <button class="btn btn-secondary" id="backTo2">Modifica descrizione</button>
        </div>
      </div>

    </div>
  </div>`;

  const script = `
  (function() {
    var currentStep = 1;
    var previewData = null;
    var localItems = [];
    var acTimer = null;

    var panels = [null, document.getElementById('panel1'), document.getElementById('panel2'), document.getElementById('panel3')];
    var circles = [null, document.getElementById('sc1'), document.getElementById('sc2'), document.getElementById('sc3')];
    var labels = [null, document.getElementById('sl1'), document.getElementById('sl2'), document.getElementById('sl3')];
    var lines = [null, document.getElementById('line1'), document.getElementById('line2')];
    var loadingPanel = document.getElementById('loadingPanel');
    var errEl = document.getElementById('error');

    // ── Category placeholders ──
    var categoryPlaceholders = ${JSON.stringify(categoryPlaceholders)};

    // ── Tax profiles data ──
    var taxProfilesData = ${JSON.stringify(taxProfiles)};

    // ── Map profession → category for placeholders/chips ──
    var professionToCategory = {
      idraulico: 'idraulico', elettricista: 'elettricista', muratore: 'edilizia',
      falegname: 'falegname', imbianchino: 'imbianchino', fabbro: 'edilizia',
      piastrellista: 'edilizia', giardiniere: 'giardiniere', serramentista: 'falegname'
    };

    // ── Suggestion chips per category ──
    var categorySuggestions = {
      idraulico: ["metratura bagno/cucina", "tipo sanitari", "marca rubinetteria", "tubazioni da sostituire", "scarichi da rifare"],
      elettricista: ["numero punti luce", "prese da installare", "tipo quadro elettrico", "domotica", "certificazione"],
      edilizia: ["metratura locale", "tipo pavimento", "demolizioni necessarie", "cartongesso", "isolamento"],
      imbianchino: ["metratura pareti", "numero stanze", "tipo pittura", "rasatura necessaria", "colori desiderati"],
      falegname: ["dimensioni mobili", "tipo legno", "ante/cassetti", "ferramenta", "finitura desiderata"],
      giardiniere: ["metratura giardino", "impianto irrigazione", "tipo prato", "piante desiderate", "illuminazione esterna"],
      altro: ["metratura", "materiali preferiti", "tempistiche desiderate", "budget indicativo"]
    };

    function getCategoryFromProfession() {
      var prof = document.getElementById('profession').value;
      return professionToCategory[prof] || 'altro';
    }

    function updateSuggestionChips() {
      var cat = getCategoryFromProfession();
      var chips = categorySuggestions[cat] || categorySuggestions.altro;
      var container = document.getElementById('suggestionChips');
      container.innerHTML = chips.map(function(chip) {
        return '<span class="suggestion-chip" data-chip="' + escHtml(chip) + '">' + escHtml(chip) + '</span>';
      }).join('');
    }

    function getSelectedTaxProfile() {
      var id = document.getElementById('taxProfile').value;
      for (var i = 0; i < taxProfilesData.length; i++) {
        if (taxProfilesData[i].id === id) return taxProfilesData[i];
      }
      return taxProfilesData[0];
    }

    function updateTaxProfileNote() {
      var tp = getSelectedTaxProfile();
      var noteEl = document.getElementById('taxProfileNote');
      noteEl.textContent = tp.note || '';
    }

    // ── Payment terms labels ──
    var paymentLabels = {
      bonifico_30: 'Bonifico bancario a 30 giorni',
      bonifico_immediato: 'Bonifico bancario immediato',
      acconto_50: '50% acconto + saldo a fine lavori',
      acconto_30: '30% acconto + saldo a fine lavori',
      rata_30_60_90: 'Rata 30/60/90 giorni',
      fine_lavori: 'Pagamento a fine lavori',
      contanti: 'Contanti alla consegna'
    };

    function getPaymentTermsLabel() {
      var val = document.getElementById('paymentTerms').value;
      return paymentLabels[val] || val;
    }

    // Init chips + tax note
    updateSuggestionChips();
    updateTaxProfileNote();

    // Chip click → append to textarea
    document.getElementById('suggestionChips').addEventListener('click', function(e) {
      var chip = e.target.closest('.suggestion-chip');
      if (!chip) return;
      var desc = document.getElementById('desc');
      var text = chip.getAttribute('data-chip');
      if (desc.value.trim()) {
        desc.value += ', ' + text;
      } else {
        desc.value = text + ': ';
      }
      desc.focus();
      updateCharCounter();
    });

    // Profession change → update placeholder & chips
    document.getElementById('profession').addEventListener('change', function() {
      var cat = getCategoryFromProfession();
      var desc = document.getElementById('desc');
      desc.placeholder = categoryPlaceholders[cat] || categoryPlaceholders.altro;
      updateSuggestionChips();
    });

    // Tax profile change → update note
    document.getElementById('taxProfile').addEventListener('change', function() {
      updateTaxProfileNote();
      // If preview is already rendered, recalc totals
      if (previewData) updateTotalsDisplay();
    });

    // ── Character counter ──
    function updateCharCounter() {
      var len = document.getElementById('desc').value.length;
      var counter = document.getElementById('charCount');
      var hint = document.getElementById('charHint');
      counter.textContent = len;
      if (len >= 50) {
        counter.className = 'count good';
        hint.textContent = 'Ottimo livello di dettaglio';
      } else {
        counter.className = 'count short';
        hint.textContent = 'Minimo raccomandato: 50 caratteri';
      }
    }
    document.getElementById('desc').addEventListener('input', updateCharCounter);

    // ── Voice input (Web Speech API) ──
    var voiceBtn = document.getElementById('voiceBtn');
    var recognition = null;
    var isRecording = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.continuous = true;
      recognition.interimResults = true;

      var finalTranscript = '';

      recognition.onresult = function(event) {
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        // Append final results to textarea
        if (finalTranscript) {
          var desc = document.getElementById('desc');
          var existing = desc.value;
          if (existing && !existing.endsWith(' ') && !existing.endsWith('\\n')) {
            desc.value = existing + ' ' + finalTranscript;
          } else {
            desc.value = existing + finalTranscript;
          }
          finalTranscript = '';
          updateCharCounter();
        }
      };

      recognition.onerror = function() {
        stopRecording();
      };

      recognition.onend = function() {
        if (isRecording) {
          // Auto-restart if still recording
          try { recognition.start(); } catch(e) { stopRecording(); }
        }
      };

      voiceBtn.addEventListener('click', function() {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      });
    } else {
      voiceBtn.style.display = 'none';
    }

    function startRecording() {
      if (!recognition) return;
      isRecording = true;
      finalTranscript = '';
      voiceBtn.classList.add('recording');
      voiceBtn.title = 'Interrompi dettatura';
      try { recognition.start(); } catch(e) {}
    }

    function stopRecording() {
      isRecording = false;
      voiceBtn.classList.remove('recording');
      voiceBtn.title = 'Dettatura vocale';
      if (recognition) try { recognition.stop(); } catch(e) {}
    }

    function goToStep(n) {
      errEl.style.display = 'none';
      loadingPanel.classList.remove('active');

      for (var i = 1; i <= 3; i++) {
        panels[i].classList.remove('active');
        circles[i].classList.remove('active', 'done');
        labels[i].classList.remove('active', 'done');
      }
      for (var j = 1; j <= 2; j++) {
        lines[j].classList.remove('done');
      }

      for (var i = 1; i < n; i++) {
        circles[i].classList.add('done');
        circles[i].innerHTML = '&#10003;';
        labels[i].classList.add('done');
        if (lines[i]) lines[i].classList.add('done');
      }
      circles[n].classList.add('active');
      circles[n].textContent = n;
      labels[n].classList.add('active');
      for (var i = n + 1; i <= 3; i++) {
        circles[i].textContent = i;
      }

      panels[n].classList.add('active');
      currentStep = n;
    }

    // Step 1 → 2
    document.getElementById('toStep2').addEventListener('click', function() {
      var name = document.getElementById('clientName').value.trim();
      var email = document.getElementById('clientEmail').value.trim();
      if (!name) { showError('Inserisci il nome del cliente'); return; }
      if (!email || !email.includes('@')) { showError('Inserisci un indirizzo email valido'); return; }
      goToStep(2);
    });

    // Step 2 → back to 1
    document.getElementById('backTo1').addEventListener('click', function() {
      goToStep(1);
    });

    // Step 2 → Generate (loading → step 3)
    document.getElementById('generateBtn').addEventListener('click', function() {
      var desc = document.getElementById('desc').value.trim();
      if (!desc) { showError('Inserisci la descrizione del lavoro'); return; }

      // Stop recording if active
      if (isRecording) stopRecording();

      errEl.style.display = 'none';
      panels[2].classList.remove('active');
      loadingPanel.classList.add('active');

      var body = {
        job_description: desc,
        pricing_preset: 'standard',
        profession: document.getElementById('profession').value,
        tax_profile_id: document.getElementById('taxProfile').value,
        payment_terms: getPaymentTermsLabel()
      };

      fetch('/quotes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          previewData = data;
          localItems = data.preview.line_items.map(function(it) {
            return {
              description: it.description,
              quantity: it.quantity || 1,
              unit_cost: it.unit_cost || 0,
              margin_percent: it.margin_percent || 0,
              unit_price: it.unit_price || 0,
              subtotal: it.subtotal || 0,
              confidence: it.confidence || null,
              explanation: it.explanation || null,
              needs_input: it.needs_input || false,
              ai_suggested: it.ai_suggested || null
            };
          });
          renderPreview();
          goToStep(3);
        } else {
          loadingPanel.classList.remove('active');
          panels[2].classList.add('active');
          showError(data.error || data.detail || 'Errore durante la generazione');
        }
      })
      .catch(function() {
        loadingPanel.classList.remove('active');
        panels[2].classList.add('active');
        showError('Errore di rete. Riprova.');
      });
    });

    // Step 3 → back to 2
    document.getElementById('backTo2').addEventListener('click', function() {
      goToStep(2);
    });

    // Step 3 → Confirm
    document.getElementById('confirmBtn').addEventListener('click', function() {
      var btn = document.getElementById('confirmBtn');
      btn.disabled = true;
      btn.textContent = 'Salvataggio in corso...';
      errEl.style.display = 'none';

      var tp = getSelectedTaxProfile();
      var sub = calcSubtotal();
      var cassaAmount = tp.previdenza_percent ? round2(sub * tp.previdenza_percent / 100) : 0;
      var taxableForIva = round2(sub + cassaAmount);
      var tax = round2(taxableForIva * tp.iva_percent / 100);

      var body = {
        job_description: previewData.job_description,
        pricing_preset: previewData.pricing_preset || 'standard',
        ai_generated: previewData.ai_generated,
        profession: document.getElementById('profession').value,
        tax_profile: tp,
        client: {
          name: document.getElementById('clientName').value.trim(),
          email: document.getElementById('clientEmail').value.trim()
        },
        preview: {
          line_items: localItems,
          subtotal: sub,
          cassa: cassaAmount,
          taxes: tax,
          total: round2(sub + cassaAmount + tax),
          currency: previewData.preview.currency || 'EUR',
          payment_terms: getPaymentTermsLabel(),
          validity_days: previewData.preview.validity_days || 14,
          notes: previewData.preview.notes || null
        }
      };

      fetch('/quotes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.success) {
          window.location.href = '/dashboard';
        } else {
          showError(result.error || 'Errore durante il salvataggio');
          btn.disabled = false;
          btn.textContent = 'Conferma e salva';
        }
      })
      .catch(function() {
        showError('Errore di rete. Riprova.');
        btn.disabled = false;
        btn.textContent = 'Conferma e salva';
      });
    });

    // ── Render preview with card layout ──
    function renderPreview() {
      var p = previewData.preview;

      // Client summary
      var clientName = document.getElementById('clientName').value;
      var clientEmail = document.getElementById('clientEmail').value;
      document.getElementById('summaryClient').textContent = clientName;
      document.getElementById('summaryEmail').textContent = clientEmail;
      document.getElementById('clientAvatar').textContent = clientName.charAt(0).toUpperCase();

      // Job summary
      document.getElementById('summaryJob').textContent = document.getElementById('desc').value;

      var container = document.getElementById('lineItems');
      container.innerHTML = '';

      localItems.forEach(function(item, idx) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-idx', idx);

        // Store AI originals for diff
        if (item.ai_suggested) {
          card.setAttribute('data-ai-cost', item.ai_suggested.unit_cost);
          card.setAttribute('data-ai-margin', item.ai_suggested.margin_percent);
        }

        // Confidence badge HTML
        var confHtml = '';
        if (item.confidence) {
          var confLabels = { high: 'Alta', medium: 'Media', low: 'Bassa' };
          confHtml = '<span class="conf-badge ' + item.confidence + '" title="' + escHtml(item.explanation || '') + '">' +
            '<span class="conf-badge-dot"></span>' +
            'Stima: ' + (confLabels[item.confidence] || item.confidence) +
            '</span>';
        }

        card.innerHTML =
          '<div class="item-card-header">' +
            '<div class="item-card-desc ac-wrap">' +
              '<input type="text" class="prev-desc" data-idx="' + idx + '" value="' + escHtml(item.description) + '" placeholder="Descrizione voce...">' +
              '<div class="ac-dropdown" id="ac-' + idx + '"></div>' +
            '</div>' +
            '<div class="item-card-actions">' +
              '<button type="button" title="Duplica" onclick="window._dupRow(' + idx + ')">&#x2398;</button>' +
              '<button type="button" title="Elimina" onclick="window._delRow(' + idx + ')">&#x2715;</button>' +
              (item.ai_suggested ? '<button type="button" title="Ripristina AI" onclick="window._resetRow(' + idx + ')">&#x21ba;</button>' : '') +
            '</div>' +
          '</div>' +
          '<div class="item-card-fields">' +
            '<div class="item-field">' +
              '<span class="item-field-label">Quantità</span>' +
              '<input type="number" class="prev-qty" data-idx="' + idx + '" value="' + item.quantity + '" min="1" step="1">' +
            '</div>' +
            '<div class="item-field">' +
              '<span class="item-field-label">Costo</span>' +
              '<input type="number" class="prev-cost" data-idx="' + idx + '" value="' + item.unit_cost + '" min="0" step="0.01">' +
            '</div>' +
            '<div class="item-field">' +
              '<span class="item-field-label">Margine %</span>' +
              '<input type="number" class="prev-margin" data-idx="' + idx + '" value="' + item.margin_percent + '" min="0" max="90" step="0.1">' +
            '</div>' +
            '<div class="item-field">' +
              '<span class="item-field-label">Prezzo unit.</span>' +
              '<input type="number" class="prev-price" data-idx="' + idx + '" value="' + item.unit_price + '" min="0" step="0.01">' +
            '</div>' +
            '<div class="item-field">' +
              '<span class="item-field-label">Subtotale</span>' +
              '<div class="subtotal-value prev-subtotal">' + fmtNum(item.subtotal) + ' &euro;</div>' +
            '</div>' +
          '</div>' +
          (confHtml ? '<div class="item-card-badge">' + confHtml + '</div>' : '');

        container.appendChild(card);

        // Apply diff styling
        applyDiff(card, item);

        // needs_input bar
        if (item.needs_input || item.confidence === 'low') {
          var niDiv = document.createElement('div');
          niDiv.className = 'needs-input-bar';
          niDiv.setAttribute('data-ni-idx', idx);
          niDiv.innerHTML =
            '<span>&#9888; Stima incerta</span>' +
            '<input type="text" class="ni-input" data-idx="' + idx + '" placeholder="Aggiungi dettagli per migliorare la stima...">' +
            '<button type="button" onclick="window._reEstimate(' + idx + ',this)">Ricalcola</button>';
          card.appendChild(niDiv);
        }
      });

      updateTotalsDisplay();

      // Badge tipo generazione
      var badge = document.getElementById('genBadgeText');
      if (previewData.has_user_profile) {
        badge.textContent = 'Suggerimento personalizzato';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#065f46';
      } else {
        badge.textContent = 'Automatico';
        badge.style.background = '#f0f4ff';
        badge.style.color = '#1e40af';
      }
    }

    // ── Diff visuale ──
    function applyDiff(card, item) {
      var aiCost = parseFloat(card.getAttribute('data-ai-cost'));
      var aiMargin = parseFloat(card.getAttribute('data-ai-margin'));
      if (isNaN(aiCost)) return;
      var costInput = card.querySelector('.prev-cost');
      var marginInput = card.querySelector('.prev-margin');
      if (costInput) {
        if (parseFloat(costInput.value) !== aiCost) {
          costInput.classList.add('modified');
          costInput.title = 'Suggerimento AI: ' + aiCost;
        } else {
          costInput.classList.remove('modified');
          costInput.title = '';
        }
      }
      if (marginInput) {
        if (parseFloat(marginInput.value) !== aiMargin) {
          marginInput.classList.add('modified');
          marginInput.title = 'Suggerimento AI: ' + aiMargin;
        } else {
          marginInput.classList.remove('modified');
          marginInput.title = '';
        }
      }
    }

    // ── Client-side recalculation + diff ──
    document.getElementById('lineItems').addEventListener('input', function(e) {
      var idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx) || !localItems[idx]) return;

      var item = localItems[idx];
      var card = e.target.closest('.item-card');

      if (e.target.classList.contains('prev-desc')) {
        item.description = e.target.value;
        // Autocomplete trigger with debounce
        clearTimeout(acTimer);
        acTimer = setTimeout(function() { doAutocomplete(idx, e.target.value); }, 300);
        return;
      }

      if (e.target.classList.contains('prev-qty')) {
        item.quantity = Math.max(1, parseInt(e.target.value) || 1);
      } else if (e.target.classList.contains('prev-cost') || e.target.classList.contains('prev-margin')) {
        item.unit_cost = Math.max(0, parseFloat(card.querySelector('.prev-cost').value) || 0);
        item.margin_percent = Math.min(90, Math.max(0, parseFloat(card.querySelector('.prev-margin').value) || 0));
        item.unit_price = round2(item.unit_cost * (1 + item.margin_percent / 100));
        card.querySelector('.prev-price').value = item.unit_price;
      } else if (e.target.classList.contains('prev-price')) {
        item.unit_price = Math.max(0, parseFloat(e.target.value) || 0);
        if (item.unit_cost > 0) {
          item.margin_percent = round2(Math.min(90, Math.max(0, ((item.unit_price - item.unit_cost) / item.unit_cost) * 100)));
        } else {
          item.margin_percent = 0;
        }
        card.querySelector('.prev-margin').value = item.margin_percent;
      }

      item.subtotal = round2(item.quantity * item.unit_price);
      card.querySelector('.prev-subtotal').innerHTML = fmtNum(item.subtotal) + ' &euro;';
      applyDiff(card, item);
      updateTotalsDisplay();
    });

    // ── Autocomplete ──
    function doAutocomplete(idx, q) {
      var dd = document.getElementById('ac-' + idx);
      if (!dd || q.trim().length < 2) { if (dd) dd.classList.remove('open'); return; }

      fetch('/quotes/item-search?q=' + encodeURIComponent(q.trim()))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success || !data.items.length) { dd.classList.remove('open'); dd.innerHTML = ''; return; }
          dd.innerHTML = data.items.map(function(it, i) {
            var srcLabel = it.source === 'priceList' ? 'Listino' : (it.occurrences + 'x usato');
            return '<div class="ac-item" data-ac-idx="' + idx + '" data-ac-item="' + i + '">' +
              '<span>' + escHtml(it.description) + '</span>' +
              '<span class="ac-source">' + srcLabel + ' &middot; ' + fmtNum(it.last_unit_price) + '&euro;</span>' +
            '</div>';
          }).join('');
          dd.classList.add('open');
          dd._items = data.items;
        })
        .catch(function() { dd.classList.remove('open'); });
    }

    // Autocomplete click handler (delegated)
    document.getElementById('lineItems').addEventListener('mousedown', function(e) {
      var acItem = e.target.closest('.ac-item');
      if (!acItem) return;
      e.preventDefault();
      var idx = parseInt(acItem.getAttribute('data-ac-idx'));
      var iIdx = parseInt(acItem.getAttribute('data-ac-item'));
      var dd = document.getElementById('ac-' + idx);
      if (!dd || !dd._items || !dd._items[iIdx]) return;

      var sel = dd._items[iIdx];
      localItems[idx].description = sel.description;
      localItems[idx].unit_cost = sel.last_unit_cost || 0;
      localItems[idx].margin_percent = sel.last_margin_percent || 0;
      localItems[idx].unit_price = sel.last_unit_price || 0;
      localItems[idx].subtotal = round2(localItems[idx].quantity * localItems[idx].unit_price);

      dd.classList.remove('open');
      dd.innerHTML = '';
      renderPreview();
    });

    // Close autocomplete on focusout with delay
    document.getElementById('lineItems').addEventListener('focusout', function(e) {
      if (e.target.classList.contains('prev-desc')) {
        setTimeout(function() {
          var idx = parseInt(e.target.dataset.idx);
          var dd = document.getElementById('ac-' + idx);
          if (dd) { dd.classList.remove('open'); dd.innerHTML = ''; }
        }, 200);
      }
    });

    // ── Row actions ──
    window._addRow = function() {
      localItems.push({
        description: '', quantity: 1, unit_cost: 0, margin_percent: 0,
        unit_price: 0, subtotal: 0, confidence: null, explanation: null,
        needs_input: false, ai_suggested: null
      });
      renderPreview();
      // Focus on last desc input
      var descs = document.querySelectorAll('.prev-desc');
      if (descs.length) descs[descs.length - 1].focus();
    };

    window._delRow = function(idx) {
      if (localItems.length <= 1) return;
      localItems.splice(idx, 1);
      renderPreview();
    };

    window._dupRow = function(idx) {
      var copy = JSON.parse(JSON.stringify(localItems[idx]));
      copy.ai_suggested = null;
      localItems.splice(idx + 1, 0, copy);
      renderPreview();
    };

    window._resetRow = function(idx) {
      var item = localItems[idx];
      if (!item.ai_suggested) return;
      item.unit_cost = item.ai_suggested.unit_cost;
      item.margin_percent = item.ai_suggested.margin_percent;
      item.unit_price = round2(item.unit_cost * (1 + item.margin_percent / 100));
      item.subtotal = round2(item.quantity * item.unit_price);
      renderPreview();
    };

    window._reEstimate = function(idx, btn) {
      var niBar = btn.closest('.needs-input-bar');
      var input = niBar.querySelector('.ni-input');
      var userInput = input ? input.value.trim() : '';
      if (!userInput) { input.style.borderColor = '#ef4444'; return; }

      btn.disabled = true;
      btn.textContent = 'Ricalcolo...';

      fetch('/quotes/re-estimate-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: localItems[idx].description,
          user_input: userInput,
          pricing_preset: previewData.pricing_preset
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.item) {
          var it = data.item;
          localItems[idx].description = it.description || localItems[idx].description;
          localItems[idx].unit_cost = it.unit_cost;
          localItems[idx].margin_percent = it.margin_percent;
          localItems[idx].unit_price = it.unit_price;
          localItems[idx].subtotal = round2(localItems[idx].quantity * it.unit_price);
          localItems[idx].confidence = it.confidence;
          localItems[idx].explanation = it.explanation;
          localItems[idx].needs_input = it.needs_input;
          localItems[idx].ai_suggested = it.ai_suggested;
          renderPreview();
        } else {
          btn.disabled = false;
          btn.textContent = 'Ricalcola';
          showError(data.error || 'Errore ri-stima');
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Ricalcola';
        showError('Errore di rete');
      });
    };

    // Toolbar buttons
    document.getElementById('addRowBtn').addEventListener('click', function() { window._addRow(); });

    document.getElementById('marginAllBtn').addEventListener('click', function() {
      var val = prompt('Margine % da applicare a tutte le righe:');
      if (val === null) return;
      var m = parseFloat(val);
      if (isNaN(m) || m < 0 || m > 90) return;
      localItems.forEach(function(item) {
        item.margin_percent = m;
        item.unit_price = round2(item.unit_cost * (1 + m / 100));
        item.subtotal = round2(item.quantity * item.unit_price);
      });
      renderPreview();
    });

    document.getElementById('exportCsvBtn').addEventListener('click', function() {
      var sep = ';';
      var header = 'Descrizione' + sep + 'Quantità' + sep + 'Costo unitario' + sep + 'Margine %' + sep + 'Prezzo unitario' + sep + 'Subtotale';
      var rows = localItems.map(function(it) {
        return [it.description, it.quantity, it.unit_cost, it.margin_percent, it.unit_price, it.subtotal]
          .map(function(v) { return typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : v; })
          .join(sep);
      });
      var csv = '\\uFEFF' + header + '\\n' + rows.join('\\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'preventivo.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    // ── Paste da Excel ──
    document.getElementById('lineItems').addEventListener('paste', function(e) {
      if (!e.target.classList.contains('prev-desc')) return;
      var text = (e.clipboardData || window.clipboardData).getData('text');
      var lines = text.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
      if (lines.length < 2) return; // single line = normal paste

      e.preventDefault();
      var idx = parseInt(e.target.dataset.idx);

      lines.forEach(function(line, li) {
        var cols = line.split('\\t');
        var row = {
          description: (cols[0] || '').trim(),
          quantity: Math.max(1, parseInt(cols[1]) || 1),
          unit_cost: Math.max(0, parseFloat(cols[2]) || 0),
          margin_percent: Math.min(90, Math.max(0, parseFloat(cols[3]) || 0)),
          unit_price: 0, subtotal: 0,
          confidence: null, explanation: null, needs_input: false, ai_suggested: null
        };
        row.unit_price = round2(row.unit_cost * (1 + row.margin_percent / 100));
        row.subtotal = round2(row.quantity * row.unit_price);

        if (li === 0) {
          localItems[idx] = row;
        } else {
          localItems.splice(idx + li, 0, row);
        }
      });
      renderPreview();
    });

    function calcSubtotal() {
      return localItems.reduce(function(s, i) { return s + (i.subtotal || 0); }, 0);
    }

    function updateTotalsDisplay() {
      var tp = getSelectedTaxProfile();
      var sub = round2(calcSubtotal());
      var cassaAmount = tp.previdenza_percent ? round2(sub * tp.previdenza_percent / 100) : 0;
      var taxableForIva = round2(sub + cassaAmount);
      var ivaAmount = round2(taxableForIva * tp.iva_percent / 100);
      var tot = round2(sub + cassaAmount + ivaAmount);

      document.getElementById('subtotal').innerHTML = fmtNum(sub) + ' &euro;';

      // Show/hide cassa row
      var cassaRow = document.getElementById('cassaRow');
      if (cassaAmount > 0) {
        cassaRow.style.display = 'flex';
        document.getElementById('cassaAmount').innerHTML = fmtNum(cassaAmount) + ' &euro;';
      } else {
        cassaRow.style.display = 'none';
      }

      // IVA label
      var ivaLabel = tp.iva_percent > 0 ? ('IVA ' + tp.iva_percent + '%') : 'IVA (esente)';
      document.getElementById('ivaLabel').textContent = ivaLabel;
      document.getElementById('taxes').innerHTML = fmtNum(ivaAmount) + ' &euro;';
      document.getElementById('total').innerHTML = fmtNum(tot) + ' &euro;';
    }

    function round2(n) {
      return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    function showError(msg) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function escHtml(str) {
      var d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML.replace(/"/g, '&quot;');
    }

    function fmtNum(n) {
      return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  })();`;

  res.send(page({ title: "Nuovo preventivo", user, content, extraCss, script, activePage: "new" }));
});

// ── Smart Mock fallback — genera voci coerenti con la descrizione ──

function buildMockPreview(job_description, pricing_preset, user, profession, payment_terms) {
  const multiplier = { economy: 0.7, standard: 1, premium: 1.5 }[pricing_preset] || 1;
  const defaultMargin = { economy: 20, standard: 30, premium: 40 }[pricing_preset] || 30;

  // Usa margine medio dallo storico utente se disponibile
  const userProfile = user ? getUserPrompt(user.id) : null;
  const margin = (userProfile && userProfile.profile && userProfile.profile.margine_medio)
    ? userProfile.profile.margine_medio
    : defaultMargin;
  const desc = job_description.toLowerCase();

  // Category-based item templates
  const categoryItems = {
    idraulico: [
      { keywords: ["bagno", "sanitari", "wc", "bidet", "lavabo"], items: [
        { description: "Rimozione sanitari esistenti", cost: 120 },
        { description: "Fornitura e posa sanitari", cost: 450 },
        { description: "Rubinetteria e miscelatori", cost: 180 },
      ]},
      { keywords: ["tubazioni", "tubi", "tubature", "impianto idraulico"], items: [
        { description: "Rimozione vecchie tubazioni", cost: 200 },
        { description: "Nuove tubazioni in multistrato", cost: 350 },
        { description: "Raccorderia e giunzioni", cost: 80 },
      ]},
      { keywords: ["doccia", "piatto doccia"], items: [
        { description: "Piatto doccia e box doccia", cost: 380 },
        { description: "Colonna doccia termostatica", cost: 220 },
      ]},
      { keywords: ["caldaia", "boiler", "scaldabagno"], items: [
        { description: "Fornitura e installazione caldaia", cost: 1200 },
        { description: "Adeguamento scarico fumi", cost: 280 },
      ]},
      { keywords: ["perdita", "perdite", "riparazione"], items: [
        { description: "Ricerca e riparazione perdita", cost: 150 },
        { description: "Sostituzione guarnizioni e raccordi", cost: 60 },
      ]},
    ],
    elettricista: [
      { keywords: ["quadro", "quadro elettrico", "centralino"], items: [
        { description: "Nuovo quadro elettrico con differenziali", cost: 380 },
        { description: "Cablaggio e collegamento linee", cost: 250 },
      ]},
      { keywords: ["punti luce", "illuminazione", "luci", "lampade"], items: [
        { description: "Punti luce a soffitto/parete", cost: 45 },
        { description: "Fornitura corpi illuminanti", cost: 120 },
      ]},
      { keywords: ["prese", "interruttori"], items: [
        { description: "Punti presa e interruttori", cost: 35 },
        { description: "Placche e frutti serie civile", cost: 80 },
      ]},
      { keywords: ["impianto", "rifacimento", "cavi", "cablaggio"], items: [
        { description: "Tracce e canalizzazioni", cost: 400 },
        { description: "Cavi e conduttori", cost: 200 },
        { description: "Certificazione impianto", cost: 150 },
      ]},
    ],
    edilizia: [
      { keywords: ["demolizione", "demolire", "rimozione"], items: [
        { description: "Demolizione e rimozione macerie", cost: 350 },
        { description: "Trasporto e smaltimento calcinacci", cost: 200 },
      ]},
      { keywords: ["pavimento", "piastrelle", "gres", "posa"], items: [
        { description: "Fornitura pavimento/piastrelle", cost: 320 },
        { description: "Posa in opera con colla e fughe", cost: 280 },
        { description: "Massetto autolivellante", cost: 180 },
      ]},
      { keywords: ["cartongesso", "controsoffitto", "parete"], items: [
        { description: "Struttura in cartongesso", cost: 250 },
        { description: "Lastre, stuccatura e finitura", cost: 180 },
      ]},
      { keywords: ["ristrutturazione", "ristrutturare"], items: [
        { description: "Opere murarie e preparazione", cost: 400 },
        { description: "Materiali e forniture edili", cost: 300 },
      ]},
      { keywords: ["intonaco", "rasatura"], items: [
        { description: "Rasatura e intonacatura pareti", cost: 220 },
      ]},
    ],
    imbianchino: [
      { keywords: ["tinteggiatura", "pittura", "imbiancatura", "verniciatura", "pareti"], items: [
        { description: "Preparazione e stuccatura superfici", cost: 150 },
        { description: "Tinteggiatura pareti (2 mani)", cost: 250 },
        { description: "Tinteggiatura soffitti", cost: 180 },
      ]},
      { keywords: ["velatura", "decorativa", "effetto", "stucco veneziano"], items: [
        { description: "Finitura decorativa/velatura", cost: 350 },
        { description: "Materiali pittura decorativa", cost: 120 },
      ]},
      { keywords: ["crepe", "stuccatura", "rasatura"], items: [
        { description: "Stuccatura crepe e fessure", cost: 100 },
        { description: "Rasatura a gesso pareti", cost: 200 },
      ]},
    ],
    falegname: [
      { keywords: ["armadio", "guardaroba", "cabina armadio"], items: [
        { description: "Struttura armadio su misura", cost: 600 },
        { description: "Ante e ferramenta", cost: 350 },
        { description: "Ripiani, cassetti e accessori interni", cost: 250 },
      ]},
      { keywords: ["cucina", "pensili", "mobili cucina"], items: [
        { description: "Mobili base e pensili cucina", cost: 800 },
        { description: "Top in laminato/quarzo", cost: 400 },
        { description: "Montaggio e fissaggio", cost: 200 },
      ]},
      { keywords: ["porta", "porte", "infissi"], items: [
        { description: "Fornitura porte interne", cost: 280 },
        { description: "Installazione con controtelaio", cost: 120 },
      ]},
    ],
    giardiniere: [
      { keywords: ["prato", "erba", "tappeto erboso"], items: [
        { description: "Preparazione terreno", cost: 200 },
        { description: "Posa prato a rotoli/semina", cost: 300 },
      ]},
      { keywords: ["irrigazione", "impianto"], items: [
        { description: "Impianto irrigazione automatico", cost: 450 },
        { description: "Centralina e programmazione", cost: 150 },
      ]},
      { keywords: ["piante", "siepe", "aiuole", "alberi"], items: [
        { description: "Fornitura piante e arbusti", cost: 350 },
        { description: "Messa a dimora e pacciamatura", cost: 180 },
      ]},
      { keywords: ["potatura", "manutenzione"], items: [
        { description: "Potatura alberi e siepi", cost: 200 },
        { description: "Pulizia e smaltimento ramaglie", cost: 80 },
      ]},
    ]
  };

  // Map profession to category (same as frontend professionToCategory)
  const professionToCategory = {
    idraulico: 'idraulico', elettricista: 'elettricista', muratore: 'edilizia',
    falegname: 'falegname', imbianchino: 'imbianchino', fabbro: 'edilizia',
    piastrellista: 'edilizia', giardiniere: 'giardiniere', serramentista: 'falegname'
  };

  // Detect category: profession (from select) > user profile > description keywords
  let detectedCategory = (profession && professionToCategory[profession]) || (user && user.category) || "";
  if (!detectedCategory || !categoryItems[detectedCategory]) {
    // Try to detect from description
    const catKeywords = {
      idraulico: ["bagno", "idraulic", "tubazion", "sanitari", "rubinett", "caldaia", "doccia", "perdita"],
      elettricista: ["elettric", "quadro", "prese", "interruttori", "punti luce", "illumin", "cavi", "cablaggio"],
      edilizia: ["ristrutturazion", "demolizion", "pavimento", "piastrelle", "cartongesso", "murari", "massetto"],
      imbianchino: ["tinteggiatura", "pittura", "imbianca", "verniciatura", "rasatura", "stuccatura", "velatura"],
      falegname: ["armadio", "falegnam", "legno", "mobile", "porta", "porte", "cucina su misura"],
      giardiniere: ["giardino", "prato", "piante", "irrigazione", "potatura", "siepe", "verde"]
    };
    for (const [cat, kws] of Object.entries(catKeywords)) {
      if (kws.some(kw => desc.includes(kw))) {
        detectedCategory = cat;
        break;
      }
    }
  }

  // Collect matching items
  let matchedItems = [];
  const templates = categoryItems[detectedCategory] || [];

  for (const group of templates) {
    if (group.keywords.some(kw => desc.includes(kw))) {
      matchedItems.push(...group.items);
    }
  }

  // If no keyword matches, use first 2 groups from category
  if (!matchedItems.length && templates.length) {
    for (let i = 0; i < Math.min(2, templates.length); i++) {
      matchedItems.push(...templates[i].items);
    }
  }

  // Fallback: generic items based on description words
  if (!matchedItems.length) {
    const words = job_description.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
    matchedItems = [
      { description: "Manodopera — " + (words[0] || "intervento"), cost: 250 },
      { description: "Materiali e forniture", cost: 150 },
      { description: "Trasporto e movimentazione", cost: 80 },
      { description: "Smaltimento e pulizia finale", cost: 60 },
    ];
  }

  // Limit to 6 items max and apply multiplier
  matchedItems = matchedItems.slice(0, 6);

  const items = matchedItems.map(it => ({
    description: it.description,
    quantity: 1,
    unit_cost: Math.round(it.cost * multiplier),
    margin_percent: margin
  }));

  // Add manodopera if not present and we have specific materials
  const hasManodopera = items.some(it => it.description.toLowerCase().includes("manodopera"));
  if (!hasManodopera && items.length <= 5) {
    items.unshift({
      description: "Manodopera specializzata",
      quantity: 1,
      unit_cost: Math.round(200 * multiplier),
      margin_percent: margin
    });
  }

  const result = pricingEngine.processQuote(items);

  return {
    line_items: result.line_items,
    subtotal: result.subtotal,
    taxes: result.taxes,
    total: result.total,
    currency: "EUR",
    payment_terms: payment_terms || "50% acconto, saldo a fine lavori",
    validity_days: 14,
    notes: null
  };
}

// ── Build preview from user's priceList (aggiornato) ──

function buildPriceListPreview(priceList, pricing_preset) {
  let items = priceList.filter(p => p.preset === pricing_preset);
  if (!items.length) items = priceList;

  const line_items = items.map(p => ({
    description: p.description,
    quantity: 1,
    unit_cost: p.unit_cost || p.unit_price || 0,
    margin_percent: p.margin_percent || 0,
    unit_price: p.unit_price
  }));

  const result = pricingEngine.processQuote(line_items);

  return {
    line_items: result.line_items,
    subtotal: result.subtotal,
    taxes: result.taxes,
    total: result.total,
    currency: "EUR",
    payment_terms: "50% acconto, saldo a fine lavori",
    validity_days: 14,
    notes: null
  };
}

// ── POST /quotes/preview ──

router.post("/preview", requirePlan, async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const job_description = (req.body.job_description || "").trim();
  const pricing_preset = req.body.pricing_preset || "standard";
  const profession = (req.body.profession || "").trim();
  const payment_terms = (req.body.payment_terms || "").trim();

  if (!job_description) {
    return res.status(400).json({ success: false, error: "La descrizione del lavoro è obbligatoria" });
  }

  let preview;
  let ai_generated = false;

  // If the user has a custom priceList, use it directly (no AI call)
  if (Array.isArray(user.priceList) && user.priceList.length > 0) {
    preview = buildPriceListPreview(user.priceList, pricing_preset);
  } else {
    try {
      if (claude.isAvailable()) {
        const aiResult = await claude.generateCostSuggestions({
          user_id: user.id,
          professional: { name: user.name, category: user.category, city: user.city },
          job_description,
          pricing_preset,
          profession,
          language: "it"
        });

        // Processa suggerimenti AI attraverso il pricing engine
        const processedItems = pricingEngine.processAiSuggestions(aiResult.suggestions || []);
        const quoted = pricingEngine.processQuote(processedItems);

        preview = {
          line_items: quoted.line_items.map((item, i) => ({
            ...item,
            confidence: processedItems[i].confidence,
            explanation: processedItems[i].explanation,
            needs_input: processedItems[i].needs_input,
            ai_suggested: processedItems[i].ai_suggested
          })),
          subtotal: quoted.subtotal,
          taxes: quoted.taxes,
          total: quoted.total,
          currency: "EUR",
          payment_terms: payment_terms || aiResult.payment_terms || "50% acconto, saldo a fine lavori",
          validity_days: aiResult.validity_days || 14,
          notes: aiResult.notes || null
        };
        ai_generated = true;
      } else {
        preview = buildMockPreview(job_description, pricing_preset, user, profession, payment_terms);
      }
    } catch (err) {
      console.error("Claude preview error, fallback mock:", err.message);
      preview = buildMockPreview(job_description, pricing_preset, user, profession, payment_terms);
    }
  }

  const userProfile = getUserPrompt(user.id);
  const has_user_profile = !!(userProfile && userProfile.context_prompt);

  res.json({
    success: true,
    ai_generated,
    has_user_profile,
    job_description,
    pricing_preset,
    preview
  });
});

// ── POST /quotes/create ──

router.post("/create", requirePlan, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const { job_description, pricing_preset, client, preview, profession, tax_profile } = req.body;

  if (!job_description || !job_description.trim()) {
    return res.status(400).json({ success: false, error: "Descrizione del lavoro obbligatoria" });
  }
  if (!preview || !Array.isArray(preview.line_items) || !preview.line_items.length) {
    return res.status(400).json({ success: false, error: "Genera prima l'anteprima del preventivo" });
  }
  if (!client || !client.name || !client.email) {
    return res.status(400).json({ success: false, error: "Inserisci nome e email del cliente" });
  }

  // Valida e ricalcola con il pricing engine
  const validated = pricingEngine.processQuote(preview.line_items);

  // Use client-provided totals that include tax profile calculations
  const finalSubtotal = validated.subtotal;
  const finalCassa = preview.cassa || 0;
  const finalTaxes = preview.taxes || 0;
  const finalTotal = preview.total || validated.total;

  const slug = crypto.randomBytes(6).toString("hex");
  const quoteId = `q-${Date.now()}`;

  const quote = {
    quote_id: quoteId,
    public_link_slug: slug,
    created_at: new Date().toISOString(),
    owner_user_id: user.id,
    user_id: user.id,
    professional: {
      name: user.name,
      category: user.category || null,
      city: user.city || null
    },
    client,
    job_description: job_description.trim(),
    pricing_preset: pricing_preset || "standard",
    profession: profession || null,
    tax_profile: tax_profile || null,
    ai_generated: !!req.body.ai_generated,
    line_items: validated.line_items,
    subtotal: finalSubtotal,
    cassa: finalCassa,
    taxes: finalTaxes,
    total: finalTotal,
    currency: preview.currency || "EUR",
    payment_terms: preview.payment_terms || "50% acconto, saldo a fine lavori",
    validity_days: preview.validity_days || 14,
    notes: preview.notes || null,
    status: "sent"
  };

  saveQuote(quote);

  // Invio email automatico al cliente
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const acceptUrl = `${baseUrl}/q/${quoteId}/accept`;
    const viewUrl = `${baseUrl}/q/${quoteId}`;
    const emailHtml = buildQuoteEmailHTML(quote, acceptUrl, viewUrl);
    sendOrLog(client.email, `Preventivo ${quoteId} da ${user.name}`, emailHtml, quoteId);
  } catch (err) {
    console.error("[NewQuote] Errore invio email:", err.message);
  }

  // Se AI-generated, registra feedback per le voci modificate dall'utente
  if (req.body.ai_generated && Array.isArray(preview.line_items)) {
    preview.line_items.forEach((item, i) => {
      if (item.ai_suggested) {
        const userFinal = validated.line_items[i];
        const aiSug = item.ai_suggested;
        // Registra se l'utente ha modificato costo o margine
        if (userFinal.unit_cost !== aiSug.unit_cost || userFinal.margin_percent !== aiSug.margin_percent) {
          feedback.recordFeedback({
            user_id: user.id,
            quote_id: quoteId,
            item_description: userFinal.description,
            ai_suggested: aiSug,
            user_final: {
              unit_cost: userFinal.unit_cost,
              margin_percent: userFinal.margin_percent,
              unit_price: userFinal.unit_price
            }
          });
        }
      }
    });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.status(201).json({
    success: true,
    quote_id: quoteId,
    public_link: `${baseUrl}/q/${quoteId}`
  });
});

// ── GET /quotes/:id — Pagina interna dettaglio preventivo ──

const DETAIL_STATUS = {
  draft:          { bg: "#fff3cd", color: "#856404", label: "Bozza" },
  sent:           { bg: "#cce5ff", color: "#004085", label: "Inviato" },
  accepted:       { bg: "#d4edda", color: "#155724", label: "Accettato" },
  acconto_pagato: { bg: "#b8daff", color: "#004085", label: "Acconto pagato" },
  rejected:       { bg: "#f8d7da", color: "#721c24", label: "Rifiutato" },
  expired:        { bg: "#e2e3e5", color: "#383d41", label: "Scaduto" }
};

router.get("/:id", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const quote = getQuoteById(req.params.id);
  if (!quote || quote.user_id !== user.id) {
    return res.status(404).send(page({
      title: "Non trovato",
      user,
      content: '<div class="wrap"><div class="card" style="padding:48px;text-align:center"><h2 style="color:#ccc;font-size:2rem;margin-bottom:8px">404</h2><p style="color:#888">Preventivo non trovato.</p><a href="/dashboard" class="btn btn-primary" style="margin-top:16px">Torna alla dashboard</a></div></div>'
    }));
  }

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });
  const st = DETAIL_STATUS[quote.status] || DETAIL_STATUS.draft;

  // Retrocompatibilità: item.unit_cost || 0, item.margin_percent || 0
  const rows = quote.line_items.map((item, i) => `
    <tr data-idx="${i}">
      <td><input type="text" class="edit-input edit-desc" value="${esc(item.description)}" data-idx="${i}"></td>
      <td class="c"><input type="number" class="edit-input edit-qty" value="${item.quantity}" min="1" step="1" data-idx="${i}" style="width:60px;text-align:center"></td>
      <td class="r"><input type="number" class="edit-input edit-cost" value="${item.unit_cost || 0}" min="0" step="0.01" data-idx="${i}" style="width:90px;text-align:right"></td>
      <td class="r"><input type="number" class="edit-input edit-margin" value="${item.margin_percent || 0}" min="0" max="90" step="0.1" data-idx="${i}" style="width:75px;text-align:right"></td>
      <td class="r"><input type="number" class="edit-input edit-price" value="${item.unit_price}" min="0" step="0.01" data-idx="${i}" style="width:100px;text-align:right"></td>
      <td class="r edit-subtotal">${fmt(item.subtotal)} &euro;</td>
      <td class="c" style="white-space:nowrap">
        <button type="button" class="row-action" title="Duplica" onclick="window._dDup(${i})">&#x2398;</button>
        <button type="button" class="row-action" title="Elimina" onclick="window._dDel(${i})">&#x2715;</button>
      </td>
    </tr>`).join("");

  const extraCss = `
    .detail-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px}
    .detail-header h2{font-size:1.2rem;font-weight:700}
    .detail-meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
    @media(max-width:500px){.detail-meta{grid-template-columns:1fr}}
    .meta-block{background:#f8f9fb;border-radius:8px;padding:14px 18px}
    .meta-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
    .meta-value{font-size:.95rem;font-weight:500}
    .desc-block{background:#f8f9fb;border-left:3px solid #2563eb;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:.93rem;line-height:1.6}
    .edit-input{border:1px solid transparent;background:transparent;padding:4px 8px;border-radius:4px;font-size:.88rem;font-family:inherit;transition:border-color .15s}
    .edit-input:hover{border-color:#ddd}
    .edit-input:focus{border-color:#2563eb;outline:none;background:#fff}
    .edit-desc{width:100%}
    .totals-block{text-align:right;margin:20px 0 24px}
    .totals-block .row{display:flex;justify-content:flex-end;gap:24px;padding:4px 0;font-size:.95rem}
    .totals-block .total-row{font-size:1.4rem;font-weight:700;color:#1a1a2e;border-top:2px solid #1a1a2e;padding-top:10px;margin-top:8px}
    .action-bar{display:flex;gap:10px;flex-wrap:wrap;padding-top:20px;border-top:1px solid #eee;margin-top:8px}
    .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:.78rem;font-weight:600}
    .notes-block{background:#f8f9fb;border-left:3px solid #2563eb;padding:14px 18px;border-radius:0 8px 8px 0;font-size:.9rem;line-height:1.6;margin-bottom:24px}
    .save-bar{display:none;background:#fff8e1;border-radius:8px;padding:12px 18px;margin-bottom:18px;font-size:.88rem;color:#856404;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
    .save-bar.visible{display:flex}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
    .confirm-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;align-items:center;justify-content:center}
    .confirm-overlay.show{display:flex}
    .confirm-box{background:#fff;border-radius:12px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.15)}
    .confirm-box h3{font-size:1.05rem;margin-bottom:8px}
    .confirm-box p{color:#888;font-size:.9rem;margin-bottom:24px}
    .confirm-box .btns{display:flex;gap:10px;justify-content:center}
    .row-action{background:none;border:none;cursor:pointer;font-size:1rem;padding:2px 6px;border-radius:4px;color:#888}
    .row-action:hover{color:#2563eb;background:#f0f2f5}
    .detail-table-actions{margin-bottom:12px}
    .detail-table-actions button{padding:6px 14px;border-radius:6px;font-size:.8rem;font-weight:500;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#333;transition:all .15s}
    .detail-table-actions button:hover{background:#f0f4ff;border-color:#2563eb;color:#2563eb}
  `;

  const content = `
  <div class="wrap" style="max-width:820px">
    <div class="card" style="padding:32px">

      <div class="detail-header">
        <div>
          <h2>Preventivo per ${esc(quote.client?.name || "Cliente")}</h2>
          <span style="font-size:.82rem;color:#888">${createdDate}</span>
        </div>
        <span class="status-badge" style="background:${st.bg};color:${st.color}">${esc(st.label)}</span>
      </div>

      <div id="error" class="alert alert-error" style="display:none"></div>
      <div class="save-bar" id="saveBar">
        <span>Hai modificato delle voci. Salva le modifiche?</span>
        <button class="btn btn-primary" style="padding:6px 20px;font-size:.82rem" id="saveBtn">Salva modifiche</button>
      </div>

      <!-- Meta -->
      <div class="detail-meta">
        <div class="meta-block">
          <div class="meta-label">Cliente</div>
          <div class="meta-value">${esc(quote.client?.name || "\u2014")}</div>
          <div style="font-size:.82rem;color:#888;margin-top:2px">${esc(quote.client?.email || "")}</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Professionista</div>
          <div class="meta-value">${esc(quote.professional?.name || user.name)}</div>
          <div style="font-size:.82rem;color:#888;margin-top:2px">${esc(quote.professional?.category || "")} &middot; ${esc(quote.professional?.city || "")}</div>
        </div>
      </div>

      <!-- Descrizione -->
      <div class="desc-block">${esc(quote.job_description)}</div>

      <!-- Azioni tabella -->
      <div class="detail-table-actions">
        <button type="button" id="dAddRowBtn">+ Aggiungi riga</button>
      </div>

      <!-- Tabella voci modificabile — 7 colonne -->
      <div style="overflow-x:auto">
        <table id="itemsTable">
          <thead>
            <tr>
              <th>Voce</th>
              <th class="c" style="width:70px">Qtà</th>
              <th class="r" style="width:100px">Costo</th>
              <th class="r" style="width:85px">Margine %</th>
              <th class="r" style="width:110px">Prezzo unit.</th>
              <th class="r" style="width:110px">Subtotale</th>
              <th style="width:70px"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- Totali -->
      <div class="totals-block">
        <div class="row"><span>Imponibile</span><span id="dSubtotal">${fmt(quote.subtotal)} &euro;</span></div>
        ${quote.cassa ? `<div class="row"><span>Contributo cassa</span><span>${fmt(quote.cassa)} &euro;</span></div>` : ""}
        <div class="row"><span>${quote.tax_profile ? (quote.tax_profile.iva_percent > 0 ? "IVA " + quote.tax_profile.iva_percent + "%" : "IVA (esente)") : "IVA"}</span><span id="dTaxes">${fmt(quote.taxes)} &euro;</span></div>
        <div class="row total-row"><span>Totale</span><span id="dTotal">${fmt(quote.total)} &euro;</span></div>
      </div>

      ${quote.notes ? `<div class="notes-block">${esc(quote.notes)}</div>` : ""}

      <!-- Stato -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <span style="font-size:.76rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em">Stato</span>
        <select id="statusSelect" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:.84rem;font-family:inherit;cursor:pointer">
          <option value="draft"${quote.status === "draft" ? " selected" : ""}>Bozza</option>
          <option value="sent"${quote.status === "sent" ? " selected" : ""}>Inviato</option>
          <option value="accepted"${quote.status === "accepted" ? " selected" : ""}>Accettato</option>
          <option value="acconto_pagato"${quote.status === "acconto_pagato" ? " selected" : ""}>Acconto pagato</option>
          <option value="rejected"${quote.status === "rejected" ? " selected" : ""}>Rifiutato</option>
          <option value="expired"${quote.status === "expired" ? " selected" : ""}>Scaduto</option>
        </select>
      </div>

      <!-- Azioni -->
      <div class="action-bar">
        <button class="btn btn-primary" id="sendBtn">Segna come inviato</button>
        <button class="btn btn-secondary" id="linkBtn">Link pubblico</button>
        <a href="/q/${esc(quote.quote_id)}/pdf" class="btn btn-secondary" target="_blank">Scarica PDF</a>
        <div style="flex:1"></div>
        <button class="btn btn-danger" id="deleteBtn">Elimina</button>
      </div>

    </div>
  </div>

  <div class="toast" id="toast"></div>

  <!-- Confirm delete modal -->
  <div class="confirm-overlay" id="confirmOverlay">
    <div class="confirm-box">
      <h3>Eliminare il preventivo?</h3>
      <p>Questa azione non può essere annullata.</p>
      <div class="btns">
        <button class="btn btn-danger" id="confirmDelete">Elimina</button>
        <button class="btn btn-secondary" id="cancelDelete">Annulla</button>
      </div>
    </div>
  </div>`;

  const script = `
  (function() {
    var quoteId = ${JSON.stringify(quote.quote_id)};
    var quoteTaxProfile = ${JSON.stringify(quote.tax_profile || null)};
    var lineItems = ${JSON.stringify(quote.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_cost: item.unit_cost || 0,
      margin_percent: item.margin_percent || 0,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    })))};
    var dirty = false;

    function round2(n) {
      return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    // ── Row actions (detail page) ──
    function renderDetailTable() {
      var tbody = document.getElementById('itemsTable').querySelector('tbody');
      tbody.innerHTML = '';
      lineItems.forEach(function(item, i) {
        var tr = document.createElement('tr');
        tr.setAttribute('data-idx', i);
        tr.innerHTML =
          '<td><input type="text" class="edit-input edit-desc" value="' + escD(item.description) + '" data-idx="' + i + '"></td>' +
          '<td class="c"><input type="number" class="edit-input edit-qty" value="' + item.quantity + '" min="1" step="1" data-idx="' + i + '" style="width:60px;text-align:center"></td>' +
          '<td class="r"><input type="number" class="edit-input edit-cost" value="' + (item.unit_cost || 0) + '" min="0" step="0.01" data-idx="' + i + '" style="width:90px;text-align:right"></td>' +
          '<td class="r"><input type="number" class="edit-input edit-margin" value="' + (item.margin_percent || 0) + '" min="0" max="90" step="0.1" data-idx="' + i + '" style="width:75px;text-align:right"></td>' +
          '<td class="r"><input type="number" class="edit-input edit-price" value="' + item.unit_price + '" min="0" step="0.01" data-idx="' + i + '" style="width:100px;text-align:right"></td>' +
          '<td class="r edit-subtotal">' + fmtNum(item.subtotal) + ' &euro;</td>' +
          '<td class="c" style="white-space:nowrap">' +
            '<button type="button" class="row-action" title="Duplica" onclick="window._dDup(' + i + ')">&#x2398;</button>' +
            '<button type="button" class="row-action" title="Elimina" onclick="window._dDel(' + i + ')">&#x2715;</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
      recalcTotals();
    }

    function escD(s) {
      var d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML.replace(/"/g, '&quot;');
    }

    window._dDup = function(idx) {
      var copy = JSON.parse(JSON.stringify(lineItems[idx]));
      lineItems.splice(idx + 1, 0, copy);
      renderDetailTable();
      dirty = true;
      document.getElementById('saveBar').classList.add('visible');
    };

    window._dDel = function(idx) {
      if (lineItems.length <= 1) return;
      lineItems.splice(idx, 1);
      renderDetailTable();
      dirty = true;
      document.getElementById('saveBar').classList.add('visible');
    };

    document.getElementById('dAddRowBtn').addEventListener('click', function() {
      lineItems.push({ description: '', quantity: 1, unit_cost: 0, margin_percent: 0, unit_price: 0, subtotal: 0 });
      renderDetailTable();
      dirty = true;
      document.getElementById('saveBar').classList.add('visible');
      var descs = document.querySelectorAll('.edit-desc');
      if (descs.length) descs[descs.length - 1].focus();
    });

    // ── Edit line items — 7 colonne con ricalcolo ──
    document.getElementById('itemsTable').addEventListener('input', function(e) {
      var idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx) || !lineItems[idx]) return;

      var item = lineItems[idx];
      var row = e.target.closest('tr');

      if (e.target.classList.contains('edit-desc')) {
        item.description = e.target.value;
      } else if (e.target.classList.contains('edit-qty')) {
        item.quantity = Math.max(1, parseInt(e.target.value) || 1);
      } else if (e.target.classList.contains('edit-cost') || e.target.classList.contains('edit-margin')) {
        // Modifica costo o margine → ricalcola prezzo
        item.unit_cost = Math.max(0, parseFloat(row.querySelector('.edit-cost').value) || 0);
        item.margin_percent = Math.min(90, Math.max(0, parseFloat(row.querySelector('.edit-margin').value) || 0));
        item.unit_price = round2(item.unit_cost * (1 + item.margin_percent / 100));
        row.querySelector('.edit-price').value = item.unit_price;
      } else if (e.target.classList.contains('edit-price')) {
        // Modifica prezzo → ricalcola margine
        item.unit_price = Math.max(0, parseFloat(e.target.value) || 0);
        if (item.unit_cost > 0) {
          item.margin_percent = round2(Math.min(90, Math.max(0, ((item.unit_price - item.unit_cost) / item.unit_cost) * 100)));
        } else {
          item.margin_percent = 0;
        }
        row.querySelector('.edit-margin').value = item.margin_percent;
      }

      item.subtotal = round2(item.quantity * item.unit_price);
      row.querySelector('.edit-subtotal').innerHTML = fmtNum(item.subtotal) + ' &euro;';

      recalcTotals();
      dirty = true;
      document.getElementById('saveBar').classList.add('visible');
    });

    function recalcTotals() {
      var sub = round2(lineItems.reduce(function(s, i) { return s + i.subtotal; }, 0));
      var ivaPercent = quoteTaxProfile ? quoteTaxProfile.iva_percent : 22;
      var cassaPercent = quoteTaxProfile && quoteTaxProfile.previdenza_percent ? quoteTaxProfile.previdenza_percent : 0;
      var cassa = round2(sub * cassaPercent / 100);
      var tax = round2((sub + cassa) * ivaPercent / 100);
      var tot = round2(sub + cassa + tax);
      document.getElementById('dSubtotal').innerHTML = fmtNum(sub) + ' &euro;';
      document.getElementById('dTaxes').innerHTML = fmtNum(tax) + ' &euro;';
      document.getElementById('dTotal').innerHTML = fmtNum(tot) + ' &euro;';
    }

    // ── Save edits ──
    document.getElementById('saveBtn').addEventListener('click', function() {
      var sub = round2(lineItems.reduce(function(s, i) { return s + i.subtotal; }, 0));
      var ivaPercent = quoteTaxProfile ? quoteTaxProfile.iva_percent : 22;
      var cassaPercent = quoteTaxProfile && quoteTaxProfile.previdenza_percent ? quoteTaxProfile.previdenza_percent : 0;
      var cassa = round2(sub * cassaPercent / 100);
      var tax = round2((sub + cassa) * ivaPercent / 100);

      fetch('/quotes/' + quoteId + '/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_items: lineItems, subtotal: sub, cassa: cassa, taxes: tax, total: round2(sub + cassa + tax) })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          dirty = false;
          document.getElementById('saveBar').classList.remove('visible');
          showToast('Modifiche salvate');
        } else {
          showError(data.error || 'Errore durante il salvataggio');
        }
      })
      .catch(function() { showError('Errore di rete'); });
    });

    // ── Status change ──
    document.getElementById('statusSelect').addEventListener('change', function() {
      var newStatus = this.value;
      fetch('/api/quotes/' + quoteId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) showToast('Stato aggiornato');
        else showError(data.error || 'Errore');
      })
      .catch(function() { showError('Errore di rete'); });
    });

    // ── Send to client ──
    document.getElementById('sendBtn').addEventListener('click', function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Invio in corso...';

      fetch('/api/quotes/' + quoteId + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          showToast(data.message || 'Preventivo segnato come inviato');
          btn.textContent = 'Inviato!';
          document.getElementById('statusSelect').value = 'sent';
        } else {
          showError(data.error || 'Errore');
          btn.disabled = false;
          btn.textContent = 'Segna come inviato';
        }
      })
      .catch(function() {
        showError('Errore di rete');
        btn.disabled = false;
        btn.textContent = 'Segna come inviato';
      });
    });

    // ── Copy public link ──
    document.getElementById('linkBtn').addEventListener('click', function() {
      var url = window.location.origin + '/q/' + quoteId;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() { showToast('Link pubblico copiato!'); });
      } else {
        var inp = document.createElement('input');
        inp.value = url;
        document.body.appendChild(inp);
        inp.select();
        document.execCommand('copy');
        document.body.removeChild(inp);
        showToast('Link pubblico copiato!');
      }
    });

    // ── Delete ──
    document.getElementById('deleteBtn').addEventListener('click', function() {
      document.getElementById('confirmOverlay').classList.add('show');
    });
    document.getElementById('cancelDelete').addEventListener('click', function() {
      document.getElementById('confirmOverlay').classList.remove('show');
    });
    document.getElementById('confirmDelete').addEventListener('click', function() {
      fetch('/api/quotes/' + quoteId, {
        method: 'DELETE'
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          window.location.href = '/dashboard';
        } else {
          document.getElementById('confirmOverlay').classList.remove('show');
          showError(data.error || 'Errore durante l\\'eliminazione');
        }
      })
      .catch(function() {
        document.getElementById('confirmOverlay').classList.remove('show');
        showError('Errore di rete');
      });
    });

    function showError(msg) {
      var el = document.getElementById('error');
      el.textContent = msg;
      el.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function(){ t.classList.remove('show'); }, 2500);
    }

    function fmtNum(n) {
      return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  })();`;

  res.send(page({ title: "Preventivo", user, content, extraCss, script, activePage: "dashboard" }));
});

// ── POST /quotes/:id/update — Aggiorna voci ──

router.post("/:id/update", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const quote = getQuoteById(req.params.id);
  if (!quote || quote.user_id !== user.id) {
    return res.status(404).json({ success: false, error: "Preventivo non trovato" });
  }

  const { line_items } = req.body;
  if (!Array.isArray(line_items) || !line_items.length) {
    return res.status(400).json({ success: false, error: "Voci non valide" });
  }

  // Valida con il pricing engine
  const validated = pricingEngine.processQuote(line_items);

  const updated = updateQuote(req.params.id, {
    line_items: validated.line_items,
    subtotal: validated.subtotal,
    taxes: validated.taxes,
    total: validated.total
  });

  if (!updated) return res.status(500).json({ success: false, error: "Errore durante l'aggiornamento" });

  res.json({ success: true });
});

module.exports = router;
