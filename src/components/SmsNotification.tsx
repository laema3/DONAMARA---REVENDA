import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { MessageSquare, X, Bell, CheckCircle2, Clock, ChefHat, Bike, AlertTriangle, Snowflake } from 'lucide-react';
import { formatAllDatesBR } from '../lib/utils';

export const SmsNotification: React.FC = () => {
  const { currentNotification, setCurrentNotification } = useStore();
  const playedNotifIdRef = useRef<string | null>(null);

  // Efeito sonoro e vibração ao receber nova notificação no smartphone
  useEffect(() => {
    if (currentNotification && currentNotification.id !== playedNotifIdRef.current) {
      playedNotifIdRef.current = currentNotification.id;

      // Vibração no smartphone (se suportado pelo navegador)
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {}

      // Alerta sonoro agradável e nítido
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [currentNotification]);

  // NÃO há auto-dismiss com setTimeout! A mensagem permanece fixa na tela do smartphone até o cliente fechar.
  if (!currentNotification) return null;

  const isFrozen = currentNotification.title?.includes('❄️') || 
                   currentNotification.badge?.includes('Congelad') || 
                   currentNotification.message?.toLowerCase().includes('congelad');
  const isSuccess = currentNotification.type === 'success';
  const isWarning = currentNotification.type === 'warning';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-stone-200 ring-1 ring-black/10 flex flex-col max-h-[92dvh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 my-auto"
        role="alertdialog"
        aria-modal="true"
      >
        {/* Barra superior de identificação */}
        <div className={`px-5 py-3.5 flex items-center justify-between text-xs font-black tracking-wider uppercase shrink-0 ${
          isFrozen ? 'bg-blue-900 text-white' :
          isSuccess ? 'bg-emerald-600 text-white' :
          isWarning ? 'bg-amber-600 text-white' :
          'bg-stone-900 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <img 
              src="/icon-192.png" 
              alt="DONAMARA" 
              className="w-5 h-5 rounded-full object-contain bg-white/20 p-0.5 border border-white/40 shadow-xs" 
            />
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span>{currentNotification.badge || 'Aviso do Seu Pedido'}</span>
          </div>

          <button
            onClick={() => setCurrentNotification(null)}
            className="p-1 hover:bg-black/20 rounded-full transition-colors cursor-pointer text-white"
            title="Fechar Notificação"
            aria-label="Fechar Notificação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo da mensagem com rolagem interna suave caso a tela do smartphone seja pequena */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
              isFrozen ? 'bg-blue-100 text-blue-700' :
              isSuccess ? 'bg-emerald-100 text-emerald-700' :
              isWarning ? 'bg-amber-100 text-amber-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {isFrozen ? (
                <Snowflake className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 animate-pulse" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
              ) : isWarning ? (
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
              ) : (
                <ChefHat className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                {formatAllDatesBR(currentNotification.title)}
              </h3>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mt-0.5">
                Mensagem Automática da Loja
              </span>
            </div>
          </div>

          {/* Texto completo da mensagem sem cortes */}
          {isFrozen ? (
            <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 text-blue-950 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-blue-900 text-xs uppercase tracking-wide">
                <span>❄️</span>
                <span>Prazo de Produção: Salgados Congelados</span>
              </div>
              <p className="text-sm sm:text-base font-medium leading-relaxed break-words whitespace-normal select-text text-blue-950">
                {formatAllDatesBR(currentNotification.message)}
              </p>
            </div>
          ) : (
            <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-4 text-stone-800">
              <p className="text-sm sm:text-base font-medium leading-relaxed break-words whitespace-normal select-text text-stone-800">
                {formatAllDatesBR(currentNotification.message)}
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
            <span className="flex items-center gap-1.5 font-semibold text-stone-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Alerta em tempo real
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              Toque no botão abaixo para fechar
            </span>
          </div>

          {/* Botão de confirmação/fechamento claro para smartphone */}
          <div className="pt-1">
            <button
              onClick={() => setCurrentNotification(null)}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                isFrozen ? 'bg-blue-900 hover:bg-blue-800 shadow-blue-900/30' :
                isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' :
                isWarning ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' :
                'bg-stone-900 hover:bg-stone-800 shadow-stone-900/30'
              }`}
            >
              <span>OK, Entendido / Fechar Janela 👍</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
