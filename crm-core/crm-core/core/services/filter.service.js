export function applyFilters(data, filters) {
  return data.filter(r => {
    if (filters.ejecutivo && r.EJECUTIVO !== filters.ejecutivo) return false;
    if (filters.vendedor && r.VENDEDOR !== filters.vendedor) return false;
    if (filters.servicio && !r.SERVICIO?.includes(filters.servicio)) return false;
    return true;
  });
}