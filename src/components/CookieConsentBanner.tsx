import { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('donamara_cookie_consent');
      if (!consent) {
        // Exibir após 1.5s
        const timer = setTimeout(() => setShowBanner(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('donamara_cookie_consent', 'accepted');
    } catch {}
    setShowBanner(false);
  };

  const handleReject = () => {
    try {
      localStorage.setItem('donamara_cookie_consent', 'necessary_only');
    } catch {}
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9980] p-3 sm:p-4 animate-slideUp print:hidden">
      <div className="max-w-4xl mx-auto bg-stone-950/95 backdrop-blur-md text-stone-100 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-start gap-3 flex-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
              <span>Sua Privacidade & Uso de Cookies</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </p>
            <p>
              Utilizamos cookies e armazenamento local para salvar seu carrinho, agilizar seus pedidos e lembrar seus dados de entrega em conformidade com a <strong>LGPD</strong>.
            </p>
            <div className="mt-1 flex items-center gap-3">
              <Link 
                to="/privacidade" 
                className="text-amber-400 hover:text-amber-300 underline font-semibold text-xs inline-flex items-center gap-1"
              >
                Política de Privacidade Completa
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={handleReject}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer"
          >
            Apenas Essenciais
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black text-stone-950 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            Aceitar e Continuar
          </button>
        </div>

      </div>
    </div>
  );
}
