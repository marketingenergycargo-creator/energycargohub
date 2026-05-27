/**
 * ============================================================
 *  Energy Cargo & Solutions – API Client
 *  Archivo: /assets/js/api.js
 *  Compartido por: index.html, modulo1–8.html
 * ============================================================
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────
const API_CONFIG = {
  url: 'api/sheets.php',
  autoRefreshMs: 300_000,
};

// ── ESTADO GLOBAL ─────────────────────────────────────────────
let _cachedData = null;
let _refreshTimer = null;

// ── FETCH PRINCIPAL ───────────────────────────────────────────
async function fetchData() {
  console.log('[API] Fetching:', API_CONFIG.url);
  const res = await fetch(API_CONFIG.url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  console.log('[API] HTTP status:', res.status, res.statusText);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[API] Error body:', body);
    throw new Error(`Error HTTP ${res.status}: ${body.slice(0,200)}`);
  }
  const data = await res.json();
  console.log('[API] Response type:', typeof data, Array.isArray(data) ? `Array[${data.length}]` : JSON.stringify(data).slice(0,100));
  if (!Array.isArray(data)) throw new Error('La API no devolvió un arreglo válido: ' + JSON.stringify(data).slice(0,200));
  _cachedData = data;
  return data;
}

// ── FUNCIÓN PRINCIPAL DE CARGA ────────────────────────────────
async function cargarDatos() {
  showLoading(true);

  try {
    const data = await fetchData();

    // Poblar array global D del módulo
    if (typeof D !== 'undefined') {
      D.length = 0;
      data.forEach(r => D.push(r));
    }

    // Poblar array filtered del módulo
    if (typeof filtered !== 'undefined') {
      filtered.length = 0;
      data.forEach(r => filtered.push(r));
    }

    // ── Poblar TODOS los <select> dinámicamente ───────────────
    populateAllSelects(data);

    // Semanas
    if (typeof buildWeekDropdown === 'function') buildWeekDropdown();
    if (typeof buildWeekDD      === 'function') buildWeekDD();

    // Render principal del módulo
    if (typeof renderAll === 'function') renderAll();

    // Contadores
    _updateCounters(data.length);

    showLoading(false);
    updateLiveBadge(true);

    // Auto-refresh
    if (API_CONFIG.autoRefreshMs > 0) {
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(() => cargarDatos(), API_CONFIG.autoRefreshMs);
    }

  } catch (err) {
    console.error('[API] Error al cargar datos:', err);
    showLoading(false);
    updateLiveBadge(false);
    showError(err.message);
  }
}

// ── POBLAR TODOS LOS SELECTS ──────────────────────────────────
function populateAllSelects(data) {
  // --- Ejecutivos ---
  const ejecutivos = _unique(data, 'EJECUTIVO', _normEj);
  _fillSelect('fEjecutivo', ejecutivos);
  _fillSelect('fEj',        ejecutivos);
  _fillSelect('alertEj',    ejecutivos, 'Todos los Ejecutivos');

  // --- Vendedores ---
  const vendedores = _unique(data, 'VENDEDOR');
  _fillSelect('fVendedor', vendedores);
  _fillSelect('fVend',     vendedores);
  _fillSelect('alertVend', vendedores, 'Todos los Vendedores');

  // --- Servicios ---
  const servicios = _unique(data, 'SERVICIO', _normServ);
  _fillSelect('fServicio', servicios);
  _fillSelect('fServ',     servicios);
  _fillSelect('fSrv',      servicios);

  // --- Incoterms ---
  const incoterms = _unique(data, 'INCOTERM');
  _fillSelect('fIncoterm', incoterms);
  _fillSelect('fInco',     incoterms);

  // --- Tipo (IMPO/EXPO) ---
  const tipos = _unique(data, 'IMPO_EXPO');
  _fillSelect('fTipo', tipos, 'Todos');

  // --- Meses ---
  const meses = [...new Set(
    data.map(r => (r.RECEPCION || '').substring(0, 7)).filter(v => v && v.length === 7)
  )].sort();
  _fillSelectTransform('fMes',    meses, _monthLabel);
  _fillSelectTransform('fMes',    meses, _monthLabel);

  // --- Motivos de pérdida (Módulo 6) ---
  const motivos = _unique(data, 'MOTIVO');
  if (motivos.length) _fillSelect('alertMotivo', motivos, 'Todos los Motivos');

  // --- Tipo de cuenta / CTE_PSP_AGTE ---
  const cteTypes = _unique(data, 'CTE_PSP_AGTE');
  _fillSelect('fCteType', cteTypes);

  // --- Tabs dinámicos de ejecutivos (Módulo 8) ---
  _buildEjTabs(ejecutivos);
}

// ── HELPERS DE SELECT ─────────────────────────────────────────
function _unique(data, field, normFn) {
  const set = new Set(
    data.map(r => normFn ? normFn(r[field] || '') : (r[field] || '').trim().toUpperCase())
       .filter(Boolean)
  );
  return [...set].sort();
}

function _fillSelect(id, values, allLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  // Preserve first option (Todos/Todas/empty)
  const first = sel.querySelector('option[value=""]') ||
                sel.options[0];
  sel.innerHTML = '';
  if (first) {
    if (allLabel) first.textContent = allLabel;
    sel.appendChild(first);
  }
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function _fillSelectTransform(id, values, transformFn) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  const first = sel.querySelector('option[value=""]') || sel.options[0];
  sel.innerHTML = '';
  if (first) sel.appendChild(first);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = transformFn(v);
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function _monthLabel(ym) {
  if (!ym || ym.length < 7) return ym;
  const [year, month] = ym.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function _normEj(e) {
  if (!e) return '';
  e = e.trim().toUpperCase();
  if (['ESTEFANIA', 'ESTEFANÍA'].includes(e)) return 'ESTEFANÍA';
  return e;
}

function _normServ(s) {
  if (!s) return '';
  return s.trim().toUpperCase();
}

// ── TABS DINÁMICOS DE EJECUTIVOS (Módulo 8) ───────────────────
const _EJ_COLORS = ['#AF52DE','#007AFF','#34C759','#FF9500','#FF3B30','#5AC8FA'];

function _buildEjTabs(ejecutivos) {
  // Módulo 8: service-by-ejecutivo tabs container
  const container = document.querySelector('.svc-ej-tabs, #svcEjTabs');
  if (!container) return;
  container.innerHTML = '';
  ejecutivos.forEach((ej, i) => {
    const color = _EJ_COLORS[i % _EJ_COLORS.length];
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.style.color = color;
    btn.textContent = ej.charAt(0) + ej.slice(1).toLowerCase();
    btn.onclick = function() {
      if (typeof setSvcEj === 'function') setSvcEj(ej, this);
    };
    container.appendChild(btn);
  });
}

// ── CONTADORES ────────────────────────────────────────────────
function _updateCounters(total) {
  const ts = total.toLocaleString('es-MX');
  const time = new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});

  ['filterCount','fcount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${ts} cotizaciones`;
  });
  const lu = document.getElementById('lastUpdate');
  if (lu) lu.textContent = `${ts} registros · Actualizado ${time}`;
}

// ── LOADING / ERROR UI ────────────────────────────────────────
function showLoading(on) {
  const el = document.getElementById('loadingState');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function showError(msg) {
  const el = document.getElementById('errorState');
  if (el) {
    el.style.display = 'flex';
    const m = el.querySelector('.error-msg');
    if (m) m.textContent = msg;
  }
}

// ── LIVE BADGE ────────────────────────────────────────────────
function updateLiveBadge(ok) {
  const el = document.querySelector('.badge-live');
  if (!el) return;
  if (ok) {
    el.style.color      = '#34C759';
    el.style.background = 'rgba(52,199,89,0.12)';
    el.textContent      = '⬤ EN VIVO';
  } else {
    el.style.color      = '#FF9500';
    el.style.background = 'rgba(255,149,0,0.12)';
    el.textContent      = '⬤ SIN CONEXIÓN';
  }
}

// ── FORCE REFRESH ─────────────────────────────────────────────
async function forceRefresh() {
  const res = await fetch(API_CONFIG.url + '?refresh=1', {
    headers: { 'Accept': 'application/json' },
  });
  const data = await res.json();
  _cachedData = data;
  return data;
}
