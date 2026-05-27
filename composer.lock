import { fetchCotizaciones } from "../api/client.js";
import { store } from "./state/store.js";
import { calculateKPIs } from "./services/kpi.service.js";

export async function initCRM() {
  const data = await fetchCotizaciones();

  store.set("data", data);
  store.set("filtered", data);

  const kpis = calculateKPIs(data);

  store.set("kpis", kpis);

  window.__CRM_DATA__ = data;
  window.__CRM_KPIS__ = kpis;

  return { data, kpis };
}