export async function fetchCotizaciones() {
  const res = await fetch("YOUR_API_ENDPOINT_HERE");
  return await res.json();
}