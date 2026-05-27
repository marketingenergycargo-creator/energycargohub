# Deploy — Energy Cargo Hub

## Arquitectura

```
Firebase Hosting (frontend estático)
    index.html, modulo1–8.html, js/, api/
    └── api/sheets.php  →  Microsoft Graph (OneDrive)

Node.js Backend (Railway / Render / VPS)
    backend/server.js  →  Google Sheets (opensheet)
    Solo usado por: index.html (KPIs)
```

---

## 1. Backend Node.js

### Variables de entorno requeridas

Crea un archivo `backend/.env` (nunca al repo):

```env
PORT=3000
SHEET_ID=1ltNdTZiMlTjp4g6wimRxTt8mppEAN3m1cKfpgdnK2fM
SHEET_TAB=REPORTE
API_KEY=genera_un_token_seguro_aqui   # openssl rand -hex 32
CORS_ORIGIN=https://energycargo.com.mx
CACHE_TTL_MS=300000
```

### Correr localmente

```bash
cd backend
npm install
node server.js
```

### Deploy en Railway/Render

1. Conecta el repo
2. Set root directory: `backend/`
3. Agrega las variables de entorno en el panel
4. URL resultante → úsala en el paso 3

---

## 2. Frontend — js/api.js (API Key)

El frontend necesita saber el `API_KEY` para autenticarse con el backend.

**En desarrollo local** crea `js/config.local.js` (está en .gitignore):

```js
window.__API_KEY__ = 'tu_api_key_local';
```

Agrégala en `index.html` antes del script principal:
```html
<script src="js/config.local.js"></script>
```

**En producción con Firebase Hosting** usa una función o una ruta segura para entregar el key, o configura el proxy en `firebase.json` para redirigir `/api` al backend Node.

---

## 3. PHP (Microsoft Graph — OneDrive)

Configura las variables de entorno en tu servidor PHP (`.htaccess` o panel de hosting):

```
MS_TENANT_ID       = tu_tenant_id
MS_CLIENT_ID       = tu_client_id
MS_CLIENT_SECRET   = tu_client_secret
MS_USER_EMAIL      = pablo.castillo@energycargo.com.mx
MS_FILE_NAME       = REPORTE COTIZACIONES 2026 (7) 1.xlsm
MS_SHEET_NAME      = REPORTE
```

En Apache puedes setearlas en `.htaccess`:
```
SetEnv MS_TENANT_ID     valor
SetEnv MS_CLIENT_ID     valor
SetEnv MS_CLIENT_SECRET valor
SetEnv MS_USER_EMAIL    valor
```

---

## 4. Firebase Hosting (`firebase.json`)

Agrega un rewrite para que `/api` apunte al backend Node:

```json
{
  "hosting": {
    "public": ".",
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "energycargo-api",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

O usa un proxy simple si el backend está en otro dominio:
```json
"rewrites": [{
  "source": "/api/**",
  "destination": "https://tu-backend.railway.app/api/**"
}]
```

---

## 5. Verificar que funciona

```bash
# Health check (sin auth)
curl https://tu-backend.railway.app/health

# KPIs (con auth)
curl -H "X-API-Key: tu_api_key" https://tu-backend.railway.app/api/kpis

# Forzar refresh de caché
curl -X POST -H "X-API-Key: tu_api_key" https://tu-backend.railway.app/api/refresh
```
