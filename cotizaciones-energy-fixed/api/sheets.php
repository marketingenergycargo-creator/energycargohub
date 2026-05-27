<?php
/**
 * ============================================================
 *  Energy Cargo & Solutions – Google Sheets API Proxy
 *  Archivo: /api/sheets.php
 *  Servidor: Hostinger (energycargo.com.mx)
 * ============================================================
 *
 *  INSTRUCCIONES DE CONFIGURACIÓN:
 *  1. Sube este archivo a: public_html/api/sheets.php
 *  2. Edita ÚNICAMENTE las constantes de la sección CONFIG
 *  3. Asegúrate que la carpeta /api/cache/ tenga permisos 755
 * ============================================================
 */

// ── CONFIG ──────────────────────────────────────────────────
define('SPREADSHEET_ID', '1SOLEi0AVH6WDanH4O5_UzxcimJTS0lvZiIPblH2VzJs');
define('SHEET_NAME',     'REPORTE');          // Nombre exacto de la hoja/pestaña en tu Google Sheets
define('API_KEY',        'AIzaSyClns0XA3BaQegYP9JQzoCy1n33tQmmDDQ'); // ← Reemplaza con tu Google Sheets API Key

define('CACHE_FILE',     __DIR__ . '/cache/sheets_cache.json');
define('CACHE_TTL',      300);             // segundos (5 minutos). Cambia a 60 para 1 min, 0 para sin caché.

define('ALLOWED_ORIGIN', 'https://energycargo.com.mx');
// ────────────────────────────────────────────────────────────


// ── CORS ─────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === ALLOWED_ORIGIN || $origin === 'http://energycargo.com.mx') {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // Permite también localhost para desarrollo local
    if (in_array($origin, ['http://localhost', 'http://127.0.0.1', ''])) {
        header('Access-Control-Allow-Origin: *');
    }
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── SÓLO GET ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── FORZAR REFRESCO (param ?refresh=1) ───────────────────────
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';

// ── CACHÉ ────────────────────────────────────────────────────
if (!$forceRefresh && file_exists(CACHE_FILE)) {
    $age = time() - filemtime(CACHE_FILE);
    if ($age < CACHE_TTL) {
        header('X-Cache: HIT');
        header('X-Cache-Age: ' . $age . 's');
        echo file_get_contents(CACHE_FILE);
        exit;
    }
}

// ── FETCH GOOGLE SHEETS ──────────────────────────────────────
$sheetEncoded = urlencode(SHEET_NAME);
$url = sprintf(
    'https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s?key=%s',
    SPREADSHEET_ID,
    $sheetEncoded,
    API_KEY
);

$ctx = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 15,
        'header'  => 'Accept: application/json'
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ]
]);

$raw = @file_get_contents($url, false, $ctx);

if ($raw === false) {
    $errMsg = 'No se pudo conectar a Google Sheets.';
    // Capture PHP error details
    $lastError = error_get_last();
    if ($lastError) $errMsg .= ' PHP error: ' . $lastError['message'];
    // Si falla y hay caché viejo, úsalo
    if (file_exists(CACHE_FILE)) {
        header('X-Cache: STALE');
        header('X-Error: ' . addslashes($errMsg));
        echo file_get_contents(CACHE_FILE);
    } else {
        http_response_code(502);
        echo json_encode(['error' => $errMsg, 'url_attempted' => $url]);
    }
    exit;
}

$googleData = json_decode($raw, true);

if (!isset($googleData['values']) || !is_array($googleData['values'])) {
    http_response_code(502);
    $errDetail = isset($googleData['error']) ? $googleData['error']['message'] ?? json_encode($googleData['error']) : 'Sin campo values';
    echo json_encode([
        'error'      => 'Google Sheets error: ' . $errDetail,
        'hint'       => 'Verifica: 1) API key válida, 2) Sheet ID correcto, 3) Nombre de pestaña exacto ("' . SHEET_NAME . '"), 4) Hoja pública o compartida',
        'google_raw' => $googleData
    ]);
    exit;
}

// ── TRANSFORMAR: filas → objetos JSON ────────────────────────
$rows   = $googleData['values'];
$header = array_shift($rows);   // Primera fila = encabezados

// Normalizar encabezados (quitar espacios, mayúsculas)
$header = array_map(function($h) {
    $h = trim($h);

    $replace = [
        '# COT' => 'COT',
        'DÍAS' => 'DIAS',
        '% PROFIT' => 'PROFIT',
        'CTE/PSP/AGTE' => 'CTE_PSP_AGTE',
        'USER CTE' => 'USER_CTE',
        'PO/REF' => 'PO_REF',
        'IMPO/EXPO' => 'IMPO_EXPO',
        'RECEPCIÓN DE SOLICITUD' => 'RECEPCION',
        '¿NUEVO PROV?' => 'NUEVO_PROV',
        'PROFIT  (USD)' => 'PROFIT_USD',
        '# AJUSTES' => 'AJUSTES',
        '# ENY' => 'ENY',
        'MOTIVO DE PÉRDIDA' => 'MOTIVO',
        'MOTIVO_PERDIDA' => 'MOTIVO',
        'MOTIVO DE PERDIDA' => 'MOTIVO'
    ];

    return $replace[$h] ?? $h;
}, $header);

$result = [];

foreach ($rows as $row) {

    while (count($row) < count($header)) {
        $row[] = '';
    }

    $obj = array_combine($header, $row);
    
    // ── LIMPIEZA Y TIPADO DE CAMPOS CLAVE ──────────────────
    // DIAS → número
    if (isset($obj['DIAS'])) {
        $obj['DIAS'] = is_numeric($obj['DIAS']) ? floatval($obj['DIAS']) : null;
    }

    // PROFIT_PCT → número decimal (acepta "0.15", "15%", "15")
    if (isset($obj['PROFIT_PCT'])) {
        $v = trim(str_replace(['%', ' '], '', $obj['PROFIT_PCT']));
        if (is_numeric($v)) {
            $n = floatval($v);
            // Si viene como porcentaje entero (ej. 15 en vez de 0.15)
            $obj['PROFIT_PCT'] = ($n > 1) ? $n / 100 : $n;
        } else {
            $obj['PROFIT_PCT'] = null;
        }
    }

    // RECEPCION / ENVIO → formato YYYY-MM-DD
    foreach (['RECEPCION', 'ENVIO'] as $dateField) {
        if (!empty($obj[$dateField])) {
            $obj[$dateField] = normalizeDate($obj[$dateField]);
        }
    }

    // CERRADA → normalizar a CERRADA / ABIERTA / SIN FEEDBACK
    if (isset($obj['CERRADA'])) {
        $obj['CERRADA'] = normalizarEstatus($obj['CERRADA']);
    }

    // Quitar fila completamente vacía
    $nonEmpty = array_filter($obj, function($v) { return $v !== '' && $v !== null; });
    if (empty($nonEmpty)) continue;

    $result[] = $obj;
}

$json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ── GUARDAR CACHÉ ────────────────────────────────────────────
$cacheDir = dirname(CACHE_FILE);
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}
file_put_contents(CACHE_FILE, $json, LOCK_EX);

header('X-Cache: MISS');
header('X-Total-Records: ' . count($result));
echo $json;


// ── HELPERS ──────────────────────────────────────────────────

/**
 * Normaliza fechas de varios formatos a YYYY-MM-DD
 * Acepta: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, serial Excel, etc.
 */
function normalizeDate(string $raw): string {
    $raw = trim($raw);
    if (empty($raw) || $raw === 'None' || $raw === 'null') return '';

    // Ya en formato YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $raw)) {
        return substr($raw, 0, 10);
    }

    // DD/MM/YYYY o DD-MM-YYYY
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $raw, $m)) {
        return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
    }

    // Serial numérico de Excel (días desde 1900-01-01)
    if (is_numeric($raw)) {
        $serial = intval($raw);
        if ($serial > 40000 && $serial < 60000) {
            $ts = ($serial - 25569) * 86400;
            return date('Y-m-d', $ts);
        }
    }

    // Intentar con strtotime
    $ts = strtotime($raw);
    if ($ts !== false) {
        return date('Y-m-d', $ts);
    }

    return $raw;
}

/**
 * Normaliza el estatus de cotización
 */
function normalizarEstatus(string $s): string {
    $u = strtoupper(trim($s));
    if (str_contains($u, 'CERR'))        return 'CERRADA';
    if (str_contains($u, 'SIN')  || str_contains($u, 'FEED') || str_contains($u, 'FB'))
                                          return 'SIN FEEDBACK';
    if (str_contains($u, 'ABIERT') || str_contains($u, 'NO') || str_contains($u, 'PERD'))
                                          return 'ABIERTA';
    return $u ?: 'ABIERTA';
}
