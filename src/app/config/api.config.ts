// The pilot uses its own same-origin API and database.
const base = new URL(document.querySelector('base')?.href || '/', window.location.origin);
const pilot = base.pathname.startsWith('/tasktracker-prueba/');
const apiUrl = pilot ? new URL('api', base) : new URL('/api', window.location.origin);
if (!pilot) apiUrl.port = '8081';
export const API_BASE_URL = apiUrl.toString();
