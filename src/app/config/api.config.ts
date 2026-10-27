// Use the host serving the frontend so local-network and Tailscale access work.
const base = new URL(document.querySelector('base')?.href || '/', window.location.origin);
const apiUrl = base.pathname === '/tasktracker/'
  ? new URL('/tasktracker-api',window.location.origin)
  : new URL('api',base);

export const API_BASE_URL = apiUrl.toString();
