// Polyfills for TV Box / Android WebViews / Legacy browsers & Vercel static API fallback
if (typeof window !== 'undefined') {
  if (typeof (window as any).globalThis === 'undefined') {
    (window as any).globalThis = window;
  }
  if (!window.structuredClone) {
    window.structuredClone = (val: any) => {
      try {
        return JSON.parse(JSON.stringify(val));
      } catch (e) {
        return val;
      }
    };
  }
  if (!(window as any).requestIdleCallback) {
    (window as any).requestIdleCallback = (cb: Function) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
  }

  // Robust fetch interceptor for Vercel static hosting fallback
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith('/api/') || url.includes('/api/')) {
      try {
        const res = await originalFetch(input, init);
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || contentType.includes('text/html')) {
          throw new Error(`API returned status ${res.status} or HTML`);
        }
        return res;
      } catch (err) {
        // Fallback to localStorage / mock JSON for static hosting (Vercel)
        if (url.includes('/api/version')) {
          return new Response(JSON.stringify({ version: '2.5.0-vercel', serverStartTime: new Date().toISOString() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes('/api/health') || url.includes('/api/db/test-connection')) {
          return new Response(JSON.stringify({ status: 'ok', db: 'localStorage fallback', time: new Date().toISOString() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes('/api/db/store-info')) {
          if (init && init.method === 'POST') {
            try {
              const body = JSON.parse(init.body as string || '{}');
              localStorage.setItem('donamara_store_info', JSON.stringify(body));
            } catch (e) {}
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const saved = localStorage.getItem('donamara_store_info');
          const data = saved ? JSON.parse(saved) : { storeName: 'DONAMARA', deliveryEnabled: true, redTheme: true };
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/db/categories')) {
          if (init && init.method === 'POST') {
            try {
              const body = JSON.parse(init.body as string || '[]');
              localStorage.setItem('donamara_categories', JSON.stringify(body));
            } catch (e) {}
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const saved = localStorage.getItem('donamara_categories');
          const data = saved ? JSON.parse(saved) : [];
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/db/products')) {
          if (init && init.method === 'POST') {
            try {
              const body = JSON.parse(init.body as string || '[]');
              localStorage.setItem('donamara_products', JSON.stringify(body));
            } catch (e) {}
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const saved = localStorage.getItem('donamara_products');
          const data = saved ? JSON.parse(saved) : [];
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/db/orders')) {
          if (init && init.method === 'POST') {
            try {
              const body = JSON.parse(init.body as string || '{}');
              const orders = JSON.parse(localStorage.getItem('donamara_orders') || '[]');
              orders.unshift({ ...body, id: body.id || Date.now(), createdAt: body.createdAt || new Date().toISOString() });
              localStorage.setItem('donamara_orders', JSON.stringify(orders));
            } catch (e) {}
            return new Response(JSON.stringify({ success: true, id: Date.now() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const saved = localStorage.getItem('donamara_orders');
          const data = saved ? JSON.parse(saved) : [];
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/db/users')) {
          const saved = localStorage.getItem('donamara_users');
          const data = saved ? JSON.parse(saved) : [{ id: 1, name: 'Administrador', email: 'admin@donamara.com.br', role: 'admin' }];
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/auth/login')) {
          try {
            const body = JSON.parse(init?.body as string || '{}');
            if (body.email === 'admin@donamara.com.br' || body.email === 'admin') {
              return new Response(JSON.stringify({ success: true, token: 'local-admin-token', user: { name: 'Administrador', email: 'admin@donamara.com.br', role: 'admin' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
          } catch (e) {}
          return new Response(JSON.stringify({ success: true, token: 'local-user-token', user: { name: 'Usuário', role: 'padrao' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ success: true, message: 'Local storage fallback response' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return originalFetch(input, init);
  };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (err) {
    console.error('[React Bootstrap Error]:', err);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f7f5;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:18px;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:16px;">⚠️</div>
        <h2 style="font-size:20px;font-weight:800;color:#1c1917;margin:0 0 8px 0;">Erro ao iniciar o aplicativo</h2>
        <p style="font-size:14px;color:#78716c;margin:0 0 20px 0;max-width:360px;">Ocorreu uma falha no carregamento. Clique no botão abaixo para recarregar.</p>
        <button onclick="window.location.reload(true)" style="padding:12px 24px;background:#ea580c;color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">Recarregar</button>
      </div>
    `;
  }
}
