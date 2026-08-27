/**
 * Field Quote Wizard — multi-step on-site quoting for Summit Flooring.
 * Steps: client → types → questions → rooms → floor plan → review.
 * Persists wizard_payload on quotes + hybrid catalog/manual rates.
 */
(function () {
  const STEPS = [
    { id: 'client', label: 'Client' },
    { id: 'types', label: 'Types' },
    { id: 'questions', label: 'Details' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'floorplan', label: 'Plan' },
    { id: 'review', label: 'Review' },
  ];
  const LS_KEY = 'summit_field_quote_draft_v1';
  const FALLBACK_RATES = { demolition: 1.5, installation: 4, sanding: 3.5 };

  const SERVICE_COLORS = {
    demolition: '#dc2626',
    installation: '#2563eb',
    sanding: '#ca8a04',
  };

  function osToast(msg, type) {
    if (window.crmToast && typeof window.crmToast.show === 'function') {
      window.crmToast.show(msg, { type: type === 'error' ? 'error' : type === 'info' ? 'info' : 'success' });
    } else {
      alert(msg);
    }
  }

  const state = {
    step: 0,
    catalog: null,
    client: { name: '', email: '', phone: '', address: '' },
    projectTypes: [],
    answers: { demolition: {}, installation: {}, sanding: {} },
    rooms: [],
    floorPlan: [],
    rates: { ...FALLBACK_RATES },
    rateSource: { demolition: 'manual', installation: 'manual', sanding: 'manual' },
    catalogMatched: {},
    customLines: [],
    notes: '',
    quoteId: null,
    customerId: null,
    mapsKey: null,
    autocomplete: null,
    nominatimTimer: null,
    saveTimer: null,
    saving: false,
    lastSavedAt: null,
    drag: null,
  };

  const $ = (id) => document.getElementById(id);

  function uid() {
    return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function money(n) {
    return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(path, opt = {}) {
    const { headers: hdr, ...rest } = opt;
    const headers = { ...hdr };
    if (rest.body != null && !(rest.body instanceof FormData) && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const r = await fetch(path, { credentials: 'include', ...rest, headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.message || r.statusText);
    return j;
  }

  /* —— calc (mirrors modules/quotes/wizardCalculations.js) —— */
  function roomSqft(room) {
    if (!room) return 0;
    const direct = Number(room.sqft);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
    const length = Number(room.length_ft);
    const width = Number(room.width_ft);
    if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
      return Math.round(length * width * 100) / 100;
    }
    return 0;
  }

  function defaultWaste({ serviceType, materialId, pattern }) {
    const wd = state.catalog?.wasteDefaults || {
      install_straight: 10,
      install_diagonal: 15,
      install_herringbone: 20,
      install_chevron: 20,
      tile: 12,
      carpet: 8,
      demolition: 0,
      sanding: 0,
      default: 10,
    };
    const svc = String(serviceType || '').toLowerCase();
    if (svc === 'demolition') return wd.demolition;
    if (svc === 'sanding') return wd.sanding;
    const mat = String(materialId || '').toLowerCase();
    if (mat === 'carpet') return wd.carpet;
    if (mat === 'tile') return wd.tile;
    const pat = String(pattern || 'straight').toLowerCase();
    if (pat === 'diagonal') return wd.install_diagonal;
    if (pat === 'herringbone') return wd.install_herringbone;
    if (pat === 'chevron') return wd.install_chevron;
    return wd.install_straight ?? wd.default;
  }

  function sqftWithWaste(sqft, wastePct) {
    return Math.round(Math.max(0, Number(sqft) || 0) * (1 + Math.max(0, Number(wastePct) || 0) / 100) * 100) / 100;
  }

  function summarizeRooms() {
    const byService = {
      demolition: { sqft: 0, sqft_with_waste: 0 },
      installation: { sqft: 0, sqft_with_waste: 0 },
      sanding: { sqft: 0, sqft_with_waste: 0 },
    };
    let house = 0;
    const rows = [];
    for (const room of state.rooms) {
      const sqft = roomSqft(room);
      house += sqft;
      const svcRows = [];
      for (const svc of room.services || []) {
        const type = svc.type;
        if (!byService[type]) continue;
        const waste =
          svc.waste_factor != null && svc.waste_factor !== ''
            ? Number(svc.waste_factor)
            : defaultWaste({ serviceType: type, materialId: svc.material_id, pattern: svc.pattern });
        const withW = sqftWithWaste(sqft, waste);
        byService[type].sqft += sqft;
        byService[type].sqft_with_waste += withW;
        svcRows.push({ ...svc, waste_factor: waste, sqft, sqft_with_waste: withW });
      }
      rows.push({ ...room, sqft, services: svcRows });
    }
    for (const k of Object.keys(byService)) {
      byService[k].sqft = Math.round(byService[k].sqft * 100) / 100;
      byService[k].sqft_with_waste = Math.round(byService[k].sqft_with_waste * 100) / 100;
    }
    return { house_sqft: Math.round(house * 100) / 100, by_service: byService, rooms: rows };
  }

  function buildItems() {
    const summary = summarizeRooms();
    const labels = { demolition: 'Demolition', installation: 'Installation', sanding: 'Sand & Refinish' };
    const items = [];
    for (const type of ['demolition', 'installation', 'sanding']) {
      if (!state.projectTypes.includes(type)) continue;
      const row = summary.by_service[type];
      if (!row || row.sqft_with_waste <= 0) continue;
      const rate = Number(state.rates[type]) || 0;
      const matched = state.catalogMatched[type];
      items.push({
        name: labels[type],
        service_type: labels[type],
        quantity: row.sqft_with_waste,
        rate,
        unit_type: 'sq_ft',
        type: 'service',
        service_catalog_id: matched?.id || null,
        description: `${row.sqft} sqft + waste → ${row.sqft_with_waste} sqft`,
      });
    }
    for (const c of state.customLines) {
      items.push({
        name: c.name,
        service_type: 'Installation',
        quantity: 1,
        rate: c.amount,
        unit_type: 'fixed',
        type: 'service',
      });
    }
    return items;
  }

  function estimateTotal() {
    return buildItems().reduce((s, it) => s + Math.round((Number(it.quantity) || 0) * (Number(it.rate) || 0) * 100) / 100, 0);
  }

  function materialLabel(id) {
    const m = (state.catalog?.materials || []).find((x) => x.id === id);
    return m ? m.label : id || '—';
  }

  function patternFromAnswers() {
    return state.answers.installation?.wood_pattern || 'straight';
  }

  function installMaterialFromAnswers() {
    return state.answers.installation?.install_material || null;
  }

  function buildWizardPayload() {
    return {
      version: 1,
      step: state.step,
      client: { ...state.client },
      project_types: [...state.projectTypes],
      answers: JSON.parse(JSON.stringify(state.answers)),
      rooms: state.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        name_custom: r.name_custom || null,
        sqft: roomSqft(r),
        length_ft: r.length_ft || null,
        width_ft: r.width_ft || null,
        photo_url: r.photo_url || null,
        photo_local: !!r.photo_local,
        ai_area_estimate: r.ai_area_estimate || null,
        services: (r.services || []).map((s) => ({ ...s })),
      })),
      floor_plan: state.floorPlan.map((f) => ({ ...f })),
      rates: { ...state.rates },
      rate_source: { ...state.rateSource },
      notes: state.notes,
      summary: summarizeRooms(),
    };
  }

  function applyWizardPayload(wp) {
    if (!wp || typeof wp !== 'object') return;
    if (wp.client) state.client = { ...state.client, ...wp.client };
    if (Array.isArray(wp.project_types)) state.projectTypes = wp.project_types;
    if (wp.answers) state.answers = { demolition: {}, installation: {}, sanding: {}, ...wp.answers };
    if (Array.isArray(wp.rooms)) state.rooms = wp.rooms;
    if (Array.isArray(wp.floor_plan)) state.floorPlan = wp.floor_plan;
    if (wp.rates) state.rates = { ...state.rates, ...wp.rates };
    if (wp.rate_source) state.rateSource = { ...state.rateSource, ...wp.rate_source };
    if (wp.notes) state.notes = wp.notes;
    if (typeof wp.step === 'number') state.step = Math.min(Math.max(0, wp.step), STEPS.length - 1);
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          quoteId: state.quoteId,
          customerId: state.customerId,
          payload: buildWizardPayload(),
          savedAt: Date.now(),
        })
      );
      setAutosaveStatus('Saved locally');
    } catch {
      /* ignore quota */
    }
  }

  function loadLocalDraft() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.quoteId) state.quoteId = data.quoteId;
      if (data.customerId) state.customerId = data.customerId;
      applyWizardPayload(data.payload);
      return true;
    } catch {
      return false;
    }
  }

  function setAutosaveStatus(text) {
    const el = $('autosaveStatus');
    if (el) el.textContent = text;
  }

  function scheduleAutosave() {
    saveLocalDraft();
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      persistDraft({ silent: true }).catch(() => {});
    }, 1200);
  }

  async function ensureCustomer() {
    if (state.customerId) return state.customerId;
    const emailRaw = state.client.email.trim();
    const email =
      emailRaw ||
      `onsite.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@quote.summitflooring.local`;
    const res = await api('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: state.client.name.trim() || 'Field quote customer',
        email,
        phone: state.client.phone.trim() || '—',
        address: state.client.address.trim() || null,
        customer_type: 'residential',
      }),
    });
    state.customerId = res.data.id;
    return state.customerId;
  }

  async function persistDraft({ status = 'draft', silent = false } = {}) {
    if (state.saving) return state.quoteId;
    if (!state.client.name.trim() && silent) {
      saveLocalDraft();
      return null;
    }
    state.saving = true;
    if (!silent) setAutosaveStatus('Saving…');
    try {
      const items = buildItems();
      const total = estimateTotal();
      const payload = {
        customer_id: await ensureCustomer(),
        status,
        items: items.length
          ? items
          : [
              {
                name: 'Field quote draft',
                service_type: 'Installation',
                quantity: 1,
                rate: 0,
                unit_type: 'fixed',
                type: 'service',
              },
            ],
        subtotal: total,
        discount_type: 'percentage',
        discount_value: 0,
        tax_total: 0,
        notes: state.notes || 'Field Quote Wizard',
        job_address: state.client.address.trim() || null,
        job_name: state.client.name.trim() || null,
        service_type: state.projectTypes
          .map((t) => ({ demolition: 'Demolition', installation: 'Installation', sanding: 'Sand & Refinish' }[t]))
          .filter(Boolean)
          .join(' · '),
        wizard_payload: buildWizardPayload(),
      };
      if (state.quoteId) {
        await api(`/api/quotes/${state.quoteId}/full`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        const c = await api('/api/quotes/full', { method: 'POST', body: JSON.stringify(payload) });
        state.quoteId = c.data?.quote?.id != null ? Number(c.data.quote.id) : null;
      }
      state.lastSavedAt = Date.now();
      saveLocalDraft();
      setAutosaveStatus(state.quoteId ? `Saved #${state.quoteId}` : 'Saved');
      const link = $('linkOpenBuilder');
      if (link && state.quoteId) {
        link.href = `quote-builder.html?id=${state.quoteId}`;
        link.classList.remove('hidden');
      }
      if (!silent) osToast('Draft saved', 'success');
      return state.quoteId;
    } catch (e) {
      setAutosaveStatus('Offline — local only');
      saveLocalDraft();
      if (!silent) osToast(e.message || String(e), 'error');
      throw e;
    } finally {
      state.saving = false;
    }
  }

  /* —— UI steps —— */
  function renderStepper() {
    const dots = $('stepperDots');
    if (!dots) return;
    dots.innerHTML = '';
    STEPS.forEach((s, i) => {
      const d = document.createElement('span');
      d.className =
        'os-step-dot' + (i === state.step ? ' os-step-dot--on' : i < state.step ? ' os-step-dot--done' : '');
      d.title = s.label;
      dots.appendChild(d);
    });
    const lab = $('stepLabel');
    if (lab) lab.textContent = STEPS[state.step].label;
  }

  function syncPanels() {
    STEPS.forEach((s, i) => {
      const el = $(`panel-${s.id}`);
      if (el) el.classList.toggle('hidden', i !== state.step);
    });
    const final = state.step === STEPS.length - 1;
    $('footerNav').classList.toggle('hidden', final);
    $('footerFinal').classList.toggle('hidden', !final);
    $('btnBack').classList.toggle('hidden', state.step <= 0);
    $('btnNext').textContent = state.step === STEPS.length - 2 ? 'Review →' : 'Continue →';
    renderPricingBar();
  }

  function renderPricingBar() {
    const el = $('pricingTotal');
    if (el) el.textContent = money(estimateTotal());
  }

  function renderProjectTypes() {
    const grid = $('projectTypeGrid');
    if (!grid || !state.catalog) return;
    grid.innerHTML = '';
    state.catalog.projectTypes.forEach((pt) => {
      const on = state.projectTypes.includes(pt.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'os-card-tap rounded-xl border-2 p-4 text-left ' +
        (on ? 'os-card-tap--sel border-[#d6c4a8] bg-slate-50' : 'border-slate-200 bg-white');
      btn.innerHTML = `<div class="flex items-center gap-3">
        <span class="w-3 h-10 rounded-full" style="background:${pt.color}"></span>
        <div><div class="font-bold text-primary">${escapeHtml(pt.label)}</div>
        <div class="text-xs text-slate-500 mt-0.5">Tap to ${on ? 'remove' : 'add'}</div></div>
      </div>`;
      btn.addEventListener('click', () => {
        if (on) state.projectTypes = state.projectTypes.filter((x) => x !== pt.id);
        else state.projectTypes.push(pt.id);
        renderProjectTypes();
        scheduleAutosave();
      });
      grid.appendChild(btn);
    });
  }

  function questionVisible(q, type) {
    const answers = state.answers[type] || {};
    if (q.whenAnswers) {
      for (const [k, v] of Object.entries(q.whenAnswers)) {
        if (answers[k] !== v) return false;
      }
    }
    if (q.when?.materialIds) {
      let mats = [];
      if (type === 'demolition') mats = answers.existing_materials || [];
      if (type === 'installation') mats = answers.install_material ? [answers.install_material] : [];
      if (!mats.some((m) => q.when.materialIds.includes(m))) return false;
    }
    if (q.when?.sandingTypes) {
      const st = answers.sanding_type;
      if (!st || !q.when.sandingTypes.includes(st)) return false;
    }
    return true;
  }

  function renderQuestions() {
    const host = $('questionsHost');
    if (!host || !state.catalog) return;
    host.innerHTML = '';
    if (!state.projectTypes.length) {
      host.innerHTML = '<p class="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-4">Select at least one project type first.</p>';
      return;
    }
    for (const type of state.projectTypes) {
      const pt = state.catalog.projectTypes.find((p) => p.id === type);
      const card = document.createElement('div');
      card.className = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3';
      card.innerHTML = `<h2 class="text-sm font-bold text-primary flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background:${pt?.color || '#999'}"></span>
        ${escapeHtml(pt?.label || type)}
      </h2>`;
      const qs = state.catalog.questions[type] || [];
      const fields = document.createElement('div');
      fields.className = 'space-y-3';
      qs.forEach((q) => {
        if (!questionVisible(q, type)) return;
        fields.appendChild(renderQuestionField(type, q));
      });
      card.appendChild(fields);
      host.appendChild(card);
    }
  }

  function renderQuestionField(type, q) {
    const wrap = document.createElement('div');
    const val = state.answers[type][q.id];
    const label = document.createElement('label');
    label.className = 'block text-xs font-semibold text-slate-600 mb-1';
    label.textContent = q.label;
    wrap.appendChild(label);

    const setVal = (v) => {
      state.answers[type][q.id] = v;
      renderQuestions();
      scheduleAutosave();
    };

    if (q.type === 'boolean') {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-2 gap-2';
      ['Yes', 'No'].forEach((lab, i) => {
        const on = val === (i === 0);
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
          'os-card-tap rounded-xl border-2 py-3 font-semibold text-sm ' +
          (on ? 'os-card-tap--sel border-[#d6c4a8]' : 'border-slate-200');
        b.textContent = lab;
        b.addEventListener('click', () => setVal(i === 0));
        row.appendChild(b);
      });
      wrap.appendChild(row);
    } else if (q.type === 'multi') {
      const box = document.createElement('div');
      box.className = 'flex flex-wrap gap-2';
      const selected = Array.isArray(val) ? val : [];
      (q.options || []).forEach((opt) => {
        const on = selected.includes(opt.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
          'os-card-tap px-3 py-2.5 rounded-xl border-2 text-xs font-semibold ' +
          (on ? 'os-card-tap--sel border-[#d6c4a8] bg-slate-50' : 'border-slate-200');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          const next = on ? selected.filter((x) => x !== opt.id) : [...selected, opt.id];
          setVal(next);
        });
        box.appendChild(b);
      });
      wrap.appendChild(box);
      if (q.allowCustom) {
        const inp = document.createElement('input');
        inp.className = 'os-touch mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
        inp.placeholder = 'Other (free text)';
        inp.value = state.answers[type][`${q.id}_other`] || '';
        inp.addEventListener('change', (e) => {
          state.answers[type][`${q.id}_other`] = e.target.value;
          scheduleAutosave();
        });
        wrap.appendChild(inp);
      }
    } else if (q.type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'os-touch w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white';
      sel.innerHTML =
        '<option value="">Select…</option>' +
        (q.options || []).map((o) => `<option value="${o.id}" ${val === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
      sel.addEventListener('change', (e) => setVal(e.target.value || null));
      wrap.appendChild(sel);
      if (q.allowCustom && val === 'other') {
        const inp = document.createElement('input');
        inp.className = 'os-touch mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
        inp.placeholder = 'Specify other';
        inp.value = state.answers[type][`${q.id}_other`] || '';
        inp.addEventListener('change', (e) => {
          state.answers[type][`${q.id}_other`] = e.target.value;
          scheduleAutosave();
        });
        wrap.appendChild(inp);
      }
    } else if (q.type === 'number') {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.inputMode = 'numeric';
      inp.min = q.min ?? 0;
      if (q.max != null) inp.max = q.max;
      inp.className = 'os-touch w-full rounded-xl border border-slate-200 px-3 py-2.5 tabular-nums';
      inp.value = val != null ? val : '';
      inp.addEventListener('input', (e) => {
        state.answers[type][q.id] = e.target.value === '' ? null : Number(e.target.value);
        scheduleAutosave();
      });
      wrap.appendChild(inp);
    } else if (q.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.className = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
      ta.value = val || '';
      ta.addEventListener('input', (e) => {
        state.answers[type][q.id] = e.target.value;
        scheduleAutosave();
      });
      wrap.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'os-touch w-full rounded-xl border border-slate-200 px-3 py-2.5';
      inp.value = val || '';
      inp.addEventListener('input', (e) => {
        state.answers[type][q.id] = e.target.value;
        scheduleAutosave();
      });
      wrap.appendChild(inp);
    }
    return wrap;
  }

  function defaultRoomServices() {
    return state.projectTypes.map((type) => {
      const material_id =
        type === 'installation'
          ? installMaterialFromAnswers()
          : type === 'demolition'
            ? (state.answers.demolition.existing_materials || [])[0] || null
            : null;
      const pattern = type === 'installation' ? patternFromAnswers() : null;
      return {
        type,
        material_id,
        material_label: materialLabel(material_id),
        pattern,
        waste_factor: defaultWaste({ serviceType: type, materialId: material_id, pattern }),
      };
    });
  }

  function addRoom(partial = {}) {
    state.rooms.push({
      id: uid(),
      name: 'Living Room',
      name_custom: '',
      sqft: 0,
      length_ft: null,
      width_ft: null,
      photo_url: null,
      photo_local: null,
      services: defaultRoomServices(),
      ...partial,
    });
    syncFloorPlanFromRooms();
    renderRooms();
    scheduleAutosave();
  }

  function syncFloorPlanFromRooms() {
    const existing = new Map((state.floorPlan || []).filter(Boolean).map((f) => [f.id, f]));
    const missing = state.rooms.some((r) => !existing.has(r.id));
    if (!state.floorPlan.length || missing) {
      autoLayout(false);
      // Preserve positions for rooms that already existed
      state.floorPlan = state.floorPlan.map((fp) => {
        const prev = existing.get(fp.id);
        if (!prev) return fp;
        return {
          ...fp,
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height,
        };
      });
      return;
    }
    state.floorPlan = state.rooms.map((r) => {
      const prev = existing.get(r.id);
      return {
        ...prev,
        id: r.id,
        name: displayRoomName(r),
        sqft: roomSqft(r),
        services: r.services || [],
        photo_url: r.photo_url || null,
      };
    });
  }

  function displayRoomName(r) {
    if (r.name === 'Other' && r.name_custom) return r.name_custom;
    return r.name || 'Room';
  }

  function autoLayout(save = true) {
    const list = state.rooms;
    if (!list.length) {
      state.floorPlan = [];
      if (save) renderFloorPlan();
      return;
    }
    const canvasW = 800;
    const canvasH = 600;
    const pad = 24;
    const cols = Math.ceil(Math.sqrt(list.length));
    const rows = Math.ceil(list.length / cols);
    const cellW = (canvasW - pad * (cols + 1)) / cols;
    const cellH = (canvasH - pad * (rows + 1)) / rows;
    const maxSq = Math.max(...list.map((r) => roomSqft(r) || 1), 1);
    state.floorPlan = list.map((r, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const scale = Math.sqrt((roomSqft(r) || 1) / maxSq);
      const w = Math.max(90, cellW * (0.55 + 0.45 * scale));
      const h = Math.max(70, cellH * (0.55 + 0.45 * scale));
      return {
        id: r.id,
        name: displayRoomName(r),
        sqft: roomSqft(r),
        x: Math.round(pad + col * (cellW + pad) + (cellW - w) / 2),
        y: Math.round(pad + row * (cellH + pad) + (cellH - h) / 2),
        width: Math.round(w),
        height: Math.round(h),
        services: r.services || [],
        photo_url: r.photo_url || null,
      };
    });
    if (save) {
      renderFloorPlan();
      scheduleAutosave();
    }
  }

  function renderRooms() {
    const list = $('roomList');
    if (!list) return;
    list.innerHTML = '';
    const names = state.catalog?.roomNames || [];
    const materials = state.catalog?.materials || [];

    state.rooms.forEach((room, idx) => {
      const card = document.createElement('div');
      card.className = 'rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/60';
      const nameOpts = names
        .map((n) => `<option value="${escapeHtml(n)}" ${room.name === n ? 'selected' : ''}>${escapeHtml(n)}</option>`)
        .join('');
      const svcChecks = state.projectTypes
        .map((t) => {
          const on = (room.services || []).some((s) => s.type === t);
          const label = { demolition: 'Demo', installation: 'Install', sanding: 'Sand' }[t];
          return `<label class="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg border ${on ? 'border-[#d6c4a8] bg-white' : 'border-slate-200'}">
            <input type="checkbox" data-svc="${t}" ${on ? 'checked' : ''} class="rounded" /> ${label}
          </label>`;
        })
        .join('');

      card.innerHTML = `
        <div class="flex gap-2">
          <select data-k="name" class="os-touch flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white">${nameOpts}</select>
          <button type="button" data-del class="px-3 rounded-lg border border-red-200 text-red-600 text-xs font-bold">✕</button>
        </div>
        ${room.name === 'Other' ? `<input data-k="name_custom" class="os-touch w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" placeholder="Custom room name" value="${escapeHtml(room.name_custom || '')}" />` : ''}
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-[10px] font-bold text-slate-500 uppercase">L (ft)</label>
            <input data-k="length_ft" type="number" inputmode="decimal" min="0" step="0.1" class="os-touch w-full rounded-lg border border-slate-200 px-2 py-2 text-sm tabular-nums" value="${room.length_ft ?? ''}" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-500 uppercase">W (ft)</label>
            <input data-k="width_ft" type="number" inputmode="decimal" min="0" step="0.1" class="os-touch w-full rounded-lg border border-slate-200 px-2 py-2 text-sm tabular-nums" value="${room.width_ft ?? ''}" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-500 uppercase">Sqft</label>
            <input data-k="sqft" type="number" inputmode="numeric" min="0" step="1" class="os-touch w-full rounded-lg border border-slate-200 px-2 py-2 text-sm tabular-nums font-bold" value="${room.sqft || ''}" />
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">${svcChecks}</div>
        <div class="space-y-1" data-svc-details></div>
        ${room.photo_url || room.photo_local ? `<img src="${escapeHtml(room.photo_url || room.photo_local)}" class="w-full h-28 object-cover rounded-lg border border-slate-200" alt="Room photo" />` : ''}
        <label class="block text-center text-xs font-semibold text-slate-600 py-2 rounded-lg border border-dashed border-slate-300 cursor-pointer">
          ${room.photo_url || room.photo_local ? 'Replace photo' : 'Attach photo'}
          <input type="file" accept="image/*" capture="environment" data-photo class="hidden" />
        </label>
      `;

      const details = card.querySelector('[data-svc-details]');
      (room.services || []).forEach((svc) => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 gap-2 text-xs';
        const matOpts = materials
          .map(
            (m) =>
              `<option value="${m.id}" ${svc.material_id === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
          )
          .join('');
        row.innerHTML = `
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-500">${svc.type}</span>
            <select data-svc-mat="${svc.type}" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 bg-white">${matOpts}</select>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-500">Waste %</span>
            <input data-svc-waste="${svc.type}" type="number" min="0" max="50" step="1" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 tabular-nums" value="${svc.waste_factor ?? 0}" />
          </div>`;
        details.appendChild(row);
      });

      card.querySelectorAll('[data-k]').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          const k = e.target.dataset.k;
          let v = e.target.value;
          if (k === 'sqft' || k === 'length_ft' || k === 'width_ft') v = v === '' ? null : Number(v);
          state.rooms[idx][k] = v;
          if (k === 'length_ft' || k === 'width_ft') {
            const L = Number(state.rooms[idx].length_ft);
            const W = Number(state.rooms[idx].width_ft);
            if (L > 0 && W > 0) {
              state.rooms[idx].sqft = Math.round(L * W * 100) / 100;
              const sq = card.querySelector('[data-k="sqft"]');
              if (sq) sq.value = state.rooms[idx].sqft;
            }
          }
          if (k === 'name') renderRooms();
          else {
            updateRoomBadges();
            scheduleAutosave();
          }
        });
        if (inp.tagName === 'SELECT') {
          inp.addEventListener('change', () => {
            state.rooms[idx].name = inp.value;
            renderRooms();
            scheduleAutosave();
          });
        }
      });

      card.querySelectorAll('input[data-svc]').forEach((chk) => {
        chk.addEventListener('change', () => {
          const t = chk.dataset.svc;
          let services = [...(state.rooms[idx].services || [])];
          if (chk.checked) {
            if (!services.some((s) => s.type === t)) {
              const material_id = t === 'installation' ? installMaterialFromAnswers() : null;
              const pattern = t === 'installation' ? patternFromAnswers() : null;
              services.push({
                type: t,
                material_id,
                material_label: materialLabel(material_id),
                pattern,
                waste_factor: defaultWaste({ serviceType: t, materialId: material_id, pattern }),
              });
            }
          } else {
            services = services.filter((s) => s.type !== t);
          }
          state.rooms[idx].services = services;
          renderRooms();
          scheduleAutosave();
        });
      });

      card.querySelectorAll('[data-svc-mat]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const t = sel.dataset.svcMat;
          const svc = state.rooms[idx].services.find((s) => s.type === t);
          if (!svc) return;
          svc.material_id = sel.value;
          svc.material_label = materialLabel(sel.value);
          if (svc.waste_factor == null) {
            svc.waste_factor = defaultWaste({
              serviceType: t,
              materialId: svc.material_id,
              pattern: svc.pattern,
            });
          }
          scheduleAutosave();
          updateRoomBadges();
        });
      });

      card.querySelectorAll('[data-svc-waste]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const t = inp.dataset.svcWaste;
          const svc = state.rooms[idx].services.find((s) => s.type === t);
          if (!svc) return;
          svc.waste_factor = Number(inp.value) || 0;
          scheduleAutosave();
          updateRoomBadges();
          renderPricingBar();
        });
      });

      card.querySelector('[data-del]')?.addEventListener('click', () => {
        state.rooms.splice(idx, 1);
        syncFloorPlanFromRooms();
        renderRooms();
        scheduleAutosave();
      });

      card.querySelector('[data-photo]')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const localUrl = URL.createObjectURL(file);
        state.rooms[idx].photo_local = localUrl;
        renderRooms();
        try {
          await persistDraft({ silent: true });
          if (!state.quoteId) throw new Error('Save draft first to upload photo');
          const fd = new FormData();
          fd.append('file', file);
          const up = await api(`/api/quotes/${state.quoteId}/room-photo`, { method: 'POST', body: fd });
          state.rooms[idx].photo_url = up.data.url;
          state.rooms[idx].photo_local = null;
          osToast('Photo uploaded', 'success');
          scheduleAutosave();
          renderRooms();
        } catch (err) {
          osToast(err.message || String(err), 'error');
        }
      });

      list.appendChild(card);
    });

    updateRoomBadges();
    renderPricingBar();
  }

  function updateRoomBadges() {
    const summary = summarizeRooms();
    const badge = $('houseSqftBadge');
    if (badge) badge.textContent = `${summary.house_sqft} sqft`;
    const box = $('serviceTotals');
    if (!box) return;
    const labels = { demolition: 'Demolition', installation: 'Installation', sanding: 'Sand & Refinish' };
    box.innerHTML = Object.entries(summary.by_service)
      .filter(([, v]) => v.sqft > 0)
      .map(
        ([k, v]) =>
          `<div class="flex justify-between"><span class="font-semibold" style="color:${SERVICE_COLORS[k]}">${labels[k]}</span>
           <span class="tabular-nums">${v.sqft} → <strong>${v.sqft_with_waste}</strong> w/ waste</span></div>`
      )
      .join('') || '<span class="text-slate-500">Add rooms and services to see totals</span>';
  }

  function roomFillColor(services) {
    const types = (services || []).map((s) => s.type);
    if (types.includes('demolition') && types.includes('installation')) return 'rgba(147,51,234,0.18)';
    if (types.includes('demolition')) return 'rgba(220,38,38,0.18)';
    if (types.includes('installation')) return 'rgba(37,99,235,0.18)';
    if (types.includes('sanding')) return 'rgba(202,138,4,0.22)';
    return 'rgba(148,163,184,0.2)';
  }

  function renderFloorLegend() {
    const el = $('floorLegend');
    if (!el) return;
    el.innerHTML = [
      ['demolition', 'Demolition'],
      ['installation', 'Installation'],
      ['sanding', 'Sand & Refinish'],
    ]
      .map(
        ([k, lab]) =>
          `<span class="inline-flex items-center gap-1"><span class="fp-legend-swatch" style="background:${SERVICE_COLORS[k]}"></span>${lab}</span>`
      )
      .join('');
  }

  function renderFloorPlan() {
    const wrap = $('floorCanvasWrap');
    if (!wrap) return;
    if (!state.floorPlan.length && state.rooms.length) autoLayout(false);
    wrap.innerHTML = '';
    const scaleX = wrap.clientWidth / 800;
    const scaleY = wrap.clientHeight / 600;
    const scale = Math.min(scaleX, scaleY) || 1;

    state.floorPlan.forEach((fp) => {
      const el = document.createElement('div');
      el.className = 'fp-room';
      el.style.left = `${fp.x * scale}px`;
      el.style.top = `${fp.y * scale}px`;
      el.style.width = `${fp.width * scale}px`;
      el.style.height = `${fp.height * scale}px`;
      el.style.background = roomFillColor(fp.services);
      const svcLabel = (fp.services || []).map((s) => s.type.slice(0, 4)).join('+') || '—';
      el.innerHTML = `<div class="text-[10px] font-bold text-slate-900 leading-tight truncate">${escapeHtml(fp.name)}</div>
        <div class="text-[10px] tabular-nums text-slate-700">${fp.sqft || 0} sqft</div>
        <div class="text-[9px] text-slate-600 truncate">${escapeHtml(svcLabel)}</div>
        <div class="fp-handle"></div>`;
      wrap.appendChild(el);

      let mode = null;
      let startX = 0;
      let startY = 0;
      let orig = null;

      const onMove = (clientX, clientY) => {
        if (!mode || !orig) return;
        const dx = (clientX - startX) / scale;
        const dy = (clientY - startY) / scale;
        if (mode === 'move') {
          fp.x = Math.max(0, Math.round(orig.x + dx));
          fp.y = Math.max(0, Math.round(orig.y + dy));
        } else {
          fp.width = Math.max(60, Math.round(orig.width + dx));
          fp.height = Math.max(50, Math.round(orig.height + dy));
        }
        el.style.left = `${fp.x * scale}px`;
        el.style.top = `${fp.y * scale}px`;
        el.style.width = `${fp.width * scale}px`;
        el.style.height = `${fp.height * scale}px`;
      };

      const end = () => {
        if (mode) scheduleAutosave();
        mode = null;
        window.removeEventListener('pointermove', ptrMove);
        window.removeEventListener('pointerup', end);
      };

      const ptrMove = (ev) => onMove(ev.clientX, ev.clientY);

      el.addEventListener('pointerdown', (ev) => {
        if (ev.target.classList.contains('fp-handle')) mode = 'resize';
        else mode = 'move';
        startX = ev.clientX;
        startY = ev.clientY;
        orig = { x: fp.x, y: fp.y, width: fp.width, height: fp.height };
        window.addEventListener('pointermove', ptrMove);
        window.addEventListener('pointerup', end);
        ev.preventDefault();
      });
    });
  }

  function exportFloorPlanPng() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 800, 600);
    ctx.strokeStyle = '#e2e8f0';
    for (let i = 0; i < 800; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 600);
      ctx.stroke();
    }
    for (let j = 0; j < 600; j += 24) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(800, j);
      ctx.stroke();
    }
    state.floorPlan.forEach((fp) => {
      ctx.fillStyle = roomFillColor(fp.services).replace('0.18', '0.35').replace('0.22', '0.4').replace('0.2', '0.35');
      ctx.strokeStyle = '#1c1c1f';
      ctx.lineWidth = 2;
      ctx.fillRect(fp.x, fp.y, fp.width, fp.height);
      ctx.strokeRect(fp.x, fp.y, fp.width, fp.height);
      ctx.fillStyle = '#1c1c1f';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(fp.name || 'Room', fp.x + 8, fp.y + 18);
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${fp.sqft || 0} sqft`, fp.x + 8, fp.y + 34);
      const mats = (fp.services || []).map((s) => s.material_label || s.type).join(', ');
      ctx.fillText(mats.slice(0, 28), fp.x + 8, fp.y + 50);
    });
    return canvas;
  }

  function renderReview() {
    const summary = summarizeRooms();
    $('reviewClient').innerHTML = `<div class="font-bold">${escapeHtml(state.client.name)}</div>
      <div class="text-slate-600 text-xs mt-0.5">${escapeHtml(state.client.phone || '')} ${escapeHtml(state.client.email || '')}</div>
      <div class="text-slate-600 text-xs">${escapeHtml(state.client.address || '')}</div>`;

    $('reviewRooms').innerHTML =
      summary.rooms
        .map((r) => {
          const svcs = (r.services || [])
            .map(
              (s) =>
                `<div class="pl-2 border-l-2" style="border-color:${SERVICE_COLORS[s.type]}">
                  <span class="font-semibold capitalize">${s.type}</span> · ${escapeHtml(s.material_label || s.material_id || '—')}
                  · ${s.sqft} sqft · waste ${s.waste_factor}% → <strong>${s.sqft_with_waste}</strong>
                </div>`
            )
            .join('');
          return `<div class="pb-2"><div class="font-bold text-primary">${escapeHtml(displayRoomName(r))} <span class="text-slate-500 font-normal">(${r.sqft} sqft)</span></div>${svcs}</div>`;
        })
        .join('') || '<p class="text-slate-500">No rooms</p>';

    const thumb = $('reviewFloorThumb');
    if (state.floorPlan.length) {
      const c = exportFloorPlanPng();
      thumb.innerHTML = '';
      const img = document.createElement('img');
      img.src = c.toDataURL('image/png');
      img.className = 'w-full h-auto';
      thumb.appendChild(img);
      thumb.classList.remove('hidden');
    } else {
      thumb.classList.add('hidden');
    }

    const rateHost = $('rateFields');
    rateHost.innerHTML = '';
    for (const type of state.projectTypes) {
      const label = { demolition: 'Demolition $/sqft', installation: 'Installation $/sqft', sanding: 'Sanding $/sqft' }[type];
      const src = state.rateSource[type] === 'catalog' ? 'catalog' : 'manual';
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.innerHTML = `
        <label class="flex-1 text-xs font-semibold text-slate-600">${label}
          <span class="font-normal text-slate-400">(${src})</span>
          <input data-rate="${type}" type="number" min="0" step="0.01" class="os-touch mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums" value="${state.rates[type] ?? 0}" />
        </label>`;
      rateHost.appendChild(row);
    }
    rateHost.querySelectorAll('[data-rate]').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.rates[inp.dataset.rate] = Number(inp.value) || 0;
        state.rateSource[inp.dataset.rate] = 'manual';
        renderReviewLines();
        renderPricingBar();
        scheduleAutosave();
      });
    });

    $('quoteNotes').value = state.notes || '';
    if (!$('sendToEmail').value && state.client.email) $('sendToEmail').value = state.client.email;
    renderReviewLines();
  }

  function renderReviewLines() {
    const items = buildItems();
    $('reviewLines').innerHTML = items
      .map(
        (it) =>
          `<div class="flex justify-between gap-2"><span>${escapeHtml(it.name)} <span class="text-slate-400 text-xs">${it.quantity} × ${money(it.rate)}</span></span><span class="font-semibold tabular-nums">${money(it.quantity * it.rate)}</span></div>`
      )
      .join('');
    $('summaryTotal').textContent = money(estimateTotal());
  }

  function validateStep() {
    if (state.step === 0 && !state.client.name.trim()) {
      osToast('Client name is required.', 'error');
      return false;
    }
    if (state.step === 1 && !state.projectTypes.length) {
      osToast('Select at least one project type.', 'error');
      return false;
    }
    if (state.step === 3 && !state.rooms.length) {
      osToast('Add at least one room.', 'error');
      return false;
    }
    if (state.step === 3 && state.rooms.some((r) => roomSqft(r) <= 0)) {
      osToast('Every room needs sqft (or length × width).', 'error');
      return false;
    }
    return true;
  }

  function goStep(n) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, n));
    renderStepper();
    syncPanels();
    if (STEPS[state.step].id === 'types') renderProjectTypes();
    if (STEPS[state.step].id === 'questions') renderQuestions();
    if (STEPS[state.step].id === 'rooms') renderRooms();
    if (STEPS[state.step].id === 'floorplan') {
      renderFloorLegend();
      if (!state.floorPlan.length) autoLayout(false);
      else syncFloorPlanFromRooms();
      renderFloorPlan();
    }
    if (STEPS[state.step].id === 'review') renderReview();
    const main = $('mainScroll');
    if (main) main.scrollTop = 0;
    scheduleAutosave();
  }

  async function uploadFloorPlanIfPossible() {
    if (!state.quoteId || !state.floorPlan.length) return null;
    const canvas = exportFloorPlanPng();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return null;
    const fd = new FormData();
    fd.append('file', blob, 'floorplan.png');
    const up = await api(`/api/quotes/${state.quoteId}/floor-plan`, { method: 'POST', body: fd });
    return up.data.url;
  }

  async function finalize(status, { sendEmail = false, generatePdf = false } = {}) {
    try {
      await persistDraft({ status, silent: true });
      let floorUrl = null;
      try {
        floorUrl = await uploadFloorPlanIfPossible();
      } catch {
        /* optional */
      }
      if (floorUrl) {
        const wp = buildWizardPayload();
        wp.floor_plan_url = floorUrl;
        await api(`/api/quotes/${state.quoteId}/full`, {
          method: 'PUT',
          body: JSON.stringify({
            status,
            items: buildItems(),
            subtotal: estimateTotal(),
            wizard_payload: wp,
            notes: state.notes || 'Field Quote Wizard',
            job_address: state.client.address.trim() || null,
          }),
        });
      }
      if (sendEmail && state.quoteId) {
        try {
          await api(`/api/quotes/${state.quoteId}/publish-client`, { method: 'POST', body: '{}' });
        } catch {
          /* publish optional */
        }
        const to = $('sendToEmail').value.trim() || state.client.email.trim();
        if (to && !to.includes('@quote.summitflooring.local')) {
          await api(`/api/quotes/${state.quoteId}/send-email`, {
            method: 'POST',
            body: JSON.stringify({ to }),
          });
        }
      }
      if (generatePdf && state.quoteId) {
        await api(`/api/quotes/${state.quoteId}/generate-pdf`, { method: 'POST', body: '{}' });
        window.open(`/api/quotes/${state.quoteId}/invoice-pdf`, '_blank');
      }
      const msgs = {
        draft: 'Draft saved',
        sent: 'Quote saved & sent',
        approved: 'Quote approved',
      };
      osToast(msgs[status] || 'Saved', 'success');
      if (state.quoteId) {
        const link = $('linkOpenBuilder');
        if (link) {
          link.href = `quote-builder.html?id=${state.quoteId}`;
          link.classList.remove('hidden');
        }
      }
    } catch (e) {
      osToast(e.message || String(e), 'error');
    }
  }

  async function loadCatalogAndRates() {
    try {
      const cat = await api('/api/quotes/wizard/catalog');
      state.catalog = cat.data;
    } catch (e) {
      $('migrateMsg').textContent = e.message || 'Could not load wizard catalog.';
      $('migrateMsg').classList.remove('hidden');
      state.catalog = {
        projectTypes: [
          { id: 'demolition', label: 'Demolition', color: '#dc2626' },
          { id: 'installation', label: 'Installation', color: '#2563eb' },
          { id: 'sanding', label: 'Sand & Refinish', color: '#ca8a04' },
        ],
        roomNames: ['Living Room', 'Kitchen', 'Bedroom 1', 'Other'],
        materials: [
          { id: 'carpet', label: 'Carpet' },
          { id: 'lvp', label: 'LVP' },
          { id: 'other', label: 'Other' },
        ],
        questions: { demolition: [], installation: [], sanding: [] },
        wasteDefaults: {
          install_straight: 10,
          install_diagonal: 15,
          install_herringbone: 20,
          install_chevron: 20,
          tile: 12,
          carpet: 8,
          demolition: 0,
          sanding: 0,
          default: 10,
        },
      };
    }
    try {
      const rates = await api('/api/quotes/wizard/rates');
      const r = rates.data?.rates || {};
      const matched = rates.data?.matched || {};
      for (const type of ['demolition', 'installation', 'sanding']) {
        if (r[type] != null && Number(r[type]) > 0) {
          state.rates[type] = Number(r[type]);
          state.rateSource[type] = 'catalog';
          state.catalogMatched[type] = matched[type];
        }
      }
    } catch {
      /* keep fallbacks */
    }
  }

  async function loadExistingQuote(id) {
    const j = await api(`/api/quotes/${id}`);
    const q = j.data;
    if (!q) return;
    state.quoteId = Number(q.id);
    state.customerId = q.customer_id || null;
    state.notes = q.notes || '';
    if (q.job_address) state.client.address = q.job_address;
    if (q.job_name && !state.client.name) state.client.name = q.job_name;
    let wp = q.wizard_payload;
    if (typeof wp === 'string' && wp) {
      try {
        wp = JSON.parse(wp);
      } catch {
        wp = null;
      }
    }
    if (wp) applyWizardPayload(wp);
  }

  function bind() {
    ['clientName', 'clientEmail', 'clientPhone', 'clientAddress'].forEach((id) => {
      const map = { clientName: 'name', clientEmail: 'email', clientPhone: 'phone', clientAddress: 'address' };
      $(id)?.addEventListener('input', (e) => {
        state.client[map[id]] = e.target.value;
        scheduleAutosave();
      });
    });

    $('clientAddress')?.addEventListener('input', (e) => {
      if (!state.mapsKey) nominatimSuggest(e.target.value.trim());
    });

    $('btnUseLocation')?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        osToast('Geolocation not available.', 'error');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
              { headers: { Accept: 'application/json' } }
            );
            const j = await r.json();
            state.client.address = j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          } catch {
            state.client.address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          }
          $('clientAddress').value = state.client.address;
          scheduleAutosave();
        },
        () => osToast('Could not read location.', 'error')
      );
    });

    $('btnAddRoom')?.addEventListener('click', () => addRoom());
    $('photoRoomInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const localUrl = URL.createObjectURL(file);
      addRoom({
        name: 'Other',
        name_custom: 'Photo room',
        photo_local: localUrl,
        sqft: 0,
      });
      osToast('Enter sqft for the photo room (required).', 'info');
      const idx = state.rooms.length - 1;
      try {
        await persistDraft({ silent: true });
        if (state.quoteId) {
          const fd = new FormData();
          fd.append('file', file);
          const up = await api(`/api/quotes/${state.quoteId}/room-photo`, { method: 'POST', body: fd });
          state.rooms[idx].photo_url = up.data.url;
          state.rooms[idx].photo_local = null;
          renderRooms();
          scheduleAutosave();
        }
      } catch (err) {
        osToast(err.message || String(err), 'error');
      }
      e.target.value = '';
    });

    $('btnAutoLayout')?.addEventListener('click', () => autoLayout(true));
    $('btnExportFloorPng')?.addEventListener('click', () => {
      const c = exportFloorPlanPng();
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `floorplan-quote-${state.quoteId || 'draft'}.png`;
      a.click();
    });

    $('quoteNotes')?.addEventListener('input', (e) => {
      state.notes = e.target.value;
      scheduleAutosave();
    });

    $('btnNext')?.addEventListener('click', async () => {
      if (!validateStep()) return;
      if (state.step === 0) {
        try {
          await persistDraft({ silent: true });
        } catch {
          /* local ok */
        }
      }
      if (state.step === 3) syncFloorPlanFromRooms();
      goStep(state.step + 1);
    });
    $('btnBack')?.addEventListener('click', () => goStep(state.step - 1));

    $('btnSaveDraft')?.addEventListener('click', () => finalize('draft'));
    $('btnSendQuote')?.addEventListener('click', () => finalize('sent', { sendEmail: true }));
    $('btnApprove')?.addEventListener('click', () => finalize('approved'));
    $('btnPdf')?.addEventListener('click', () => finalize('draft', { generatePdf: true }));

    window.addEventListener('resize', () => {
      if (STEPS[state.step]?.id === 'floorplan') renderFloorPlan();
    });
  }

  function nominatimSuggest(q) {
    if (q.length < 3) {
      $('addressSuggestions')?.classList.add('hidden');
      return;
    }
    clearTimeout(state.nominatimTimer);
    state.nominatimTimer = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
          { headers: { Accept: 'application/json' } }
        );
        const rows = await r.json();
        const box = $('addressSuggestions');
        box.innerHTML = '';
        if (!rows.length) {
          box.classList.add('hidden');
          return;
        }
        rows.forEach((row) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800';
          b.textContent = row.display_name;
          b.addEventListener('click', () => {
            state.client.address = row.display_name;
            $('clientAddress').value = row.display_name;
            box.classList.add('hidden');
            scheduleAutosave();
          });
          box.appendChild(b);
        });
        box.classList.remove('hidden');
      } catch {
        $('addressSuggestions')?.classList.add('hidden');
      }
    }, 350);
  }

  async function loadUiConfig() {
    try {
      const j = await api('/api/config/ui');
      state.mapsKey = j.data?.googleMapsJsKey || null;
      $('placesHint')?.classList.toggle('hidden', !state.mapsKey);
      if (state.mapsKey) {
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.mapsKey)}&libraries=places&callback=__osqPlacesInit`;
        s.async = true;
        window.__osqPlacesInit = () => {
          const input = $('clientAddress');
          if (input && window.google?.maps?.places) {
            state.autocomplete = new google.maps.places.Autocomplete(input, {
              fields: ['formatted_address'],
              types: ['address'],
            });
            state.autocomplete.addListener('place_changed', () => {
              const p = state.autocomplete.getPlace();
              if (p.formatted_address) {
                state.client.address = p.formatted_address;
                input.value = state.client.address;
                scheduleAutosave();
              }
            });
          }
          delete window.__osqPlacesInit;
        };
        document.head.appendChild(s);
      }
    } catch {
      state.mapsKey = null;
    }
  }

  async function init() {
    bind();
    await loadCatalogAndRates();

    const params = new URLSearchParams(location.search);
    const qid = params.get('id');
    if (qid) {
      try {
        await loadExistingQuote(qid);
      } catch (e) {
        osToast(e.message || 'Could not load quote', 'error');
        loadLocalDraft();
      }
    } else {
      loadLocalDraft();
    }

    $('clientName').value = state.client.name;
    $('clientEmail').value = state.client.email;
    $('clientPhone').value = state.client.phone;
    $('clientAddress').value = state.client.address;

    renderStepper();
    syncPanels();
    goStep(state.step);
    loadUiConfig().catch(() => {});

    api('/api/auth/session')
      .then((j) => {
        if (!j.authenticated) {
          $('authBanner').textContent = 'Sign in required — open login.html, then return here.';
          $('authBanner').classList.remove('hidden');
        }
      })
      .catch(() => {
        $('authBanner').textContent = 'Sign in required — open login.html, then return here.';
        $('authBanner').classList.remove('hidden');
      });
  }

  init();
})();
