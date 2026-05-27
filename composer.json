export function calculateKPIs(data) {
  const total = data.length;

  const cerradas = data.filter(r =>
    String(r.STATUS || '').toUpperCase() === 'CERRADA'
  ).length;

  const abiertas = data.filter(r =>
    String(r.STATUS || '').toUpperCase().includes('ABIERTA')
  ).length;

  const tasa = total ? (cerradas / total) * 100 : 0;

  return { total, cerradas, abiertas, tasa };
}