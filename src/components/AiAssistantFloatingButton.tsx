import { useState } from 'react';
import { useStore, Product } from '../store/useStore';
import { Bot, Sparkles, MessageCircle } from 'lucide-react';
import { AiAssistantModal } from './AiAssistantModal';

interface AiAssistantFloatingButtonProps {
  onAddToCart?: (product: Product) => void;
  onAddDirectToCart?: (product: any, quantity: number) => void;
  onOpenCart?: () => void;
  className?: string;
  hasCartItems?: boolean;
}

export function AiAssistantFloatingButton({ onAddToCart, onAddDirectToCart, onOpenCart, className = '', hasCartItems = false }: AiAssistantFloatingButtonProps) {
  const { storeInfo } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  // If AI agent is explicitly disabled by admin, don't show the floating widget
  if (storeInfo.aiAgentEnabled === false) {
    return null;
  }

  // Hide AI Assistant when in Totem / Kiosk autoatendimento mode
  const isTotemMode = typeof window !== 'undefined' && (
    window.location.pathname.toLowerCase().startsWith('/totem') || 
    window.location.pathname.toLowerCase().startsWith('/kiosk') ||
    window.location.search.toLowerCase().includes('totem') ||
    window.location.search.toLowerCase().includes('kiosk') ||
    window.location.search.toLowerCase().includes('autoatendimento')
  );

  if (isTotemMode) {
    return null;
  }

  const agentName = storeInfo.aiAgentName || 'Dona Mara IA';
  const bottomPosition = hasCartItems ? 'bottom-22 sm:bottom-24' : 'bottom-6 sm:bottom-6';

  return (
    <>
      <div className={`fixed ${bottomPosition} right-4 z-40 sm:right-6 transition-all duration-300 ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white pl-3.5 pr-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-amber-400/40 cursor-pointer"
          title={`Falar com ${agentName} - Atendente Virtual`}
        >
          {/* Pulsing indicator */}
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-inner">
              <Bot className="w-5 h-5 text-stone-950" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
            </span>
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs font-black tracking-wide text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> {agentName}
              </span>
            </div>
            <p className="text-[10px] text-stone-300 font-semibold leading-none mt-0.5">
              Atendente I.A.
            </p>
          </div>
        </button>
      </div>

      <AiAssistantModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onAddToCart={onAddToCart}
        onAddDirectToCart={onAddDirectToCart}
        onOpenCart={onOpenCart}
      />
    </>
  );
}
