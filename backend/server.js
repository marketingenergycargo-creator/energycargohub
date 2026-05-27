// ================================================================
// ENERGY CARGO – server.js
// ================================================================
// Mejoras aplicadas:
//  1. Variables de entorno (.env) — sin credenciales hardcodeadas
//  2. Un solo fetch a Google Sheets por ciclo (caché en memoria)
//  3. Sin endpoints duplicados — /api/data sirve a todos los módulos
//  4. Autenticación por API Key (header X-API-Key)
//  5. Validación y sanitización de datos en la capa de transformación
//  6. KPI "pendientes >24h" corregido (cotizaciones NO cerradas con DÍAS > 1)
// ================================================================

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(express.json());


// ================================================================
// CONFIGURACIÓN — desde variables de entorno, nunca hardcodeado
// ================================================================

const CONFIG = {
    port:        process.env.PORT        || 3000,
    corsOrigin:  process.env.CORS_ORIGIN || 'http://localhost:5500',
    apiKey:      process.env.API_KEY,
    sheetId:     process.env.SHEET_ID,
    sheetTab:    process.env.SHEET_TAB   || 'REPORTE',
    cacheTTL:    parseInt(process.env.CACHE_TTL_MS) || 5 * 60 * 1000, // 5 min
};

// Validar variables obligatorias al arrancar
if (!CONFIG.apiKey)  throw new Error('Falta variable de entorno: API_KEY');
if (!CONFIG.sheetId) throw new Error('Falta variable de entorno: SHEET_ID');

const SHEET_URL =
    `https://opensheet.elk.sh/${CONFIG.sheetId}/${CONFIG.sheetTab}`;


// ================================================================
// CORS — solo el origen configurado
// ================================================================

app.use(cors({
    origin: CONFIG.corsOrigin,
    methods: ['GET'],
}));


// ================================================================
// AUTENTICACIÓN — middleware API Key
// ================================================================

function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== CONFIG.apiKey) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

app.use('/api', requireApiKey);


// ================================================================
// CACHÉ EN MEMORIA — un solo fetch por TTL, compartido por todos
// ================================================================

let _cache = null;
let _cacheTs = 0;

async function getData() {
    const now = Date.now();
    if (_cache && (now - _cacheTs) < CONFIG.cacheTTL) {
        return _cache;
    }

    const response = await axios.get(SHEET_URL, { timeout: 15000 });
    const raw = response.data;

    if (!Array.isArray(raw)) {
        throw new Error('La respuesta de Google Sheets no es un array');
    }

    _cache  = raw.map(validateRow).filter(Boolean);
    _cacheTs = now;
    return _cache;
}


// ================================================================
// VALIDACIÓN Y NORMALIZACIÓN DE FILAS
// Devuelve null para filas sin # COT → se filtran automáticamente
// ================================================================

function validateRow(raw) {
    const cot = String(raw['# COT'] || '').trim();
    if (!cot) return null;                         // fila vacía/basura

    const dias = parseFloat(raw['DÍAS'] ?? raw['DIAS'] ?? '');
    const status = String(raw['STATUS'] || '').trim().toUpperCase();

    // PROFIT: puede venir como "1,234.56" o "12.5%"
    let profit = 0;
    const profitRaw = String(raw['PROFIT  (USD)'] || raw['PROFIT (USD)'] || '0');
    const profitNum = parseFloat(profitRaw.replace(/,/g, '').replace('%', ''));
    if (!isNaN(profitNum) && profitNum > 0) profit = profitNum;

    return {
        COT:          cot,
        EJECUTIVO:    String(raw['EJECUTIVO']             || '').trim(),
        EMPRESA:      String(raw['EMPRESA']               || '').trim(),
        VENDEDOR:     String(raw['VENDEDOR']              || '').trim(),
        SERVICIO:     String(raw['SERVICIO']              || '').trim(),
        ORIGEN:       String(raw['ORIGEN']                || '').trim(),
        DESTINO:      String(raw['DESTINO']               || '').trim(),
        INCOTERM:     String(raw['INCOTERM']              || '').trim(),
        IMPO_EXPO:    String(raw['IMPO/EXPO']             || '').trim(),
        RECEPCION:    String(raw['RECEPCIÓN DE SOLICITUD'] || raw['RECEPCION DE SOLICITUD'] || '').trim(),
        ENVIO:        String(raw['ENVÍO']                 || raw['ENVIO'] || '').trim(),
        STATUS:       status,
        DIAS:         isNaN(dias) ? null : dias,
        PROFIT_USD:   profit,
        PROVEEDOR:    String(raw['PROVEED (AGENTE)']      || '').trim(),
        OBSERVACIONES:String(raw['OBSERVACIONES']         || '').trim(),
    };
}


// ================================================================
// ENDPOINT ÚNICO DE DATOS — todos los módulos usan este
// ================================================================

app.get('/api/data', async (req, res) => {
    try {
        const data = await getData();
        res.json(data);
    } catch (err) {
        console.error('[/api/data]', err.message);
        res.status(500).json({ error: 'Error obteniendo datos' });
    }
});


// ================================================================
// KPIs — calculados sobre los datos ya validados y cacheados
// ================================================================

app.get('/api/kpis', async (req, res) => {
    try {
        const data = await getData();

        const total     = data.length;
        const cerradas  = data.filter(r => r.STATUS === 'CERRADA').length;
        const tasaCierre = total > 0
            ? ((cerradas / total) * 100).toFixed(1)
            : '0.0';

        const profitTotal = data.reduce((sum, r) => sum + r.PROFIT_USD, 0);

        // Cotizaciones NO cerradas con más de 1 día sin respuesta
        const sinRespuesta = data.filter(r =>
            r.STATUS !== 'CERRADA' &&
            r.DIAS !== null &&
            r.DIAS > 1
        ).length;

        // Sin status asignado
        const sinFeedback = data.filter(r => !r.STATUS).length;

        res.json({
            totalCotizaciones: total,
            cerradas,
            tasaCierre,
            profitTotal: Math.round(profitTotal),
            sinRespuesta,   // nombre correcto (reemplaza "pendientes24h")
            sinFeedback,
        });

    } catch (err) {
        console.error('[/api/kpis]', err.message);
        res.status(500).json({ error: 'Error calculando KPIs' });
    }
});


// ================================================================
// FILTRO POR EJECUTIVO
// ================================================================

app.get('/api/ejecutivo/:nombre', async (req, res) => {
    try {
        const nombre = String(req.params.nombre).trim().toUpperCase();

        // Validar que solo tenga letras y espacios
        if (!/^[A-ZÁÉÍÓÚÜÑ\s]+$/i.test(nombre)) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }

        const data    = await getData();
        const filtrado = data.filter(r =>
            r.EJECUTIVO.toUpperCase() === nombre
        );

        res.json(filtrado);

    } catch (err) {
        console.error('[/api/ejecutivo]', err.message);
        res.status(500).json({ error: 'Error filtrando por ejecutivo' });
    }
});


// ================================================================
// FORZAR REFRESH DE CACHÉ (útil después de editar el Sheet)
// ================================================================

app.post('/api/refresh', (req, res) => {
    _cache  = null;
    _cacheTs = 0;
    res.json({ ok: true, message: 'Caché limpiado' });
});


// ================================================================
// HEALTH CHECK — sin autenticación, para monitoreo
// ================================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        cacheAge: _cacheTs
            ? Math.round((Date.now() - _cacheTs) / 1000) + 's'
            : 'vacío',
        cachedRows: _cache?.length ?? 0,
    });
});


// ================================================================
// ARRANQUE
// ================================================================

app.listen(CONFIG.port, () => {
    console.log(`✅ API corriendo en puerto ${CONFIG.port}`);
    console.log(`   CORS habilitado para: ${CONFIG.corsOrigin}`);
    console.log(`   Caché TTL: ${CONFIG.cacheTTL / 1000}s`);
});
