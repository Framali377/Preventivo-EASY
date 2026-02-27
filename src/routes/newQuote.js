// src/routes/newQuote.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { getUserById, saveQuote, getQuoteById, updateQuote, deleteQuote, updateUser, loadQuotes } = require("../utils/storage");
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

// ── Load professions, tax profiles, and profession templates ──
const professions = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/professions.json"), "utf-8"));
const taxProfiles = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tax_profiles.json"), "utf-8"));
const professionTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/professionTemplates.json"), "utf-8"));

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

// ── POST /quotes/setup-profile — Salva profilo professionale (Step 1) ──

router.post("/setup-profile", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Non autenticato" });

  const { profession, taxProfile, cassaPercent, ivaPercent } = req.body;

  if (!profession) {
    return res.status(400).json({ success: false, error: "Seleziona la professione" });
  }
  if (!taxProfile) {
    return res.status(400).json({ success: false, error: "Seleziona il regime fiscale" });
  }

  const updates = {
    category: profession,
    taxProfile: taxProfile,
    cassaPercent: Number(cassaPercent) || 0,
    ivaPercent: Number(ivaPercent) || 0,
    defaultMargin: 30,
    profileCompleted: true
  };

  const updated = updateUser(user.id, updates);
  if (!updated) {
    return res.status(500).json({ success: false, error: "Errore durante il salvataggio" });
  }

  res.json({ success: true });
});

// ── GET /quotes/new — Interfaccia prompt 2 step ──

router.get("/new", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const profileCompleted = !!user.profileCompleted;
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

  // Placeholder for description
  const descPlaceholder = "Descrivi il lavoro da preventivare in modo dettagliato.\\nEs: Rifacimento bagno completo 8mq con demolizione, impermeabilizzazione, posa piastrelle 60x60 e installazione sanitari sospesi Ideal Standard...";

  const extraCss = `
    /* ── Step indicators ── */
    .step-tabs{display:flex;gap:0;margin-bottom:28px;border-bottom:2px solid #e5e7eb}
    .step-tab{flex:1;text-align:center;padding:14px 16px;font-size:.88rem;font-weight:600;color:#9ca3af;cursor:pointer;position:relative;transition:color .2s}
    .step-tab.active{color:#0d9488}
    .step-tab.active::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:#0d9488}
    .step-tab.done{color:#22c55e}

    /* ── Step panels ── */
    .step-panel{display:none;animation:fadeIn .3s ease}
    .step-panel.active{display:block}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    /* ── Prompt textarea ── */
    .prompt-wrap{position:relative;margin-bottom:20px}
    .prompt-wrap textarea{min-height:160px;resize:vertical;line-height:1.7;padding:16px;font-size:.95rem;border:2px solid #e5e7eb;border-radius:12px;transition:border-color .2s}
    .prompt-wrap textarea:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.1)}
    .prompt-wrap textarea::placeholder{color:#b0b8c4}
    .voice-btn{position:absolute;right:12px;bottom:12px;width:36px;height:36px;border-radius:50%;border:none;background:#f0f1f3;color:#666;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;font-size:1.1rem}
    .voice-btn:hover{background:#e4e5e9;color:#0d9488}
    .voice-btn.recording{background:#ef4444;color:#fff;animation:pulse-rec 1.2s ease-in-out infinite}
    @keyframes pulse-rec{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
    .char-counter{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:.75rem;color:#9ca3af}
    .char-counter .count{font-weight:500}
    .char-counter .count.good{color:#22c55e}
    .char-counter .count.short{color:#f59e0b}

    /* ── Price cards ── */
    .price-cards-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
    @media(max-width:640px){.price-cards-row{grid-template-columns:1fr}}
    .price-card{padding:16px;border:2px solid #e5e7eb;border-radius:12px;cursor:pointer;transition:all .2s;text-align:center}
    .price-card:hover{border-color:#5eead4;transform:translateY(-1px)}
    .price-card.selected{border-color:#0d9488;background:#f0fdfa}
    .price-card-icon{font-size:1.5rem;margin-bottom:4px}
    .price-card-title{font-weight:700;font-size:.88rem}
    .price-card-desc{font-size:.75rem;color:#9ca3af;margin-top:2px}

    /* ── Fiscal summary ── */
    .fiscal-summary{background:linear-gradient(135deg,#f0fdfa,#f8fffe);border:1px solid #ccfbf1;border-radius:10px;padding:12px 18px;margin-top:14px;display:flex;align-items:center;gap:8px;font-size:.85rem;color:#115e59}

    /* ── Profile setup inline ── */
    .profile-setup{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin-bottom:24px}
    .profile-setup h3{font-size:.95rem;font-weight:700;margin-bottom:4px}
    .profile-setup p{font-size:.82rem;color:#92400e;margin-bottom:16px}

    /* ── Loading overlay ── */
    .loading{display:none;text-align:center;padding:60px 24px}
    .loading.active{display:block}
    .spinner{width:48px;height:48px;border:3px solid rgba(13,148,136,.15);border-top-color:#0d9488;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .loading p{color:#888;font-size:.95rem}
    .loading-sub{font-size:.82rem;color:#bbb;margin-top:8px}

    /* ── CTA buttons ── */
    #generateBtn{background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 2px 8px rgba(245,158,11,.3);color:#fff;border:none;font-size:.95rem;padding:14px 32px}
    #generateBtn:hover{background:linear-gradient(135deg,#d97706,#b45309);box-shadow:0 4px 12px rgba(245,158,11,.4);transform:translateY(-1px)}
    #generateBtn:disabled{opacity:.6;cursor:not-allowed;transform:none}

    /* ── Preview item cards ── */
    .item-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
    .item-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;transition:all .2s}
    .item-card:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .item-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
    .item-card-desc{flex:1}
    .item-card-desc input{border:1px solid transparent;background:transparent;padding:4px 8px;border-radius:6px;font-size:.9rem;font-family:inherit;font-weight:500;width:100%;transition:all .15s;color:#1c1917}
    .item-card-desc input:hover{border-color:#e5e7eb;background:#f9fafb}
    .item-card-desc input:focus{border-color:#0d9488;outline:none;background:#fff;box-shadow:0 0 0 3px rgba(13,148,136,.08)}
    .item-card-actions{display:flex;gap:2px;flex-shrink:0}
    .item-card-actions button{background:none;border:none;cursor:pointer;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#9ca3af;transition:all .15s;font-size:.88rem}
    .item-card-actions button:hover{color:#0d9488;background:#f0fdfa}
    .item-card-fields{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
    @media(max-width:640px){.item-card-fields{grid-template-columns:1fr 1fr;gap:6px}}
    .item-field{display:flex;flex-direction:column}
    .item-field-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:3px;font-weight:600}
    .item-field input{border:1px solid #e5e7eb;background:#f9fafb;padding:7px 10px;border-radius:6px;font-size:.85rem;font-family:inherit;text-align:right;transition:all .15s;width:100%}
    .item-field input:focus{border-color:#0d9488;outline:none;background:#fff;box-shadow:0 0 0 3px rgba(13,148,136,.08)}
    .item-field .subtotal-value{padding:7px 10px;font-size:.9rem;font-weight:600;color:#1c1917;text-align:right}

    /* ── Confidence badges ── */
    .conf-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;cursor:help}
    .conf-badge.high{background:#ecfdf5;color:#065f46}
    .conf-badge.medium{background:#fffbeb;color:#92400e}
    .conf-badge.low{background:#fef2f2;color:#991b1b}
    .conf-badge-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .conf-badge.high .conf-badge-dot{background:#22c55e}
    .conf-badge.medium .conf-badge-dot{background:#f59e0b}
    .conf-badge.low .conf-badge-dot{background:#ef4444}

    /* ── Needs input bar ── */
    .needs-input-bar{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;gap:8px;font-size:.82rem;flex-wrap:wrap}
    .needs-input-bar input{border:1px solid #fde68a;background:#fff;padding:5px 10px;border-radius:6px;font-size:.82rem;font-family:inherit;flex:1;min-width:160px}
    .needs-input-bar input:focus{border-color:#f59e0b;outline:none}
    .needs-input-bar button{padding:5px 14px;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid #f59e0b;background:#fef3c7;color:#92400e;transition:all .15s;white-space:nowrap}
    .needs-input-bar button:hover{background:#fde68a}

    /* ── Totals block ── */
    .totals-card{background:linear-gradient(135deg,#1c1917,#292524);border-radius:12px;padding:20px 24px;color:#fff;margin-bottom:20px}
    .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)}
    .totals-row.grand{font-size:1.5rem;font-weight:700;color:#fff;border-top:2px solid rgba(255,255,255,.25);padding-top:14px;margin-top:10px}

    .notes-box textarea{min-height:80px;resize:vertical}

    /* ── Table actions ── */
    .table-actions{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
    .table-actions button{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;border:1px solid #e2e4e8;background:#fff;color:#444;transition:all .15s}
    .table-actions button:hover{background:#f0fdfa;border-color:#0d9488;color:#0d9488}

    /* ── Section headings ── */
    .section-heading{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f0f1f3}

    /* ── Client summary ── */
    .client-summary{display:flex;align-items:center;gap:10px;background:#f8f9fb;border-radius:10px;padding:12px 18px;margin-bottom:16px;font-size:.88rem}
    .client-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem}

    .job-summary{background:linear-gradient(135deg,#f0fdfa,#f8fffe);border:1px solid #ccfbf1;border-radius:10px;padding:14px 18px;margin-bottom:20px}
    .job-summary-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px;font-weight:600}
    .job-summary-text{font-size:.9rem;color:#1c1917;line-height:1.5}

    /* ── Success overlay ── */
    .success-overlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.95);z-index:300;align-items:center;justify-content:center;flex-direction:column}
    .success-overlay.show{display:flex}
    .success-content{text-align:center;animation:fadeIn .4s ease}
    .success-check{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 16px}
    .success-content h3{font-size:1.3rem;font-weight:700;margin-bottom:6px;color:#1c1917}
    .success-content p{color:#888;font-size:.95rem}

    /* ── Autocomplete ── */
    .ac-wrap{position:relative}
    .ac-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #d1d5db;border-radius:0 0 8px 8px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:50;max-height:220px;overflow-y:auto;display:none}
    .ac-dropdown.open{display:block}
    .ac-item{padding:10px 14px;cursor:pointer;font-size:.82rem;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;transition:background .1s}
    .ac-item:hover{background:#f0fdfa}
    .ac-source{font-size:.7rem;color:#888;white-space:nowrap}

    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
  `;

  const content = `
  <div class="wrap" style="max-width:740px">
    <div class="card" style="padding:36px">

      <!-- Step tabs -->
      <div class="step-tabs">
        <div class="step-tab active" id="tab1" onclick="window._goStep(1)">1. Descrivi il lavoro</div>
        <div class="step-tab" id="tab2">2. Anteprima e modifica</div>
      </div>

      <div id="error" class="alert alert-error" style="display:none"></div>

      <!-- ═══ STEP 1: Prompt ═══ -->
      <div class="step-panel active" id="panel1">

        ${!profileCompleted ? `
        <!-- Inline profile setup -->
        <div class="profile-setup" id="profileSetup">
          <h3>Configura il tuo profilo</h3>
          <p>Servono professione e regime fiscale per generare preventivi corretti. Si compila una volta sola.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field" style="margin-bottom:0">
              <label for="profileProfession">Professione</label>
              <select id="profileProfession">
                <option value="">Seleziona...</option>
                ${professionOptions}
              </select>
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="profileTaxProfile">Regime fiscale</label>
              <select id="profileTaxProfile">
                ${taxProfileOptions}
              </select>
            </div>
          </div>
          <button class="btn btn-primary" id="saveProfile" style="margin-top:14px">Salva profilo</button>
        </div>` : ''}

        <h2 style="font-size:1.15rem;margin-bottom:4px;font-weight:700">Dati cliente e lavoro</h2>
        <p style="color:#888;font-size:.85rem;margin-bottom:24px">Inserisci le informazioni del cliente e descrivi il lavoro da preventivare.</p>

        <!-- Client fields -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field" style="margin-bottom:0">
            <label for="clientName">Nome cliente *</label>
            <input type="text" id="clientName" required placeholder="es. Mario Bianchi">
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="clientEmail">Email cliente</label>
            <input type="email" id="clientEmail" placeholder="es. mario@email.com">
            <div class="hint">Opzionale &mdash; per inviare il preventivo via email</div>
          </div>
        </div>
        <div class="field">
          <label for="clientPhone">Telefono (opzionale)</label>
          <input type="tel" id="clientPhone" placeholder="es. 333 1234567">
        </div>

        <!-- Prompt textarea -->
        <div class="field prompt-wrap">
          <label for="desc">Descrizione del lavoro *</label>
          <textarea id="desc" required placeholder="${esc(descPlaceholder)}" style="min-height:160px"></textarea>
          <button type="button" class="voice-btn" id="voiceBtn" title="Dettatura vocale">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <div class="char-counter">
            <span id="charHint">Minimo raccomandato: 50 caratteri</span>
            <span class="count" id="charCount">0</span>
          </div>
        </div>

        <!-- Settings row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field" style="margin-bottom:0">
            <label for="taxProfile">Profilo fiscale</label>
            <select id="taxProfile">
              ${taxProfileOptions}
            </select>
            <div class="hint" id="taxProfileNote"></div>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="paymentTerms">Condizioni di pagamento</label>
            <select id="paymentTerms">
              <option value="acconto_50">50% acconto + saldo a fine lavori</option>
              <option value="bonifico_30">Bonifico bancario a 30 giorni</option>
              <option value="bonifico_immediato">Bonifico bancario immediato</option>
              <option value="acconto_30">30% acconto + saldo a fine lavori</option>
              <option value="rata_30_60_90">Rata 30/60/90 giorni</option>
              <option value="fine_lavori">Pagamento a fine lavori</option>
              <option value="contanti">Contanti alla consegna</option>
            </select>
          </div>
        </div>

        <!-- Price level -->
        <div class="field">
          <label>Fascia prezzo</label>
          <div class="price-cards-row" id="priceCardsRow">
            <div class="price-card" data-price="economico" onclick="window._selectPrice(this)">
              <div class="price-card-icon">&#128176;</div>
              <div class="price-card-title">Economico</div>
              <div class="price-card-desc">Prezzi competitivi</div>
            </div>
            <div class="price-card selected" data-price="standard" onclick="window._selectPrice(this)">
              <div class="price-card-icon">&#9878;</div>
              <div class="price-card-title">Standard</div>
              <div class="price-card-desc">Qualit&agrave; e prezzo in equilibrio</div>
            </div>
            <div class="price-card" data-price="premium" onclick="window._selectPrice(this)">
              <div class="price-card-icon">&#11088;</div>
              <div class="price-card-title">Premium</div>
              <div class="price-card-desc">Servizio e qualit&agrave; top</div>
            </div>
          </div>
        </div>

        <div class="fiscal-summary" id="fiscalSummary">
          <span style="font-size:1.2rem">&#128196;</span>
          <span id="fiscalSummaryText">Il preventivo includer&agrave;: IVA 22%</span>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-top:24px">
          <button class="btn" id="generateBtn">Genera preventivo</button>
          <a href="/dashboard" class="btn btn-secondary">Annulla</a>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading" id="loadingPanel">
        <div class="spinner"></div>
        <p>L'AI sta analizzando il lavoro...</p>
        <div class="loading-sub">Generazione voci, costi e margini in corso</div>
      </div>

      <!-- ═══ STEP 2: Preview & Edit ═══ -->
      <div class="step-panel" id="panel2">
        <h2 style="font-size:1.15rem;margin-bottom:4px;font-weight:700">Anteprima del preventivo</h2>
        <p style="color:#888;font-size:.85rem;margin-bottom:20px">Modifica descrizioni, quantit&agrave; e prezzi. I totali si aggiornano in automatico.</p>

        <!-- Client summary -->
        <div class="section-heading">Cliente</div>
        <div class="client-summary">
          <div class="client-avatar" id="clientAvatar"></div>
          <div>
            <div style="font-weight:600" id="summaryClient"></div>
            <div style="font-size:.8rem;color:#888" id="summaryEmail"></div>
          </div>
        </div>

        <!-- Job summary -->
        <div class="job-summary">
          <div class="job-summary-label">Descrizione lavoro</div>
          <div class="job-summary-text" id="summaryJob"></div>
        </div>

        <!-- Item cards -->
        <div class="section-heading" style="margin-top:24px">Voci del preventivo</div>
        <div class="table-actions">
          <button type="button" id="addRowBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi voce
          </button>
          <button type="button" id="regenBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Rigenera con AI
          </button>
          <button type="button" id="exportCsvBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
        <div class="item-cards" id="lineItems"></div>

        <!-- Totals -->
        <div class="section-heading" style="margin-top:20px">Riepilogo fiscale</div>
        <div id="totalsCard" class="totals-card">
          <div class="totals-row"><span>Imponibile</span><span id="subtotal"></span></div>
          <div class="totals-row" id="cassaRow" style="display:none"><span id="cassaLabel">Cassa previdenziale 4%</span><span id="cassaAmount"></span></div>
          <div class="totals-row"><span id="ivaLabel">IVA 22%</span><span id="taxes"></span></div>
          <div class="totals-row grand"><span>Totale</span><span id="total"></span></div>
        </div>

        <!-- Notes -->
        <div class="field notes-box">
          <label for="notesField">Note e condizioni</label>
          <textarea id="notesField" placeholder="Note aggiuntive per il cliente..."></textarea>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:24px">
          <button class="btn btn-primary" id="confirmBtn" style="background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 2px 8px rgba(245,158,11,.3);border-color:#d97706">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Salva e invia
          </button>
          <button class="btn btn-secondary" id="saveDraftBtn">Salva bozza</button>
          <button class="btn btn-secondary" id="backToStep1">Modifica dati</button>
        </div>
      </div>

      <!-- Success overlay -->
      <div class="success-overlay" id="successOverlay">
        <div class="success-content">
          <div class="success-check">&#10003;</div>
          <h3>Preventivo creato!</h3>
          <p id="successMsg">Preventivo inviato al cliente.</p>
        </div>
      </div>

    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const script = `
  (function() {
    var profileCompleted = ${profileCompleted};
    var previewData = null;
    var localItems = [];
    var acTimer = null;
    var selectedPriceLevel = 'standard';

    var taxProfilesData = ${JSON.stringify(taxProfiles)};

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
      if (noteEl) noteEl.textContent = tp.note || '';
    }

    function updateFiscalSummary() {
      var tp = getSelectedTaxProfile();
      var iva = tp.iva_percent || 0;
      var cassa = tp.previdenza_percent || 0;
      var parts = [];
      if (iva > 0) parts.push('IVA ' + iva + '%');
      else parts.push('IVA esente');
      if (cassa > 0) parts.push('Cassa ' + cassa + '%');
      document.getElementById('fiscalSummaryText').textContent = 'Il preventivo includera: ' + parts.join(' + ');
    }

    // Init
    updateTaxProfileNote();
    updateFiscalSummary();

    // Tax profile change
    document.getElementById('taxProfile').addEventListener('change', function() {
      updateTaxProfileNote();
      updateFiscalSummary();
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

    // ── Voice input ──
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
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          var desc = document.getElementById('desc');
          var existing = desc.value;
          if (existing && !existing.endsWith(' ') && !existing.endsWith('\\n')) desc.value = existing + ' ' + finalTranscript;
          else desc.value = existing + finalTranscript;
          finalTranscript = '';
          updateCharCounter();
        }
      };
      recognition.onerror = function() { stopRecording(); };
      recognition.onend = function() { if (isRecording) try { recognition.start(); } catch(e) { stopRecording(); } };
      voiceBtn.addEventListener('click', function() { isRecording ? stopRecording() : startRecording(); });
    } else {
      voiceBtn.style.display = 'none';
    }
    function startRecording() { if (!recognition) return; isRecording = true; finalTranscript = ''; voiceBtn.classList.add('recording'); voiceBtn.title = 'Interrompi dettatura'; try { recognition.start(); } catch(e) {} }
    function stopRecording() { isRecording = false; voiceBtn.classList.remove('recording'); voiceBtn.title = 'Dettatura vocale'; if (recognition) try { recognition.stop(); } catch(e) {} }

    // ── Price card selection ──
    window._selectPrice = function(card) {
      document.querySelectorAll('.price-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      selectedPriceLevel = card.getAttribute('data-price');
    };

    // ── Step navigation ──
    window._goStep = function(n) {
      if (n === 2 && !previewData) return; // Can't go to step 2 without data
      document.querySelectorAll('.step-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelectorAll('.step-tab').forEach(function(t) { t.classList.remove('active'); });
      document.getElementById('panel' + n).classList.add('active');
      document.getElementById('tab' + n).classList.add('active');
      if (n === 1) document.getElementById('tab2').classList.remove('done');
      document.getElementById('error').style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Profile setup (inline) ──
    ${!profileCompleted ? `
    document.getElementById('saveProfile').addEventListener('click', function() {
      var prof = document.getElementById('profileProfession').value;
      if (!prof) { showError('Seleziona la tua professione'); return; }
      var tp = document.getElementById('profileTaxProfile').value;
      var btn = this;
      btn.disabled = true; btn.textContent = 'Salvataggio...';
      fetch('/quotes/setup-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profession: prof, taxProfile: tp, cassaPercent: 0, ivaPercent: 22 })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          profileCompleted = true;
          document.getElementById('profileSetup').style.display = 'none';
          document.getElementById('taxProfile').value = tp;
          updateTaxProfileNote();
          updateFiscalSummary();
        } else {
          showError(data.error || 'Errore');
          btn.disabled = false; btn.textContent = 'Salva profilo';
        }
      })
      .catch(function() { showError('Errore di rete'); btn.disabled = false; btn.textContent = 'Salva profilo'; });
    });` : ''}

    // ── Generate ──
    function doGenerate() {
      var desc = document.getElementById('desc').value.trim();
      var clientName = document.getElementById('clientName').value.trim();
      if (!clientName) { showError('Inserisci il nome del cliente'); return; }
      if (!desc) { showError('Inserisci la descrizione del lavoro'); return; }
      if (isRecording) stopRecording();

      document.getElementById('error').style.display = 'none';
      document.getElementById('panel1').classList.remove('active');
      document.getElementById('loadingPanel').classList.add('active');

      var body = {
        job_description: desc,
        pricing_preset: selectedPriceLevel,
        priceLevel: selectedPriceLevel,
        urgency: 'normale',
        profession: '${esc(user.category || "")}',
        jobType: '',
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
        document.getElementById('loadingPanel').classList.remove('active');
        if (data.success) {
          previewData = data;
          localItems = data.preview.line_items.map(function(it) {
            return {
              description: it.description,
              quantity: it.quantity || 1,
              unit_price: it.unit_price || 0,
              subtotal: it.subtotal || 0,
              confidence: it.confidence || null,
              explanation: it.explanation || null,
              needs_input: it.needs_input || false,
              _unit_cost: it.unit_cost || 0,
              _margin_percent: it.margin_percent || 0,
              _ai_suggested: it.ai_suggested || null
            };
          });
          // Set notes if AI returned them
          if (data.preview.notes) document.getElementById('notesField').value = data.preview.notes;
          renderPreview();
          // Go to step 2
          document.querySelectorAll('.step-panel').forEach(function(p) { p.classList.remove('active'); });
          document.getElementById('panel2').classList.add('active');
          document.getElementById('tab1').classList.remove('active');
          document.getElementById('tab1').classList.add('done');
          document.getElementById('tab2').classList.add('active');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById('panel1').classList.add('active');
          showError(data.error || data.detail || 'Errore durante la generazione');
        }
      })
      .catch(function() {
        document.getElementById('loadingPanel').classList.remove('active');
        document.getElementById('panel1').classList.add('active');
        showError('Errore di rete. Riprova.');
      });
    }

    document.getElementById('generateBtn').addEventListener('click', doGenerate);
    document.getElementById('regenBtn').addEventListener('click', doGenerate);

    // ── Back to step 1 ──
    document.getElementById('backToStep1').addEventListener('click', function() {
      window._goStep(1);
    });

    // ── Render preview ──
    function renderPreview() {
      var clientName = document.getElementById('clientName').value;
      var clientEmail = document.getElementById('clientEmail').value;
      document.getElementById('summaryClient').textContent = clientName;
      document.getElementById('summaryEmail').textContent = clientEmail || 'Email non specificata';
      document.getElementById('clientAvatar').textContent = clientName.charAt(0).toUpperCase();
      document.getElementById('summaryJob').textContent = document.getElementById('desc').value;

      var container = document.getElementById('lineItems');
      container.innerHTML = '';

      localItems.forEach(function(item, idx) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-idx', idx);

        var confHtml = '';
        if (item.confidence) {
          var confLabels = { high: 'Alta', medium: 'Media', low: 'Bassa' };
          confHtml = '<span class="conf-badge ' + item.confidence + '" title="' + escHtml(item.explanation || '') + '"><span class="conf-badge-dot"></span>Stima: ' + (confLabels[item.confidence] || item.confidence) + '</span>';
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
            '</div>' +
          '</div>' +
          '<div class="item-card-fields">' +
            '<div class="item-field"><span class="item-field-label">Quantita</span><input type="number" class="prev-qty" data-idx="' + idx + '" value="' + item.quantity + '" min="1" step="1"></div>' +
            '<div class="item-field"><span class="item-field-label">Prezzo unit.</span><input type="number" class="prev-price" data-idx="' + idx + '" value="' + item.unit_price + '" min="0" step="0.01"></div>' +
            '<div class="item-field"><span class="item-field-label">Subtotale</span><div class="subtotal-value prev-subtotal">' + fmtNum(item.subtotal) + ' &euro;</div></div>' +
          '</div>' +
          (confHtml ? '<div style="margin-top:8px">' + confHtml + '</div>' : '');

        container.appendChild(card);

        if (item.needs_input || item.confidence === 'low') {
          var niDiv = document.createElement('div');
          niDiv.className = 'needs-input-bar';
          niDiv.innerHTML = '<span>&#9888; Stima incerta</span><input type="text" class="ni-input" data-idx="' + idx + '" placeholder="Aggiungi dettagli..."><button type="button" onclick="window._reEstimate(' + idx + ',this)">Ricalcola</button>';
          card.appendChild(niDiv);
        }
      });

      updateTotalsDisplay();
    }

    // ── Client-side recalculation ──
    document.getElementById('lineItems').addEventListener('input', function(e) {
      var idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx) || !localItems[idx]) return;
      var item = localItems[idx];
      var card = e.target.closest('.item-card');

      if (e.target.classList.contains('prev-desc')) {
        item.description = e.target.value;
        clearTimeout(acTimer);
        acTimer = setTimeout(function() { doAutocomplete(idx, e.target.value); }, 300);
        return;
      }
      if (e.target.classList.contains('prev-qty')) {
        item.quantity = Math.max(1, parseInt(e.target.value) || 1);
      } else if (e.target.classList.contains('prev-price')) {
        item.unit_price = Math.max(0, parseFloat(e.target.value) || 0);
      }
      item.subtotal = round2(item.quantity * item.unit_price);
      card.querySelector('.prev-subtotal').innerHTML = fmtNum(item.subtotal) + ' &euro;';
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
            return '<div class="ac-item" data-ac-idx="' + idx + '" data-ac-item="' + i + '"><span>' + escHtml(it.description) + '</span><span class="ac-source">' + srcLabel + ' &middot; ' + fmtNum(it.last_unit_price) + '&euro;</span></div>';
          }).join('');
          dd.classList.add('open');
          dd._items = data.items;
        })
        .catch(function() { dd.classList.remove('open'); });
    }

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
      localItems[idx].unit_price = sel.last_unit_price || 0;
      localItems[idx].subtotal = round2(localItems[idx].quantity * localItems[idx].unit_price);
      dd.classList.remove('open'); dd.innerHTML = '';
      renderPreview();
    });

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
      localItems.push({ description: '', quantity: 1, unit_price: 0, subtotal: 0, confidence: null, explanation: null, needs_input: false });
      renderPreview();
      var descs = document.querySelectorAll('.prev-desc');
      if (descs.length) descs[descs.length - 1].focus();
    };
    window._delRow = function(idx) { if (localItems.length <= 1) return; localItems.splice(idx, 1); renderPreview(); };
    window._dupRow = function(idx) { var copy = JSON.parse(JSON.stringify(localItems[idx])); localItems.splice(idx + 1, 0, copy); renderPreview(); };

    window._reEstimate = function(idx, btn) {
      var niBar = btn.closest('.needs-input-bar');
      var input = niBar.querySelector('.ni-input');
      var userInput = input ? input.value.trim() : '';
      if (!userInput) { input.style.borderColor = '#ef4444'; return; }
      btn.disabled = true; btn.textContent = 'Ricalcolo...';
      fetch('/quotes/re-estimate-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: localItems[idx].description, user_input: userInput, pricing_preset: previewData.pricing_preset })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.item) {
          var it = data.item;
          localItems[idx].description = it.description || localItems[idx].description;
          localItems[idx].unit_price = it.unit_price;
          localItems[idx].subtotal = round2(localItems[idx].quantity * it.unit_price);
          localItems[idx].confidence = it.confidence;
          localItems[idx].explanation = it.explanation;
          localItems[idx].needs_input = it.needs_input;
          renderPreview();
        } else { btn.disabled = false; btn.textContent = 'Ricalcola'; showError(data.error || 'Errore ri-stima'); }
      })
      .catch(function() { btn.disabled = false; btn.textContent = 'Ricalcola'; showError('Errore di rete'); });
    };

    document.getElementById('addRowBtn').addEventListener('click', function() { window._addRow(); });

    // ── CSV export ──
    document.getElementById('exportCsvBtn').addEventListener('click', function() {
      var sep = ';';
      var header = 'Descrizione' + sep + 'Quantita' + sep + 'Prezzo unitario' + sep + 'Subtotale';
      var rows = localItems.map(function(it) {
        return [it.description, it.quantity, it.unit_price, it.subtotal].map(function(v) { return typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(sep);
      });
      var csv = '\\uFEFF' + header + '\\n' + rows.join('\\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'preventivo.csv'; a.click();
      URL.revokeObjectURL(url);
    });

    // ── Paste from Excel ──
    document.getElementById('lineItems').addEventListener('paste', function(e) {
      if (!e.target.classList.contains('prev-desc')) return;
      var text = (e.clipboardData || window.clipboardData).getData('text');
      var lines = text.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
      if (lines.length < 2) return;
      e.preventDefault();
      var idx = parseInt(e.target.dataset.idx);
      lines.forEach(function(line, li) {
        var cols = line.split('\\t');
        var row = { description: (cols[0] || '').trim(), quantity: Math.max(1, parseInt(cols[1]) || 1), unit_price: Math.max(0, parseFloat(cols[2]) || 0), subtotal: 0, confidence: null, explanation: null, needs_input: false };
        row.subtotal = round2(row.quantity * row.unit_price);
        if (li === 0) localItems[idx] = row; else localItems.splice(idx + li, 0, row);
      });
      renderPreview();
    });

    // ── Confirm: Save and send ──
    function doSave(sendEmail) {
      var btn = sendEmail ? document.getElementById('confirmBtn') : document.getElementById('saveDraftBtn');
      btn.disabled = true;
      btn.textContent = sendEmail ? 'Salvataggio e invio...' : 'Salvataggio...';
      document.getElementById('error').style.display = 'none';

      var tp = getSelectedTaxProfile();
      var cassaPercent = tp.previdenza_percent || 0;
      var ivaPercent = tp.iva_percent || 0;
      var sub = calcSubtotal();
      var cassaAmount = cassaPercent ? round2(sub * cassaPercent / 100) : 0;
      var taxableForIva = round2(sub + cassaAmount);
      var tax = round2(taxableForIva * ivaPercent / 100);

      var taxProfile = { id: tp.id, name: tp.name, previdenza_percent: cassaPercent, iva_percent: ivaPercent, note: tp.note || '' };

      var clientItems = localItems.map(function(it) {
        return { description: it.description, quantity: it.quantity, unit_price: it.unit_price };
      });

      var clientEmail = document.getElementById('clientEmail').value.trim();

      var body = {
        job_description: previewData.job_description,
        pricing_preset: previewData.pricing_preset || 'standard',
        ai_generated: previewData.ai_generated,
        profession: '${esc(user.category || "")}',
        tax_profile: taxProfile,
        client: {
          name: document.getElementById('clientName').value.trim(),
          email: clientEmail || '',
          phone: (document.getElementById('clientPhone').value || '').trim()
        },
        preview: {
          line_items: clientItems,
          subtotal: sub,
          cassa: cassaAmount,
          taxes: tax,
          total: round2(sub + cassaAmount + tax),
          currency: previewData.preview.currency || 'EUR',
          payment_terms: getPaymentTermsLabel(),
          validity_days: previewData.preview.validity_days || 14,
          notes: document.getElementById('notesField').value.trim() || previewData.preview.notes || null
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
          var msg = clientEmail ? 'Preventivo inviato a ' + clientEmail + '!' : 'Preventivo salvato!';
          document.getElementById('successMsg').textContent = msg;
          document.getElementById('successOverlay').classList.add('show');
          setTimeout(function() { window.location.href = '/dashboard'; }, 2000);
        } else {
          showError(result.error || 'Errore durante il salvataggio');
          btn.disabled = false;
          btn.textContent = sendEmail ? 'Salva e invia' : 'Salva bozza';
        }
      })
      .catch(function() {
        showError('Errore di rete. Riprova.');
        btn.disabled = false;
        btn.textContent = sendEmail ? 'Salva e invia' : 'Salva bozza';
      });
    }

    document.getElementById('confirmBtn').addEventListener('click', function() { doSave(true); });
    document.getElementById('saveDraftBtn').addEventListener('click', function() { doSave(false); });

    // ── Totals ──
    function calcSubtotal() {
      return localItems.reduce(function(s, i) { return s + (i.subtotal || 0); }, 0);
    }

    function updateTotalsDisplay() {
      var sub = round2(calcSubtotal());
      var tp = getSelectedTaxProfile();
      var cassaPercent = tp.previdenza_percent || 0;
      var ivaPercent = tp.iva_percent || 0;
      var cassaAmount = cassaPercent ? round2(sub * cassaPercent / 100) : 0;
      var taxableForIva = round2(sub + cassaAmount);
      var ivaAmount = round2(taxableForIva * ivaPercent / 100);
      var tot = round2(sub + cassaAmount + ivaAmount);

      document.getElementById('subtotal').innerHTML = fmtNum(sub) + ' &euro;';
      var cassaRow = document.getElementById('cassaRow');
      if (cassaAmount > 0) {
        cassaRow.style.display = 'flex';
        document.getElementById('cassaLabel').textContent = 'Cassa previdenziale ' + cassaPercent + '%';
        document.getElementById('cassaAmount').innerHTML = fmtNum(cassaAmount) + ' &euro;';
      } else { cassaRow.style.display = 'none'; }
      document.getElementById('ivaLabel').textContent = ivaPercent > 0 ? ('IVA ' + ivaPercent + '%') : 'IVA (esente)';
      document.getElementById('taxes').innerHTML = fmtNum(ivaAmount) + ' &euro;';
      document.getElementById('total').innerHTML = fmtNum(tot) + ' &euro;';
    }

    function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
    function showError(msg) { var el = document.getElementById('error'); el.textContent = msg; el.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function showToast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 2000); }
    function escHtml(str) { var d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML.replace(/"/g, '&quot;'); }
    function fmtNum(n) { return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  })();`;

  res.send(page({ title: "Nuovo preventivo", user, content, extraCss, script, activePage: "new" }));
});

// ── Categorie non artigiane — guardrail ──
const NON_ARTIGIANO_CATEGORIES = ['consulenti', 'tecnici', 'sanitario', 'digital'];

// ── Voci VIETATE per categorie non artigiane ──
const BANNED_TERMS_NON_ARTIGIANO = [
  "manodopera", "materiali", "trasporto", "smaltimento", "movimentazione",
  "calcinacci", "macerie", "posa in opera", "fornitura e posa",
  "raccorderia", "guarnizioni", "massetto", "intonaco", "tinteggiatura"
];

// ── Map profession → category ──
const PROFESSION_TO_CATEGORY = {
  // Artigiani
  idraulico: 'idraulico', elettricista: 'elettricista', muratore: 'edilizia',
  falegname: 'falegname', imbianchino: 'imbianchino', fabbro: 'edilizia',
  piastrellista: 'edilizia', giardiniere: 'giardiniere', serramentista: 'falegname',
  // Consulenti
  avvocato: 'consulenti', commercialista: 'consulenti',
  'consulente aziendale': 'consulenti', 'consulente IT': 'consulenti',
  'consulente del lavoro': 'consulenti', notaio: 'consulenti',
  // Tecnici
  geometra: 'tecnici', ingegnere: 'tecnici', architetto: 'tecnici',
  'perito industriale': 'tecnici', 'tecnico informatico': 'tecnici',
  // Sanitario
  medico: 'sanitario', odontoiatra: 'sanitario', psicologo: 'sanitario',
  fisioterapista: 'sanitario', veterinario: 'sanitario',
  // Digital
  grafico: 'digital', fotografo: 'digital', 'web designer': 'digital',
  videomaker: 'digital', traduttore: 'digital', copywriter: 'digital'
};

// ── Template professionali per tipo di incarico (non keyword vaghe) ──
// Ogni categoria ha template indicizzati per jobType (tipo incarico selezionato dall'utente)
const PROFESSIONAL_TEMPLATES = {
  consulenti: {
    _default: [
      { description: "Onorario professionale", cost: 500 },
      { description: "Studio e analisi preliminare", cost: 300 },
      { description: "Redazione documentazione", cost: 350 },
      { description: "Spese vive documentate", cost: 80 },
    ],
    "contenzioso civile": [
      { description: "Onorario professionale — fase di studio", cost: 400 },
      { description: "Studio e analisi della pratica", cost: 300 },
      { description: "Redazione atti giudiziari", cost: 600 },
      { description: "Assistenza in udienza", cost: 450 },
      { description: "Attivita continuativa e corrispondenza", cost: 250 },
      { description: "Spese vive documentate (bolli, contributo unificato, notifiche)", cost: 120 },
    ],
    "consulenza contrattuale": [
      { description: "Onorario professionale", cost: 400 },
      { description: "Analisi documentazione esistente", cost: 250 },
      { description: "Redazione contratto", cost: 500 },
      { description: "Negoziazione e revisioni", cost: 300 },
      { description: "Spese vive documentate", cost: 50 },
    ],
    "redazione atti": [
      { description: "Onorario professionale", cost: 350 },
      { description: "Studio e analisi preliminare", cost: 200 },
      { description: "Redazione atti e documenti", cost: 500 },
      { description: "Revisioni e finalizzazione", cost: 150 },
      { description: "Spese vive documentate (bolli, diritti)", cost: 80 },
    ],
    "diritto societario": [
      { description: "Onorario professionale — consulenza societaria", cost: 500 },
      { description: "Analisi assetto societario", cost: 300 },
      { description: "Redazione atti societari", cost: 400 },
      { description: "Assistenza assemblee e delibere", cost: 350 },
      { description: "Spese vive documentate (notaio, bolli, CCIAA)", cost: 200 },
    ],
    "recupero crediti": [
      { description: "Onorario professionale", cost: 350 },
      { description: "Studio della posizione debitoria", cost: 200 },
      { description: "Redazione diffida/messa in mora", cost: 250 },
      { description: "Attivita stragiudiziale di recupero", cost: 300 },
      { description: "Spese vive documentate", cost: 60 },
    ],
    "consulenza fiscale": [
      { description: "Onorario professionale", cost: 400 },
      { description: "Analisi situazione fiscale", cost: 300 },
      { description: "Redazione parere/relazione", cost: 350 },
      { description: "Assistenza continuativa", cost: 250 },
      { description: "Spese vive documentate", cost: 50 },
    ],
    "assistenza stragiudiziale": [
      { description: "Onorario professionale", cost: 400 },
      { description: "Studio e analisi della pratica", cost: 250 },
      { description: "Redazione corrispondenza e diffide", cost: 300 },
      { description: "Attivita di negoziazione", cost: 350 },
      { description: "Spese vive documentate", cost: 60 },
    ],
    // Legacy/generic names
    "onorario/parcella": null, // → _default
    "analisi e studio": null,
    "consulenza": null,
    "spese accessorie": null,
    "bolli e diritti": null,
  },
  tecnici: {
    _default: [
      { description: "Onorario professionale", cost: 500 },
      { description: "Sopralluogo e rilievi", cost: 300 },
      { description: "Elaborazione tecnica", cost: 400 },
      { description: "Spese vive documentate (diritti, bolli)", cost: 100 },
    ],
    "progettazione": [
      { description: "Onorario professionale — progettazione", cost: 600 },
      { description: "Rilievo e stato di fatto", cost: 350 },
      { description: "Progettazione architettonica/tecnica", cost: 900 },
      { description: "Computo metrico estimativo", cost: 300 },
      { description: "Direzione lavori", cost: 500 },
      { description: "Spese vive documentate", cost: 120 },
    ],
    "analisi tecnica": [
      { description: "Onorario professionale", cost: 400 },
      { description: "Sopralluogo e rilievi", cost: 300 },
      { description: "Analisi tecnica e relazione", cost: 500 },
      { description: "Spese vive documentate", cost: 80 },
    ],
    "direzione lavori": [
      { description: "Onorario professionale — direzione lavori", cost: 700 },
      { description: "Sopralluoghi periodici di cantiere", cost: 400 },
      { description: "Coordinamento imprese e contabilita lavori", cost: 500 },
      { description: "Collaudo e chiusura lavori", cost: 300 },
      { description: "Spese vive documentate", cost: 100 },
    ],
    "pratiche/permessi": [
      { description: "Onorario professionale — pratiche edilizie", cost: 400 },
      { description: "Pratica edilizia (CILA/SCIA/PDC)", cost: 450 },
      { description: "Accatastamento e variazioni catastali", cost: 350 },
      { description: "Spese vive documentate (diritti segreteria, bolli)", cost: 150 },
    ],
    "sopralluoghi": [
      { description: "Onorario professionale", cost: 300 },
      { description: "Sopralluogo e rilievi in sito", cost: 250 },
      { description: "Perizia tecnica estimativa", cost: 500 },
      { description: "Relazione tecnica", cost: 350 },
      { description: "Spese vive documentate", cost: 80 },
    ],
  },
  sanitario: {
    _default: [
      { description: "Prestazione professionale", cost: 120 },
      { description: "Esami/accertamenti diagnostici", cost: 100 },
      { description: "Refertazione e relazione clinica", cost: 60 },
    ],
    "visita/seduta": [
      { description: "Prima visita specialistica", cost: 120 },
      { description: "Esami diagnostici", cost: 150 },
      { description: "Refertazione e piano terapeutico", cost: 60 },
    ],
    "trattamento": [
      { description: "Piano di trattamento personalizzato", cost: 150 },
      { description: "Sedute di trattamento", cost: 100 },
      { description: "Dispositivi e materiali sanitari", cost: 50 },
      { description: "Controlli periodici", cost: 60 },
    ],
    "esami diagnostici": [
      { description: "Prestazione professionale", cost: 100 },
      { description: "Esami strumentali/diagnostici", cost: 200 },
      { description: "Refertazione specialistica", cost: 80 },
    ],
    "materiali sanitari": [
      { description: "Prestazione professionale", cost: 120 },
      { description: "Dispositivi e materiali protesici/sanitari", cost: 350 },
      { description: "Sedute applicative", cost: 150 },
      { description: "Controlli e aggiustamenti", cost: 80 },
    ],
  },
  digital: {
    _default: [
      { description: "Onorario professionale — progettazione creativa", cost: 400 },
      { description: "Produzione e realizzazione", cost: 600 },
      { description: "Revisioni incluse (max 2 cicli)", cost: 150 },
      { description: "Consegna file e asset finali", cost: 50 },
    ],
    "progettazione creativa": [
      { description: "Onorario professionale — concept e progettazione", cost: 450 },
      { description: "Progettazione creativa e bozze", cost: 400 },
      { description: "Declinazioni e adattamenti", cost: 250 },
      { description: "Revisioni incluse (max 2 cicli)", cost: 150 },
      { description: "Consegna file sorgenti e definitivi", cost: 50 },
    ],
    "produzione": [
      { description: "Onorario professionale", cost: 400 },
      { description: "Pre-produzione e pianificazione", cost: 300 },
      { description: "Produzione/realizzazione", cost: 600 },
      { description: "Post-produzione e finalizzazione", cost: 400 },
      { description: "Consegna file e asset finali", cost: 50 },
    ],
    "revisioni": [
      { description: "Onorario professionale", cost: 300 },
      { description: "Analisi e revisione materiale esistente", cost: 250 },
      { description: "Modifiche e ottimizzazione", cost: 350 },
      { description: "Consegna file aggiornati", cost: 50 },
    ],
    "consegna": [
      { description: "Onorario professionale", cost: 350 },
      { description: "Preparazione e ottimizzazione file", cost: 200 },
      { description: "Consegna multi-formato", cost: 100 },
      { description: "Licenze e diritti d'uso", cost: 150 },
    ],
    "licenze": [
      { description: "Onorario professionale", cost: 300 },
      { description: "Cessione diritti d'uso", cost: 250 },
      { description: "Licenze asset terze parti", cost: 150 },
    ],
  },
  // ── ARTIGIANI: mantiene la logica keyword-based originale ──
  idraulico: {
    _keywords: [
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
    _default: [
      { description: "Manodopera specializzata", cost: 200 },
      { description: "Materiali e forniture", cost: 150 },
      { description: "Trasporto e movimentazione", cost: 80 },
    ]
  },
  elettricista: {
    _keywords: [
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
    _default: [
      { description: "Manodopera specializzata", cost: 200 },
      { description: "Materiali e componenti elettrici", cost: 150 },
      { description: "Certificazione impianto", cost: 100 },
    ]
  },
  edilizia: {
    _keywords: [
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
    ],
    _default: [
      { description: "Manodopera specializzata", cost: 250 },
      { description: "Materiali e forniture edili", cost: 200 },
      { description: "Trasporto e smaltimento", cost: 100 },
    ]
  },
  imbianchino: {
    _keywords: [
      { keywords: ["tinteggiatura", "pittura", "imbiancatura", "verniciatura", "pareti"], items: [
        { description: "Preparazione e stuccatura superfici", cost: 150 },
        { description: "Tinteggiatura pareti (2 mani)", cost: 250 },
        { description: "Tinteggiatura soffitti", cost: 180 },
      ]},
      { keywords: ["velatura", "decorativa", "effetto", "stucco veneziano"], items: [
        { description: "Finitura decorativa/velatura", cost: 350 },
        { description: "Materiali pittura decorativa", cost: 120 },
      ]},
    ],
    _default: [
      { description: "Manodopera — tinteggiatura", cost: 200 },
      { description: "Materiali e pitture", cost: 120 },
      { description: "Preparazione superfici", cost: 100 },
    ]
  },
  falegname: {
    _keywords: [
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
    _default: [
      { description: "Manodopera specializzata", cost: 250 },
      { description: "Legname e materiali", cost: 200 },
      { description: "Ferramenta e accessori", cost: 80 },
    ]
  },
  giardiniere: {
    _keywords: [
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
    ],
    _default: [
      { description: "Manodopera giardinaggio", cost: 180 },
      { description: "Piante e materiali", cost: 200 },
      { description: "Smaltimento verde", cost: 60 },
    ]
  }
};

// ── validateQuoteItems — Guardrail: scarta voci incoerenti ──
function validateQuoteItems(category, items) {
  if (!NON_ARTIGIANO_CATEGORIES.includes(category)) {
    // Artigiani: nessun filtro aggressivo
    return { valid: true, items };
  }

  const validItems = [];
  const rejected = [];

  for (const item of items) {
    const descLower = (item.description || "").toLowerCase();
    const isBanned = BANNED_TERMS_NON_ARTIGIANO.some(term => descLower.includes(term));
    if (isBanned) {
      rejected.push(item.description);
    } else {
      validItems.push(item);
    }
  }

  if (rejected.length > 0) {
    console.warn(`[validateQuoteItems] Categoria "${category}" — scartate ${rejected.length} voci incoerenti:`, rejected);
  }

  // Se dopo il filtro restano meno di 2 voci, forza rigenerazione dal template _default
  if (validItems.length < 2) {
    return { valid: false, items: validItems, rejected };
  }

  return { valid: true, items: validItems, rejected };
}

// ── Smart Mock fallback — genera voci basate su categoria + tipo incarico ──

function buildMockPreview(job_description, pricing_preset, user, profession, payment_terms, jobType) {
  const multiplier = { economico: 0.7, economy: 0.7, standard: 1, premium: 1.5 }[pricing_preset] || 1;
  const defaultMargin = { economico: 20, economy: 20, standard: 30, premium: 40 }[pricing_preset] || 30;

  const userProfile = user ? getUserPrompt(user.id) : null;
  const margin = (userProfile && userProfile.profile && userProfile.profile.margine_medio)
    ? userProfile.profile.margine_medio
    : defaultMargin;
  const desc = job_description.toLowerCase();

  // ── Resolve category from profession (mandatory) > user profile ──
  let detectedCategory = (profession && PROFESSION_TO_CATEGORY[profession])
    || (user && user.category && PROFESSION_TO_CATEGORY[user.category])
    || "";

  const template = PROFESSIONAL_TEMPLATES[detectedCategory];
  let matchedItems = [];

  if (template) {
    if (NON_ARTIGIANO_CATEGORIES.includes(detectedCategory)) {
      // ── NON-ARTIGIANO: logica basata su jobType (tipo incarico), NON keyword vaghe ──
      const normalizedJobType = (jobType || "").toLowerCase().trim();

      // 1) Match esatto per jobType selezionato
      if (normalizedJobType && template[normalizedJobType]) {
        matchedItems = template[normalizedJobType].map(it => ({ ...it }));
      }

      // 2) Match parziale (jobType contiene o è contenuto nella chiave)
      if (!matchedItems.length && normalizedJobType) {
        for (const [key, items] of Object.entries(template)) {
          if (key.startsWith('_') || !items) continue;
          if (normalizedJobType.includes(key) || key.includes(normalizedJobType)) {
            matchedItems = items.map(it => ({ ...it }));
            break;
          }
        }
      }

      // 3) Fallback al _default della categoria — MAI a keyword vaghe
      if (!matchedItems.length) {
        matchedItems = (template._default || []).map(it => ({ ...it }));
      }

    } else {
      // ── ARTIGIANO: logica keyword-based (mantiene comportamento originale) ──
      const kwGroups = template._keywords || [];
      for (const group of kwGroups) {
        if (group.keywords.some(kw => desc.includes(kw))) {
          matchedItems.push(...group.items);
        }
      }
      // Se nessun match keyword, usa _default artigiano
      if (!matchedItems.length) {
        matchedItems = (template._default || []).map(it => ({ ...it }));
      }
      // Per artigiani: aggiungi manodopera se non presente
      const hasManodopera = matchedItems.some(it => it.description.toLowerCase().includes("manodopera"));
      if (!hasManodopera && matchedItems.length <= 5) {
        matchedItems.unshift({ description: "Manodopera specializzata", cost: 200 });
      }
    }
  } else {
    // ── Categoria sconosciuta — fallback generico artigiano ──
    const words = job_description.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
    matchedItems = [
      { description: "Manodopera — " + (words[0] || "intervento"), cost: 250 },
      { description: "Materiali e forniture", cost: 150 },
      { description: "Trasporto e movimentazione", cost: 80 },
    ];
  }

  // Limit to 6 items max and apply multiplier
  matchedItems = matchedItems.slice(0, 6);

  let items = matchedItems.map(it => ({
    description: it.description,
    quantity: 1,
    unit_cost: Math.round(it.cost * multiplier),
    margin_percent: margin
  }));

  // ── Guardrail: valida le voci per coerenza con la categoria ──
  const validation = validateQuoteItems(detectedCategory, items);
  if (!validation.valid) {
    // Rigenerazione forzata dal _default della categoria
    console.warn(`[buildMockPreview] Rigenerazione forzata per categoria "${detectedCategory}" — voci incoerenti rilevate`);
    const fallback = (template && template._default) || [
      { description: "Onorario professionale", cost: 400 },
      { description: "Studio e analisi preliminare", cost: 250 },
      { description: "Spese vive documentate", cost: 80 },
    ];
    items = fallback.map(it => ({
      description: it.description,
      quantity: 1,
      unit_cost: Math.round(it.cost * multiplier),
      margin_percent: margin
    }));
  } else {
    items = validation.items;
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
  const jobType = (req.body.jobType || "").trim();
  const priceLevel = (req.body.priceLevel || "standard").trim();
  const urgency = (req.body.urgency || "normale").trim();
  const margin = user.defaultMargin || 30;
  const notes = (req.body.notes || "").trim();

  if (!job_description) {
    return res.status(400).json({ success: false, error: "La descrizione del lavoro è obbligatoria" });
  }

  let preview;
  let ai_generated = false;
  // Store internal AI data for later use in /create
  let _internalItems = [];

  // If the user has a custom priceList, use it directly (no AI call)
  if (Array.isArray(user.priceList) && user.priceList.length > 0) {
    preview = buildPriceListPreview(user.priceList, pricing_preset);
    _internalItems = preview.line_items.map(it => ({ ...it }));
  } else {
    try {
      if (claude.isAvailable()) {
        const aiResult = await claude.generateCostSuggestions({
          user_id: user.id,
          professional: { name: user.name, category: user.category, city: user.city },
          job_description,
          pricing_preset,
          profession,
          jobType,
          priceLevel,
          urgency,
          notes,
          language: "it"
        });

        // Processa suggerimenti AI attraverso il pricing engine
        let processedItems = pricingEngine.processAiSuggestions(aiResult.suggestions || []);

        // ── Guardrail AI: valida voci per categoria ──
        const aiCategory = (profession && PROFESSION_TO_CATEGORY[profession])
          || (user && user.category && PROFESSION_TO_CATEGORY[user.category]) || "";
        const aiValidation = validateQuoteItems(aiCategory, processedItems);

        if (!aiValidation.valid) {
          // AI ha generato voci incoerenti — fallback al mock deterministico
          console.warn(`[preview AI] Guardrail attivato per "${aiCategory}" — ${(aiValidation.rejected || []).length} voci incoerenti, fallback a mock`);
          preview = buildMockPreview(job_description, pricing_preset, user, profession, payment_terms, jobType);
          _internalItems = preview.line_items.map(it => ({ ...it }));
          ai_generated = false;
        } else {
          processedItems = aiValidation.items;
          const quoted = pricingEngine.processQuote(processedItems);

          // Salva dati interni (cost/margin) per uso backend
          _internalItems = quoted.line_items.map((item, i) => ({
            ...item,
            confidence: processedItems[i].confidence,
            explanation: processedItems[i].explanation,
            needs_input: processedItems[i].needs_input,
            ai_suggested: processedItems[i].ai_suggested
          }));

          // Frontend riceve SOLO description, quantity, unit_price, subtotal + metadata AI
          preview = {
            line_items: quoted.line_items.map((item, i) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              confidence: processedItems[i].confidence,
              explanation: processedItems[i].explanation,
              needs_input: processedItems[i].needs_input,
              unit_cost: item.unit_cost,
              margin_percent: item.margin_percent,
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
        }
      } else {
        preview = buildMockPreview(job_description, pricing_preset, user, profession, payment_terms, jobType);
        _internalItems = preview.line_items.map(it => ({ ...it }));
      }
    } catch (err) {
      console.error("Claude preview error, fallback mock:", err.message);
      preview = buildMockPreview(job_description, pricing_preset, user, profession, payment_terms, jobType);
      _internalItems = preview.line_items.map(it => ({ ...it }));
    }
  }

  const userProfile = getUserPrompt(user.id);
  const has_user_profile = !!(userProfile && userProfile.context_prompt);

  // Salva dati interni nella sessione per il /create
  req.session._lastPreviewItems = _internalItems;
  req.session._lastPreviewMargin = margin;

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

router.post("/create", requirePlan, async (req, res) => {
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

  // Ricostruisci cost/margin dal backend (il frontend manda solo unit_price)
  const lastPreviewItems = req.session._lastPreviewItems || [];
  const savedMargin = req.session._lastPreviewMargin || user.defaultMargin || 30;

  const enrichedItems = preview.line_items.map(clientItem => {
    // Cerca la voce originale AI per descrizione
    const original = lastPreviewItems.find(ai =>
      ai.description === clientItem.description
    );

    if (original) {
      // L'utente potrebbe aver cambiato il prezzo: ricalcola margin dal prezzo originale AI
      const finalPrice = Number(clientItem.unit_price) || 0;
      const originalCost = original.unit_cost || 0;
      let margin = originalCost > 0
        ? pricingEngine.round2(((finalPrice - originalCost) / originalCost) * 100)
        : savedMargin;
      margin = Math.min(90, Math.max(0, margin));

      return {
        description: clientItem.description,
        quantity: clientItem.quantity || 1,
        unit_cost: originalCost,
        margin_percent: margin,
        unit_price: finalPrice,
        subtotal: pricingEngine.round2((clientItem.quantity || 1) * finalPrice)
      };
    } else {
      // Voce aggiunta manualmente — stima cost da margin predefinito
      const finalPrice = Number(clientItem.unit_price) || 0;
      const estimatedCost = pricingEngine.round2(finalPrice / (1 + savedMargin / 100));
      return {
        description: clientItem.description,
        quantity: clientItem.quantity || 1,
        unit_cost: estimatedCost,
        margin_percent: savedMargin,
        unit_price: finalPrice,
        subtotal: pricingEngine.round2((clientItem.quantity || 1) * finalPrice)
      };
    }
  });

  // Valida e ricalcola con il pricing engine
  const validated = pricingEngine.processQuote(enrichedItems);

  // Calcolo fiscale con profilo
  const tp = tax_profile || {};
  const fiscal = pricingEngine.computeFiscalTotals(validated.subtotal, tp);

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
    subtotal: fiscal.imponibile,
    cassa: fiscal.cassa,
    taxes: fiscal.iva,
    total: fiscal.totale,
    margin_avg: pricingEngine.round2(validated.line_items.reduce((s, i) => s + i.margin_percent, 0) / (validated.line_items.length || 1)),
    currency: preview.currency || "EUR",
    payment_terms: preview.payment_terms || "50% acconto, saldo a fine lavori",
    validity_days: preview.validity_days || 14,
    notes: preview.notes || null,
    status: "draft"
  };

  saveQuote(quote);

  // Pulisci dati di sessione
  delete req.session._lastPreviewItems;
  delete req.session._lastPreviewMargin;

  // Invio email automatico al cliente
  try {
    const baseUrl = req.baseUrl_resolved || `${req.protocol}://${req.get("host")}`;
    const acceptUrl = `${baseUrl}/q/${quoteId}/accept`;
    const viewUrl = `${baseUrl}/q/${quoteId}`;
    const emailHtml = buildQuoteEmailHTML(quote, acceptUrl, viewUrl);
    const emailResult = await sendOrLog(client.email, `Preventivo ${quoteId} da ${user.name}`, emailHtml, quoteId);

    if (emailResult.sent) {
      updateQuote(quoteId, { status: "sent", email_status: "sent", email_sent_at: new Date().toISOString() });
    } else if (emailResult.logged) {
      updateQuote(quoteId, { status: "sent", email_status: "logged", email_sent_at: new Date().toISOString() });
    } else if (emailResult.failed) {
      updateQuote(quoteId, { status: "draft", email_status: "failed", email_error: emailResult.error });
    }
  } catch (err) {
    console.error("[NewQuote] Errore invio email:", err.message);
    updateQuote(quoteId, { status: "draft", email_status: "failed", email_error: err.message });
  }

  // Se AI-generated, registra feedback per le voci modificate dall'utente
  if (req.body.ai_generated && lastPreviewItems.length > 0) {
    validated.line_items.forEach((userFinal, i) => {
      const aiOriginal = lastPreviewItems.find(ai => ai.description === userFinal.description);
      if (aiOriginal && aiOriginal.ai_suggested) {
        const aiSug = aiOriginal.ai_suggested;
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

  const baseUrlFinal = req.baseUrl_resolved || `${req.protocol}://${req.get("host")}`;

  res.status(201).json({
    success: true,
    quote_id: quoteId,
    public_link: `${baseUrlFinal}/q/${quoteId}`
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
    .desc-block{background:#f8f9fb;border-left:3px solid #0d9488;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:.93rem;line-height:1.6}
    .edit-input{border:1px solid transparent;background:transparent;padding:4px 8px;border-radius:4px;font-size:.88rem;font-family:inherit;transition:border-color .15s}
    .edit-input:hover{border-color:#ddd}
    .edit-input:focus{border-color:#0d9488;outline:none;background:#fff}
    .edit-desc{width:100%}
    .totals-block{text-align:right;margin:20px 0 24px}
    .totals-block .row{display:flex;justify-content:flex-end;gap:24px;padding:4px 0;font-size:.95rem}
    .totals-block .total-row{font-size:1.4rem;font-weight:700;color:#1c1917;border-top:2px solid #1c1917;padding-top:10px;margin-top:8px}
    .action-bar{display:flex;gap:10px;flex-wrap:wrap;padding-top:20px;border-top:1px solid #eee;margin-top:8px}
    .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:.78rem;font-weight:600}
    .notes-block{background:#f8f9fb;border-left:3px solid #0d9488;padding:14px 18px;border-radius:0 8px 8px 0;font-size:.9rem;line-height:1.6;margin-bottom:24px}
    .save-bar{display:none;background:#fff8e1;border-radius:8px;padding:12px 18px;margin-bottom:18px;font-size:.88rem;color:#856404;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
    .save-bar.visible{display:flex}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
    .confirm-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;align-items:center;justify-content:center}
    .confirm-overlay.show{display:flex}
    .confirm-box{background:#fff;border-radius:12px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.15)}
    .confirm-box h3{font-size:1.05rem;margin-bottom:8px}
    .confirm-box p{color:#888;font-size:.9rem;margin-bottom:24px}
    .confirm-box .btns{display:flex;gap:10px;justify-content:center}
    .row-action{background:none;border:none;cursor:pointer;font-size:1rem;padding:2px 6px;border-radius:4px;color:#888}
    .row-action:hover{color:#0d9488;background:#faf9f7}
    .detail-table-actions{margin-bottom:12px}
    .detail-table-actions button{padding:6px 14px;border-radius:6px;font-size:.8rem;font-weight:500;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#333;transition:all .15s}
    .detail-table-actions button:hover{background:#f0fdfa;border-color:#0d9488;color:#0d9488}
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
