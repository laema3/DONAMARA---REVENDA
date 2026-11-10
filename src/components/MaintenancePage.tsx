import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Wrench, Clock, MapPin, Phone, Instagram, RefreshCw, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MaintenancePage: React.FC = () => {
  const { storeInfo, fetchData } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cleanWhatsappNumber = (phoneStr?: string) => {
    if (!phoneStr) return '';
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.length <= 9) return `5511${digits}`;
    if (digits.length <= 11 && !digits.startsWith('55')) return `55${digits}`;
    return digits;
  };

  const whatsappNumber = cleanWhatsappNumber(storeInfo.whatsapp || '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Vi que o cardápio online está em manutenção. Gostaria de informações ou fazer um pedido.')}`;

  const instagramHandle = (storeInfo.instagram || '').replace('@', '').trim();
  const instagramUrl = `https://instagram.com/${instagramHandle}`;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 selection:bg-amber-500 selection:text-stone-950">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 aspect-square rounded-full bg-amber-500/20 border border-amber-500/40 overflow-hidden flex items-center justify-center shadow-inner">
            <img 
              src={storeInfo.logoUrl || '/logo.svg'} 
              alt={storeInfo.name || 'DONAMARA - REVENDA'} 
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">{storeInfo.name || 'DONAMARA - REVENDA'}</h1>
            <p className="text-[11px] text-amber-400 font-semibold">{storeInfo.headerPhrase || 'Salgados Especiais e Revenda'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Em Manutenção
          </span>
        </div>
      </header>

      {/* Main Center Box */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-stone-800/80 backdrop-blur-md border border-stone-700/80 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Icon Badge */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center shadow-xl">
            <Wrench className="w-10 h-10 text-amber-400 animate-bounce duration-1000" />
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xs shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Estamos em Manutenção
            </h2>
            <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              {storeInfo.maintenanceMessage || 'Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!'}
            </p>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            {storeInfo.whatsapp && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Pedir pelo WhatsApp</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="py-3.5 px-6 rounded-2xl bg-stone-700/80 hover:bg-stone-700 active:scale-[0.98] text-stone-200 font-bold text-sm flex items-center justify-center gap-2 border border-stone-600/80 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isRefreshing ? 'Verificando...' : 'Recarregar Página'}</span>
            </button>
          </div>

          {/* Store Details Card */}
          <div className="pt-4 border-t border-stone-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {storeInfo.hours && (
              <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Horário</p>
                  <p className="text-xs text-stone-200 whitespace-pre-line leading-relaxed font-medium mt-0.5">
                    {storeInfo.hours}
                  </p>
                </div>
              </div>
            )}

            {storeInfo.address && (
              <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Localização</p>
                  <p className="text-xs text-stone-200 leading-relaxed font-medium mt-0.5">
                    {storeInfo.address}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Social Media */}
          {storeInfo.instagram && (
            <div className="flex justify-center items-center gap-2 text-xs text-stone-400 pt-1">
              <Instagram className="w-4 h-4 text-pink-400" />
              <span>Acompanhe novidades no Instagram:</span>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold hover:underline"
              >
                {storeInfo.instagram.startsWith('@') ? storeInfo.instagram : `@${storeInfo.instagram}`}
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer with Discreet Admin Link */}
      <footer className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t border-stone-800/80 text-xs text-stone-500">
        <p>© {new Date().getFullYear()} {storeInfo.name || 'DONAMARA - REVENDA'}. Todos os direitos reservados.</p>
        
        <Link
          to="/admin"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800/60 hover:bg-stone-800 hover:text-stone-300 transition-colors border border-stone-700/50 text-stone-400 text-[11px] font-semibold"
        >
          <Lock className="w-3.5 h-3.5 text-stone-400" />
          <span>Área Administrativa</span>
        </Link>
      </footer>
    </div>
  );
};
