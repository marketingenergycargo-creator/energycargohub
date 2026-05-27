<?php
/**
 * ============================================================
 *  Energy Cargo – Script de Diagnóstico
 *  Archivo: /api/test.php
 *
 *  ⚠️  IMPORTANTE: ELIMINA ESTE ARCHIVO después de verificar
 *  que todo funciona. No lo dejes en producción.
 *
 *  Accede a: https://energycargo.com.mx/api/test.php
 * ============================================================
 */

// Configuración – debe coincidir con sheets.php
$SPREADSHEET_ID = '1YJHb569ITyiyK3Bv-s1O24SXAYq-VDZqIdoQ4DViVj8';
$SHEET_NAME     = 'BASE';  // ← Cambia si tu pestaña tiene otro nombre
$API_KEY        = 'TU_API_KEY_AQUI'; // ← Tu API Key

header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Energy Cargo – Diagnóstico API</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #F2F2F7; color: #000; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 800; margin-bottom: 24px; }
  .card { background: white; border-radius: 14px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .ok  { color: #34C759; font-weight: 700; }
  .err { color: #FF3B30; font-weight: 700; }
  .warn{ color: #FF9500; font-weight: 700; }
  pre  { background: #1C1C1E; color: #F2F2F7; border-radius: 10px; padding: 16px; overflow: auto; font-size: 12px; margin-top: 12px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .badge-ok   { background: rgba(52,199,89,.15); color: #34C759; }
  .badge-fail { background: rgba(255,59,48,.15); color: #FF3B30; }
</style>
</head>
<body>
<h1>🔍 Energy Cargo · Diagnóstico de Conexión</h1>

<?php

// ── TEST 1: PHP Version ──────────────────────────────────────
echo '<div class="card">';
echo '<strong>PHP Version</strong><br>';
$phpOk = version_compare(PHP_VERSION, '7.4', '>=');
echo PHP_VERSION . ' ';
echo $phpOk
    ? '<span class="badge badge-ok">✓ OK</span>'
    : '<span class="badge badge-fail">✗ Necesitas PHP 7.4+</span>';
echo '</div>';

// ── TEST 2: file_get_contents habilitado ─────────────────────
echo '<div class="card">';
echo '<strong>allow_url_fopen</strong> (necesario para consultar Google)<br>';
$fopen = ini_get('allow_url_fopen');
echo $fopen
    ? '<span class="badge badge-ok">✓ Habilitado</span>'
    : '<span class="badge badge-fail">✗ Deshabilitado – contacta a Hostinger</span>';
echo '</div>';

// ── TEST 3: Carpeta cache ────────────────────────────────────
echo '<div class="card">';
$cacheDir = __DIR__ . '/cache';
echo '<strong>Carpeta /api/cache/</strong><br>';
if (!is_dir($cacheDir)) {
    $created = mkdir($cacheDir, 0755, true);
    echo $created
        ? '<span class="badge badge-ok">✓ Creada automáticamente</span>'
        : '<span class="badge badge-fail">✗ No se pudo crear – créala manualmente con permisos 755</span>';
} else {
    $writable = is_writable($cacheDir);
    echo is_dir($cacheDir) ? '📁 Existe · ' : '';
    echo $writable
        ? '<span class="badge badge-ok">✓ Con permisos de escritura</span>'
        : '<span class="badge badge-fail">✗ Sin permisos de escritura – pon permisos 755</span>';
}
echo '</div>';

// ── TEST 4: Conectar a Google Sheets ────────────────────────
echo '<div class="card">';
echo '<strong>Conexión a Google Sheets API</strong><br>';

$sheetEncoded = urlencode($SHEET_NAME);
$url = "https://sheets.googleapis.com/v4/spreadsheets/{$SPREADSHEET_ID}/values/{$sheetEncoded}?key={$API_KEY}";

$ctx = stream_context_create([
    'http' => ['method' => 'GET', 'timeout' => 10],
]);
$raw = @file_get_contents($url, false, $ctx);

if ($raw === false) {
    echo '<span class="err">✗ No se pudo conectar a Google Sheets.</span><br>';
    echo '<small>Posibles causas: API Key incorrecta, Sheets no es pública, allow_url_fopen desactivado.</small>';
} else {
    $data = json_decode($raw, true);
    if (isset($data['error'])) {
        echo '<span class="err">✗ Error de Google API:</span><br>';
        echo '<pre>' . htmlspecialchars(json_encode($data['error'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
        echo '<br><small><strong>Si ves "API key not valid":</strong> revisa que el API Key en test.php sea correcto.</small>';
        echo '<br><small><strong>Si ves "The caller does not have permission":</strong> la hoja no es pública. Ve a Compartir → Cualquiera con el enlace → Visualizador.</small>';
    } elseif (isset($data['values'])) {
        $rows   = $data['values'];
        $header = $rows[0] ?? [];
        $count  = count($rows) - 1;
        echo '<span class="ok">✓ Conexión exitosa</span><br><br>';
        echo "📊 <strong>Filas encontradas:</strong> {$count} registros<br>";
        echo "📋 <strong>Columnas:</strong> " . implode(', ', $header) . '<br>';
        echo '<pre>' . htmlspecialchars(json_encode(array_slice($rows, 0, 3), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
        echo '<small><em>Mostrando primeras 3 filas (incluyendo encabezados)</em></small>';
    } else {
        echo '<span class="warn">⚠ Respuesta inesperada de Google:</span>';
        echo '<pre>' . htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT)) . '</pre>';
    }
}
echo '</div>';

// ── TEST 5: Endpoint sheets.php ──────────────────────────────
echo '<div class="card">';
echo '<strong>Endpoint sheets.php</strong><br>';
$endpointUrl = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/sheets.php';
echo "URL: <code>{$endpointUrl}</code><br><br>";
$res = @file_get_contents($endpointUrl, false, stream_context_create(['http'=>['timeout'=>10]]));
if ($res) {
    $json = json_decode($res, true);
    if (is_array($json)) {
        echo '<span class="ok">✓ Endpoint responde correctamente – ' . count($json) . ' registros</span>';
    } else {
        echo '<span class="err">✗ El endpoint responde pero no devuelve JSON válido</span>';
        echo '<pre>' . htmlspecialchars(substr($res, 0, 500)) . '</pre>';
    }
} else {
    echo '<span class="warn">⚠ No se pudo autocomprobar (normal en algunos servidores). Abre manualmente: <a href="' . $endpointUrl . '">' . $endpointUrl . '</a></span>';
}
echo '</div>';

?>

<div class="card" style="background:#FFF3CD;border:1px solid #FFCC00">
  <strong>⚠️ RECUERDA:</strong> Elimina <code>/api/test.php</code> después de verificar que todo funciona.
  Este archivo expone información de configuración.
</div>

</body>
</html>
