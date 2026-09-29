// Use the host serving the frontend so local-network and Tailscale access work.
const apiUrl = new URL('/api', window.location.origin);
apiUrl.port = '8081';

export const API_BASE_URL = apiUrl.toString();
