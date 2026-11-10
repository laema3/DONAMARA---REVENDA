// Polyfills for TV Box / Android WebViews / Legacy browsers
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
