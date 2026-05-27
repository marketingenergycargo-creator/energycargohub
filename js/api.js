// ================================================================
// ENERGY CARGO – js/api.js  (frontend)
// ================================================================

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// Cambia PROD_API_URL por la URL que te dé Render después del deploy
const PROD_API_URL = 'https://energycargo-api.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:3000/api';

// Tu API Key de producción (la misma que pusiste en Render → Environment Variables)
// Para local, crea js/config.local.js con: window.__API_KEY__ = 'tu_key_local';
const PROD_API_KEY  = 'REEMPLAZA_CON_TU_API_KEY';

const _isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';

const API_CONFIG = {
    base: _isLocal ? LOCAL_API_URL : PROD_API_URL,
    key:  _isLocal
        ? ((typeof window !== 'undefined' && window.__API_KEY__) || '')
        : PROD_API_KEY,
};


// ── Fetch base ────────────────────────────────────────────────

async function fetchAPI(endpoint) {
    const headers = { 'Content-Type': 'application/json' };
    if (API_CONFIG.key) headers['X-API-Key'] = API_CONFIG.key;

    const res = await fetch(`${API_CONFIG.base}${endpoint}`, { headers });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} en ${endpoint}: ${body}`);
    }

    return res.json();
}


// ── Endpoints ─────────────────────────────────────────────────

export const getKPIs      = () => fetchAPI('/kpis');
export const getData      = () => fetchAPI('/data');
export const getEjecutivo = (nombre) => fetchAPI(`/ejecutivo/${encodeURIComponent(nombre)}`);

// Aliases para compatibilidad con módulos existentes
export const getModulo1 = getData;
export const getModulo2 = getData;
