// src/routes/prices.js
const express = require("express");
const router = express.Router();
const { getUserById, updateUser } = require("../utils/storage");
const { page, esc, fmt } = require("../utils/layout");
const claude = require("../utils/claude");

// GET /settings/prices
router.get("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const priceList = user.priceList || [];

  const rows = priceList.map((item, i) => `
    <tr data-idx="${i}">
      <td><input type="text" class="cell-input" name="description" value="${esc(item.description)}" placeholder="es. Manodopera idraulico"></td>
      <td><input type="number" class="cell-input cell-price" name="unit_price" value="${item.unit_price}" min="0" step="0.01" placeholder="0.00"></td>
      <td>
        <select class="cell-input" name="unit_measure">
          <option value="cadauno"${item.unit_measure === "cadauno" ? " selected" : ""}>cadauno</option>
          <option value="ora"${item.unit_measure === "ora" ? " selected" : ""}>ora</option>
          <option value="mq"${item.unit_measure === "mq" ? " selected" : ""}>mq</option>
          <option value="ml"${item.unit_measure === "ml" ? " selected" : ""}>ml</option>
          <option value="kg"${item.unit_measure === "kg" ? " selected" : ""}>kg</option>
          <option value="forfait"${item.unit_measure === "forfait" ? " selected" : ""}>forfait</option>
        </select>
      </td>
      <td>
        <select class="cell-input" name="preset">
          <option value="economy"${item.preset === "economy" ? " selected" : ""}>Economy</option>
          <option value="standard"${item.preset === "standard" ? " selected" : ""}>Standard</option>
          <option value="premium"${item.preset === "premium" ? " selected" : ""}>Premium</option>
        </select>
      </td>
      <td class="c"><button type="button" class="row-delete" title="Rimuovi">&times;</button></td>
    </tr>`).join("");

  const extraCss = `
    .prices-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:24px}
    .prices-header h2{font-size:1.15rem;font-weight:700}
    .prices-actions{display:flex;gap:8px;flex-wrap:wrap}
    .prices-table{overflow-x:auto;margin-bottom:20px}
    .cell-input{width:100%;padding:7px 10px;border:1px solid transparent;background:transparent;border-radius:4px;font-size:.86rem;font-family:inherit;transition:border-color .15s}
    .cell-input:hover{border-color:#d1d5db}
    .cell-input:focus{border-color:#0d9488;outline:none;background:#fff}
    .cell-price{text-align:right;width:100px}
    select.cell-input{cursor:pointer;padding:7px 6px}
    .row-delete{background:none;border:none;color:#ccc;font-size:1.2rem;cursor:pointer;padding:4px 8px;border-radius:4px;transition:color .15s}
    .row-delete:hover{color:#dc2626}
    .empty-row td{text-align:center;padding:32px;color:#9ca3af;font-size:.9rem}
    .import-section{margin-bottom:24px;padding:20px;background:#f8f9fb;border-radius:8px}
    .import-section label{font-size:.78rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:8px}
    .import-section input[type=file]{font-size:.84rem}
    .import-hint{font-size:.75rem;color:#9ca3af;margin-top:6px}
    .bottom-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:20px;border-top:1px solid #f0f0f0}
    .row-count{font-size:.82rem;color:#9ca3af}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
    .ai-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;align-items:center;justify-content:center}
    .ai-overlay.show{display:flex}
    .ai-box{background:#fff;border-radius:12px;padding:28px 32px;max-width:560px;width:92%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.15)}
    .ai-box h3{font-size:1.05rem;margin-bottom:12px}
    .ai-box textarea{width:100%;min-height:80px;margin-bottom:12px;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:.88rem;font-family:inherit;resize:vertical}
    .ai-box .ai-actions{display:flex;gap:8px;margin-bottom:16px}
    .ai-results{margin-top:16px}
    .ai-results table{margin-bottom:12px}
    .ai-results .ai-add{background:none;border:none;color:#0d9488;cursor:pointer;font-size:.82rem;font-weight:600;padding:2px 6px}
    .ai-results .ai-add:hover{text-decoration:underline}
    .ai-add-all{margin-top:8px}
  `;

  const content = `
  <div class="wrap" style="max-width:900px">
    <div class="card" style="padding:28px 32px">

      <div class="prices-header">
        <h2>Listino prezzi</h2>
        <div class="prices-actions">
          <button class="btn btn-secondary" id="aiSuggestBtn">Genera suggerimenti AI</button>
          <button class="btn btn-secondary" id="addRowBtn">+ Aggiungi voce</button>
        </div>
      </div>

      <div id="error" class="alert alert-error" style="display:none"></div>

      <!-- Import -->
      <div class="import-section">
        <label>Importa listino</label>
        <input type="file" id="importFile" accept=".csv,.json">
        <div class="import-hint">Formati accettati: CSV (descrizione;prezzo;unita;preset) o JSON array. Le voci importate vengono aggiunte al listino attuale.</div>
      </div>

      <!-- Tabella -->
      <div class="prices-table">
        <table id="pricesTable">
          <thead>
            <tr>
              <th style="min-width:240px">Descrizione</th>
              <th style="width:120px" class="r">Prezzo unit.</th>
              <th style="width:120px">Unità</th>
              <th style="width:120px">Fascia</th>
              <th style="width:50px" class="c"></th>
            </tr>
          </thead>
          <tbody id="tableBody">
            ${rows || '<tr class="empty-row"><td colspan="5">Il tuo listino &egrave; vuoto. Aggiungi le tue prime voci o clicca &ldquo;Genera suggerimenti AI&rdquo; per farti aiutare.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Barra azioni -->
      <div class="bottom-bar">
        <span class="row-count" id="rowCount">${priceList.length} voci</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="exportBtn">Esporta JSON</button>
          <button class="btn btn-primary" id="saveBtn">Salva listino</button>
        </div>
      </div>

    </div>
  </div>
  <div class="toast" id="toast"></div>

  <div class="ai-overlay" id="aiOverlay">
    <div class="ai-box">
      <h3>Genera suggerimenti AI</h3>
      <p style="font-size:.85rem;color:#888;margin-bottom:12px">Descrivi il tipo di lavoro e l'AI suggerirà voci e prezzi per il tuo listino.</p>
      <textarea id="aiDesc" placeholder="Es. Lavori idraulici residenziali: riparazioni, installazioni sanitari, tubature..."></textarea>
      <div class="ai-actions">
        <button class="btn btn-primary" id="aiGenerateBtn">Genera</button>
        <button class="btn btn-secondary" id="aiCloseBtn">Chiudi</button>
      </div>
      <div id="aiLoading" style="display:none;text-align:center;padding:16px">
        <div class="spinner" style="width:28px;height:28px;border:3px solid #eee;border-top-color:#0d9488;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px"></div>
        <p style="font-size:.84rem;color:#888">Generazione suggerimenti...</p>
      </div>
      <div class="ai-results" id="aiResults" style="display:none"></div>
    </div>
  </div>`;

  const script = `
  (function() {
    var tbody = document.getElementById('tableBody');
    var rowCountEl = document.getElementById('rowCount');

    function updateRowCount() {
      var rows = tbody.querySelectorAll('tr:not(.empty-row)');
      rowCountEl.textContent = rows.length + ' voci';
      var emptyRow = tbody.querySelector('.empty-row');
      if (rows.length === 0 && !emptyRow) {
        var tr = document.createElement('tr');
        tr.className = 'empty-row';
        tr.innerHTML = '<td colspan="5">Il tuo listino \\u00e8 vuoto. Aggiungi le tue prime voci o clicca \\u201cGenera suggerimenti AI\\u201d per farti aiutare.</td>';
        tbody.appendChild(tr);
      } else if (rows.length > 0 && emptyRow) {
        emptyRow.remove();
      }
    }

    function makeRow(data) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="cell-input" name="description" value="' + escAttr(data.description || '') + '" placeholder="es. Manodopera idraulico"></td>' +
        '<td><input type="number" class="cell-input cell-price" name="unit_price" value="' + (data.unit_price || 0) + '" min="0" step="0.01"></td>' +
        '<td><select class="cell-input" name="unit_measure">' +
          '<option value="cadauno"' + (data.unit_measure === 'cadauno' ? ' selected' : '') + '>cadauno</option>' +
          '<option value="ora"' + (data.unit_measure === 'ora' ? ' selected' : '') + '>ora</option>' +
          '<option value="mq"' + (data.unit_measure === 'mq' ? ' selected' : '') + '>mq</option>' +
          '<option value="ml"' + (data.unit_measure === 'ml' ? ' selected' : '') + '>ml</option>' +
          '<option value="kg"' + (data.unit_measure === 'kg' ? ' selected' : '') + '>kg</option>' +
          '<option value="forfait"' + (data.unit_measure === 'forfait' ? ' selected' : '') + '>forfait</option>' +
        '</select></td>' +
        '<td><select class="cell-input" name="preset">' +
          '<option value="economy"' + (data.preset === 'economy' ? ' selected' : '') + '>Economy</option>' +
          '<option value="standard"' + (data.preset === 'standard' ? ' selected' : '') + '>Standard</option>' +
          '<option value="premium"' + (data.preset === 'premium' ? ' selected' : '') + '>Premium</option>' +
        '</select></td>' +
        '<td class="c"><button type="button" class="row-delete" title="Rimuovi">&times;</button></td>';
      return tr;
    }

    function escAttr(s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    // Aggiungi voce
    document.getElementById('addRowBtn').addEventListener('click', function() {
      var empty = tbody.querySelector('.empty-row');
      if (empty) empty.remove();
      var tr = makeRow({ description: '', unit_price: 0, unit_measure: 'cadauno', preset: 'standard' });
      tbody.appendChild(tr);
      tr.querySelector('input[name=description]').focus();
      updateRowCount();
    });

    // Rimuovi voce
    tbody.addEventListener('click', function(e) {
      if (e.target.classList.contains('row-delete')) {
        e.target.closest('tr').remove();
        updateRowCount();
      }
    });

    // Raccogli dati tabella
    function collectRows() {
      var rows = tbody.querySelectorAll('tr:not(.empty-row)');
      var items = [];
      for (var i = 0; i < rows.length; i++) {
        var desc = rows[i].querySelector('input[name=description]').value.trim();
        var price = parseFloat(rows[i].querySelector('input[name=unit_price]').value) || 0;
        var unit = rows[i].querySelector('select[name=unit_measure]').value;
        var preset = rows[i].querySelector('select[name=preset]').value;
        if (desc) {
          items.push({ description: desc, unit_price: price, unit_measure: unit, preset: preset });
        }
      }
      return items;
    }

    // Salva
    document.getElementById('saveBtn').addEventListener('click', function() {
      var btn = this;
      var items = collectRows();
      btn.disabled = true;
      btn.textContent = 'Salvataggio...';

      fetch('/settings/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceList: items })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Salva listino';
        if (data.success) {
          showToast('Listino salvato (' + items.length + ' voci)');
        } else {
          showError(data.error || 'Errore');
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Salva listino';
        showError('Errore di rete');
      });
    });

    // Esporta JSON
    document.getElementById('exportBtn').addEventListener('click', function() {
      var items = collectRows();
      var blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'listino-prezzi.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Import CSV/JSON
    document.getElementById('importFile').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(ev) {
        var text = ev.target.result.trim();
        var items = [];

        if (file.name.endsWith('.json')) {
          try {
            var parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) { showError('Il JSON deve essere un array'); return; }
            items = parsed.map(function(r) {
              return {
                description: String(r.description || r.descrizione || '').trim(),
                unit_price: parseFloat(r.unit_price || r.prezzo || 0) || 0,
                unit_measure: String(r.unit_measure || r.unita || 'cadauno').trim(),
                preset: String(r.preset || r.fascia || 'standard').trim()
              };
            }).filter(function(r) { return r.description; });
          } catch (err) {
            showError('JSON non valido: ' + err.message);
            return;
          }
        } else {
          // CSV: descrizione;prezzo;unita;preset
          var lines = text.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
          // Skip header if first line contains non-numeric second field
          var start = 0;
          if (lines.length > 1) {
            var firstCols = lines[0].split(/[;,\\t]/);
            if (firstCols.length >= 2 && isNaN(parseFloat(firstCols[1]))) start = 1;
          }
          for (var i = start; i < lines.length; i++) {
            var cols = lines[i].split(/[;,\\t]/);
            if (cols[0] && cols[0].trim()) {
              items.push({
                description: cols[0].trim(),
                unit_price: parseFloat(cols[1]) || 0,
                unit_measure: (cols[2] || 'cadauno').trim(),
                preset: (cols[3] || 'standard').trim()
              });
            }
          }
        }

        if (!items.length) { showError('Nessuna voce valida trovata nel file'); return; }

        // Append to table
        var empty = tbody.querySelector('.empty-row');
        if (empty) empty.remove();
        for (var j = 0; j < items.length; j++) {
          tbody.appendChild(makeRow(items[j]));
        }
        updateRowCount();
        showToast(items.length + ' voci importate');
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    // ── AI Suggest ──
    var aiOverlay = document.getElementById('aiOverlay');
    var aiResults = document.getElementById('aiResults');
    var aiLoading = document.getElementById('aiLoading');
    var aiSuggestions = [];

    document.getElementById('aiSuggestBtn').addEventListener('click', function() {
      aiOverlay.classList.add('show');
      document.getElementById('aiDesc').focus();
    });

    document.getElementById('aiCloseBtn').addEventListener('click', function() {
      aiOverlay.classList.remove('show');
    });

    document.getElementById('aiGenerateBtn').addEventListener('click', function() {
      var desc = document.getElementById('aiDesc').value.trim();
      if (!desc) return;

      var btn = this;
      btn.disabled = true;
      aiLoading.style.display = 'block';
      aiResults.style.display = 'none';

      fetch('/ai/suggest-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: desc })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        aiLoading.style.display = 'none';
        if (data.success) {
          aiSuggestions = data.suggestions;
          renderAiResults(data.suggestions);
        } else {
          showError(data.error || 'Errore AI');
          aiOverlay.classList.remove('show');
        }
      })
      .catch(function() {
        btn.disabled = false;
        aiLoading.style.display = 'none';
        showError('Errore di rete');
        aiOverlay.classList.remove('show');
      });
    });

    function renderAiResults(items) {
      var html = '<table><thead><tr><th>Descrizione</th><th class="r">Prezzo</th><th>Unità</th><th>Fascia</th><th></th></tr></thead><tbody>';
      for (var i = 0; i < items.length; i++) {
        html += '<tr>' +
          '<td style="font-size:.86rem">' + escAttr(items[i].description) + '</td>' +
          '<td class="r" style="font-size:.86rem">' + Number(items[i].unit_price).toFixed(2) + ' &euro;</td>' +
          '<td style="font-size:.86rem">' + escAttr(items[i].unit_measure || 'cadauno') + '</td>' +
          '<td style="font-size:.86rem">' + escAttr(items[i].preset || 'standard') + '</td>' +
          '<td><button type="button" class="ai-add" data-idx="' + i + '">+ Aggiungi</button></td>' +
          '</tr>';
      }
      html += '</tbody></table>';
      html += '<button class="btn btn-primary ai-add-all" id="aiAddAll">Aggiungi tutte al listino</button>';
      aiResults.innerHTML = html;
      aiResults.style.display = 'block';

      // Single item add
      aiResults.querySelectorAll('.ai-add').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(this.dataset.idx);
          addSuggestionToTable(aiSuggestions[idx]);
          this.textContent = 'Aggiunta';
          this.disabled = true;
        });
      });

      // Add all
      document.getElementById('aiAddAll').addEventListener('click', function() {
        for (var j = 0; j < aiSuggestions.length; j++) {
          addSuggestionToTable(aiSuggestions[j]);
        }
        aiOverlay.classList.remove('show');
        showToast(aiSuggestions.length + ' voci aggiunte al listino');
      });
    }

    function addSuggestionToTable(item) {
      var empty = tbody.querySelector('.empty-row');
      if (empty) empty.remove();
      tbody.appendChild(makeRow({
        description: item.description,
        unit_price: item.unit_price,
        unit_measure: item.unit_measure || 'cadauno',
        preset: item.preset || 'standard'
      }));
      updateRowCount();
    }

    function showError(msg) {
      var el = document.getElementById('error');
      el.textContent = msg;
      el.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function() { el.style.display = 'none'; }, 5000);
    }

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }
  })();`;

  res.send(page({ title: "Listino prezzi", user, content, extraCss, script, activePage: "prices" }));
});

// POST /settings/prices
router.post("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const { priceList } = req.body;
  if (!Array.isArray(priceList)) {
    return res.status(400).json({ success: false, error: "Formato non valido" });
  }

  // Validate and sanitize
  const cleaned = priceList
    .filter(item => item.description && String(item.description).trim())
    .map(item => ({
      description: String(item.description).trim(),
      unit_price: Math.max(0, parseFloat(item.unit_price) || 0),
      unit_measure: String(item.unit_measure || "cadauno").trim(),
      preset: ["economy", "standard", "premium"].includes(item.preset) ? item.preset : "standard"
    }));

  const updated = updateUser(user.id, { priceList: cleaned });
  if (!updated) {
    return res.status(500).json({ success: false, error: "Errore durante il salvataggio" });
  }

  res.json({ success: true, count: cleaned.length });
});

// ── POST /ai/suggest-prices ──

const suggestPricesHandler = async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const job_description = (req.body.job_description || "").trim();
  if (!job_description) {
    return res.status(400).json({ success: false, error: "Descrizione del lavoro obbligatoria" });
  }

  if (!claude.isAvailable()) {
    return res.status(503).json({ success: false, error: "Servizio AI non disponibile. Configura CLAUDE_API_KEY." });
  }

  try {
    const response = await claude.generateQuoteWithClaude({
      user_id: user.id,
      professional: { name: user.name, category: user.category, city: user.city },
      job_description,
      pricing_preset: "standard",
      language: "it"
    });

    const suggestions = (response.line_items || []).map(item => ({
      description: item.description,
      unit_price: item.unit_price,
      unit_measure: "cadauno",
      preset: "standard"
    }));

    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("AI suggest-prices error:", err.message);
    res.status(500).json({ success: false, error: "Errore durante la generazione dei suggerimenti" });
  }
};

module.exports = router;
module.exports.suggestPricesHandler = suggestPricesHandler;
