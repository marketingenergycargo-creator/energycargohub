// main.js — punto de entrada (no usado directamente por los módulos HTML,
// pero disponible como ES module de utilidad)
import { getModulo1 } from './js/api.js';

async function fetchCotizaciones() {
  try {
    const data = await getModulo1();
    console.log('DATOS API:', data);
  } catch (error) {
    console.error('Error en main.js:', error);
  }
}

fetchCotizaciones();
