export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      // 1. Check if ?bridge= query param was supplied
      const urlParams = new URLSearchParams(window.location.search);
      const bridgeParam = urlParams.get('bridge');
      if (bridgeParam && bridgeParam.trim()) {
        const clean = bridgeParam.trim().replace(/\/$/, '');
        localStorage.setItem('gridpulse_telemetry_host', clean);
      }

      // 2. Check saved localStorage preference
      const saved = localStorage.getItem('gridpulse_telemetry_host');
      if (saved && saved.trim()) {
        let host = saved.trim().replace(/\/$/, '');
        if (host.startsWith('ws://')) host = `http://${host.slice(5)}`;
        else if (host.startsWith('wss://')) host = `https://${host.slice(6)}`;
        else if (!host.startsWith('http')) host = `http://${host}`;
        
        // Prevent mixed content on HTTPS
        if (window.location.protocol === 'https:' && host.startsWith('http://')) {
          return '';
        }
        return host;
      }

      // 3. If accessing via local IP directly
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
        const port = window.location.port ? `:${window.location.port}` : (import.meta.env.DEV ? ':8000' : '');
        return `${window.location.protocol}//${host}${port}`;
      }

      // On HTTPS cloud deployments (e.g. Wranglr), use relative paths or signaling
      if (window.location.protocol === 'https:') {
        return '';
      }
    } catch {}
  }

  return 'http://localhost:8000';
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = base ? `${base}${cleanPath}` : cleanPath;

  // Block insecure HTTP calls when on HTTPS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    return new Response(JSON.stringify({ status: 'ok', secure_mode: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return fetch(url, options);
}
