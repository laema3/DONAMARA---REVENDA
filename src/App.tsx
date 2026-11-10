/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';

const Admin = lazy(() => import('./pages/Admin'));
const TvDisplay = lazy(() => import('./pages/TvDisplay'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'));
const MotoboyPortal = lazy(() => import('./components/MotoboyPortal').then(m => ({ default: m.MotoboyPortal })));
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { FirebaseProvider } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './store/useStore';
import { SmsNotification } from './components/SmsNotification';

function StoreMeta() {
  const { storeInfo } = useStore();
  
  useEffect(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    const search = typeof window !== 'undefined' ? window.location.search.toLowerCase() : '';

    const isTotem = pathname.startsWith('/totem') || 
      pathname.startsWith('/kiosk') ||
      search.includes('totem') ||
      search.includes('kiosk') ||
      search.includes('autoatendimento');

    const isMotoboy = pathname.startsWith('/motoboy') || search.includes('motoboy');

    const isDeliveryPath = pathname.startsWith('/delivery') || 
      pathname.startsWith('/entrega') ||
      search.includes('delivery') ||
      search.includes('entrega');

    const isTv = pathname.startsWith('/tv') || search.includes('tv');

    if (isTotem) {
      document.documentElement.classList.add('totem-mode');
      document.body.classList.add('totem-mode');
      document.title = `Totem Autoatendimento | ${storeInfo?.name || 'DONAMARA - REVENDA'}`;
    } else if (isMotoboy) {
      document.documentElement.classList.remove('totem-mode');
      document.body.classList.remove('totem-mode');
      document.title = `Portal do Motoboy | ${storeInfo?.name || 'DONAMARA - REVENDA'}`;
    } else if (isDeliveryPath) {
      document.documentElement.classList.remove('totem-mode');
      document.body.classList.remove('totem-mode');
      document.title = `Delivery / Entrega | ${storeInfo?.name || 'DONAMARA - REVENDA'}`;
    } else if (isTv) {
      document.documentElement.classList.remove('totem-mode');
      document.body.classList.remove('totem-mode');
      document.title = `Smart TV & Painel de Vídeos | ${storeInfo?.name || 'DONAMARA - REVENDA'}`;
    } else {
      document.documentElement.classList.remove('totem-mode');
      document.body.classList.remove('totem-mode');
      if (storeInfo?.name) {
        document.title = storeInfo.name;
      }
    }

    // Dynamic PWA manifest link
    let manifestLink = document.getElementById('manifest-link') as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    }
    if (manifestLink) {
      manifestLink.href = isTotem ? '/manifest-totem.json' : isMotoboy ? '/manifest-motoboy.json' : isTv ? '/manifest-tv.json' : '/manifest.json';
    }

    const logo = storeInfo?.logoUrl || '/logo.svg';
    const updateLink = (rel: string) => {
      let link = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = logo;
    };

    updateLink('icon');
    updateLink('shortcut icon');
    updateLink('apple-touch-icon');
    updateLink('apple-touch-icon-precomposed');
  }, [storeInfo?.name, storeInfo?.logoUrl]);
  
  return null;
}

function AutoUpdater() {
  useEffect(() => {
    // Only run auto-updater in standalone production custom domain window, not inside preview iframe or dev
    try {
      if (window.self !== window.top) {
        return;
      }
    } catch {
      return;
    }

    const host = window.location.hostname;
    if (host.includes('ais-dev') || host.includes('ais-pre') || host.includes('localhost') || host.includes('127.0.0.1')) {
      return;
    }

    let initialVersion: number | null = null;

    const purgeAndReload = async () => {
      try {
        // Clear browser cache storage on new app deployment
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            await caches.delete(name);
          }
        }
      } catch (err) {
        console.error('Erro ao limpar caches:', err);
      }
      window.location.replace(window.location.pathname + '?v=' + Date.now());
    };

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (initialVersion === null) {
            initialVersion = data.version;
          } else if (data.version && data.version !== initialVersion) {
            console.log('[AutoUpdate] Nova versão detectada! Limpando caches e recarregando no mobile/desktop...');
            await purgeAndReload();
          }
        }
      } catch (e) {
        // ignore network errors
      }
    };

    checkVersion();
    // Checagem de nova versão: a cada 5 minutos e sempre que a aba voltar a ficar visível
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkVersion();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);
  
  return null;
}

function MotoboyRoute() {
  const { storeInfo } = useStore();
  return <MotoboyPortal storeInfo={storeInfo} onBack={() => { window.location.href = '/'; }} />;
}



export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <StoreMeta />
        <AutoUpdater />
        <SmsNotification />
        <Router>
          <PwaInstallPrompt />
          <CookieConsentBanner />
          <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f7f5] text-stone-800">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-sm font-semibold text-stone-600">Carregando...</span>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Menu />} />
              <Route path="/totem" element={<Menu />} />
              <Route path="/kiosk" element={<Menu />} />
              <Route path="/delivery" element={<Menu />} />
              <Route path="/entrega" element={<Menu />} />
              <Route path="/cardapio" element={<Menu />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/admin" element={<Admin />} />
              {/* <Route path="/motoboy" element={<MotoboyRoute />} /> */}
              <Route path="/tv" element={<TvDisplay />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
              <Route path="/cookies" element={<PrivacyPolicy />} />
              <Route path="/documentacao" element={<DocumentationPage />} />
              <Route path="/docs" element={<DocumentationPage />} />
              <Route path="/manual" element={<DocumentationPage />} />
              <Route path="*" element={<Menu />} />
            </Routes>
          </Suspense>
        </Router>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
