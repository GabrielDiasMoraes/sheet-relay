// A system's repository rule catalog: `catalog.json` (public, SRD) + `catalog.private.json` (optional, only exists
// in private forks; its entries override the public ones). Missing or invalid file = {}.
const getJson = async (url) => { try { const r = await fetch(url); return r.ok ? await r.json() : {}; } catch { return {}; } };
export const loadCatalog = async (url) => ({ ...(await getJson(url)), ...(await getJson(url.replace(/\.json(\?.*)?$/, ".private.json$1"))) });
