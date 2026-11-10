import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Navigation, Clock, CheckCircle2, Phone, MessageCircle, 
  Volume2, VolumeX, X, Store, Home, Compass, RefreshCw, ChefHat, 
  PackageCheck, AlertCircle, ChevronRight, ShieldCheck, Plus
} from 'lucide-react';
import { MotorcycleIcon } from './MotorcycleIcon';
import L from 'leaflet';
import { Order } from '../store/useStore';

interface CustomerOrderTrackerModalProps {
  orderId: string;
  onClose: () => void;
  onStartAppend?: (order: Order) => void;
}

export const CustomerOrderTrackerModal: React.FC<CustomerOrderTrackerModalProps> = ({ orderId, onClose, onStartAppend }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [driver, setDriver] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    return localStorage.getItem('donamara_customer_sound') !== 'false';
  });
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const prevStatusRef = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const motoboyMarkerRef = useRef<L.Marker | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Sound synthesizer for customer alerts
  const playCustomerChime = (type: 'stage_change' | 'out_for_delivery' | 'delivered') => {
    if (!isSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      if (type === 'out_for_delivery') {
        // High 3-tone chime: Motoboy on the way!
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.12 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.4);
        });
      } else if (type === 'delivered') {
        // Success chime
        [587.33, 880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);
          gain.gain.setValueAtTime(0, now + idx * 0.15);
          gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.45);
        });
      } else {
        // Subtle 2-tone update
        [523.25, 659.25].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);
          gain.gain.setValueAtTime(0, now + idx * 0.14);
          gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.14 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.35);
        });
      }
    } catch (e) {
      console.warn('AudioContext playback error:', e);
    }
  };

  const toggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    localStorage.setItem('donamara_customer_sound', String(next));
    if (next) playCustomerChime('stage_change');
  };

  // Fetch tracking data from server
  const fetchTrackingData = async (isInitial = false) => {
    try {
      const res = await fetch(`/api/db/orders/${orderId}/tracking`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Pedido não encontrado.');
        } else {
          setError('Falha ao sincronizar status do pedido.');
        }
        return;
      }
      const data = await res.json();
      const currentOrd = data.order;
      setOrder(currentOrd);
      setDriver(data.driver);
      setStoreInfo(data.store);
      setError(null);

      // Status change detection & sound alert
      if (prevStatusRef.current && prevStatusRef.current !== currentOrd.status) {
        const oldSt = prevStatusRef.current;
        const newSt = currentOrd.status;
        const newLabel = 
          newSt === 'preparing' ? 'Em Preparo na Loja 🥟' :
          newSt === 'ready' || newSt === 'ready_for_delivery' ? 'Pronto para Entrega 📦' :
          newSt === 'out_for_delivery' ? 'Saiu para Entrega com o Motoboy 🛵' :
          newSt === 'completed' ? 'Pedido Entregue! Bom apetite! 🎉' : 'Status Atualizado';

        setStatusNotification(`Atualização: ${newLabel}`);
        setTimeout(() => setStatusNotification(null), 5000);

        if (newSt === 'out_for_delivery') {
          playCustomerChime('out_for_delivery');
        } else if (newSt === 'completed') {
          playCustomerChime('delivered');
        } else {
          playCustomerChime('stage_change');
        }
      }
      prevStatusRef.current = currentOrd.status;
    } catch (err: any) {
      if (isInitial) setError('Erro ao conectar ao rastreamento em tempo real.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // SSE Real-time subscription & Polling backup
  useEffect(() => {
    fetchTrackingData(true);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'driver_location') {
            if (driver && data.driverId === driver.id) {
              setDriver((prev: any) => prev ? { ...prev, coords: data.coords } : prev);
            }
          }
          if (data.type === 'sync' && (data.target === 'orders' || data.action?.includes('order') || data.action?.includes('status'))) {
            fetchTrackingData(false);
          }
        } catch (e) {}
      };
    } catch (e) {
      console.warn('SSE not supported, relying on polling fallback', e);
    }

    // Fast polling backup every 3.5 seconds
    const interval = setInterval(() => {
      fetchTrackingData(false);
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [orderId]);

  // Leaflet Map Initialization & Reactive Marker Updates
  useEffect(() => {
    if (!order || !mapContainerRef.current) return;

    const storeCoords: [number, number] = [
      storeInfo?.coords?.lat || -19.7478, 
      storeInfo?.coords?.lng || -47.9392
    ];

    // Estimate destination coords (approximate offset from store based on address or fallback)
    const destCoords: [number, number] = [
      storeCoords[0] + 0.0075,
      storeCoords[1] + 0.0065
    ];

    // Motoboy coordinates (live GPS, or currentCoords, or interpolated)
    const motoboyCoords: [number, number] = driver?.coords?.lat && driver?.coords?.lng
      ? [driver.coords.lat, driver.coords.lng]
      : [storeCoords[0] + 0.0035, storeCoords[1] + 0.0028];

    // Initialize Map if not created
    if (!mapInstanceRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: motoboyCoords,
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Custom HTML Icons
      const createCustomIcon = (html: string, className = '') => {
        return L.divIcon({
          html,
          className: `custom-leaflet-icon ${className}`,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });
      };

      const storeIcon = createCustomIcon(
        `<div class="w-10 h-10 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
          🏪
        </div>`
      );

      const customerIcon = createCustomIcon(
        `<div class="w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
          🏠
        </div>`
      );

      const motoboyIcon = createCustomIcon(
        `<div class="tracking-pin-pulse w-11 h-11 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl border-3 border-white font-bold text-base animate-pulse">
          🛵
        </div>`
      );

      const storeMarker = L.marker(storeCoords, { icon: storeIcon }).addTo(map);
      storeMarker.bindPopup(`<b>${storeInfo?.name || 'DONAMARA - REVENDA'}</b><br>${storeInfo?.address || 'Ponto de Partida'}`);

      const customerMarker = L.marker(destCoords, { icon: customerIcon }).addTo(map);
      customerMarker.bindPopup(`<b>Seu Endereço de Entrega</b><br>${order.deliveryAddress || 'Endereço do Cliente'}`);

      const motoboyMarker = L.marker(motoboyCoords, { icon: motoboyIcon }).addTo(map);
      motoboyMarker.bindPopup(`<b>${driver?.name || 'Motoboy'}</b><br>A caminho da entrega!`);

      // Polyline route path
      const routePolyline = L.polyline([storeCoords, motoboyCoords, destCoords], {
        color: '#10b981',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8'
      }).addTo(map);

      map.fitBounds(L.latLngBounds([storeCoords, motoboyCoords, destCoords]), { padding: [40, 40] });

      mapInstanceRef.current = map;
      storeMarkerRef.current = storeMarker;
      customerMarkerRef.current = customerMarker;
      motoboyMarkerRef.current = motoboyMarker;
      routePolylineRef.current = routePolyline;
    } else if (mapInstanceRef.current && motoboyMarkerRef.current && routePolylineRef.current) {
      // Update motoboy marker smoothly
      motoboyMarkerRef.current.setLatLng(motoboyCoords);
      routePolylineRef.current.setLatLngs([storeCoords, motoboyCoords, destCoords]);
    }

    return () => {
      // Don't destroy on every re-render, only when closing modal
    };
  }, [order?.id, driver?.coords?.lat, driver?.coords?.lng]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto animate-spin">
            <RefreshCw className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-stone-900 uppercase">Conectando ao Rastreamento...</h3>
          <p className="text-xs text-stone-500">Sincronizando posição do motoboy e status do pedido em tempo real.</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-base font-black text-stone-900 uppercase">Atenção</h3>
          <p className="text-xs text-stone-600">{error || 'Pedido não localizado.'}</p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-wider"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Determine active step index (0 to 3)
  const getStepIndex = () => {
    const st = order.status;
    const dst = order.deliveryStatus;
    if (st === 'completed' || dst === 'delivered') return 3;
    if (st === 'ready' || st === 'ready_for_pickup' || st === 'ready_for_delivery' || dst === 'ready') return 2;
    if (st === 'preparing') return 1;
    return 0; // pending
  };

  const activeStep = getStepIndex();
  const orderNumber = String(order.id).slice(-4).padStart(4, '0');

  const steps = [
    {
      title: 'Pendente',
      desc: 'Pedido recebido e confirmado na fila',
      icon: Clock,
      color: 'bg-amber-500',
      activeColor: 'text-amber-600 bg-amber-50 border-amber-300'
    },
    {
      title: 'Em Preparo',
      desc: 'Sendo assado e preparado quentinho',
      icon: ChefHat,
      color: 'bg-orange-500',
      activeColor: 'text-orange-600 bg-orange-50 border-orange-300'
    },
    {
      title: 'Pronto p/ Retirada',
      desc: 'Embalado e pronto para você retirar no balcão!',
      icon: PackageCheck,
      color: 'bg-emerald-600',
      activeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300'
    },
    {
      title: 'Concluído',
      desc: 'Pedido retirado no balcão com sucesso!',
      icon: CheckCircle2,
      color: 'bg-emerald-700',
      activeColor: 'text-emerald-800 bg-emerald-50 border-emerald-300'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-stone-100 text-stone-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        
        {/* Floating Real-time Notification Banner */}
        {statusNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-black flex items-center justify-between gap-2 shadow-lg animate-in slide-in-from-top duration-300 z-30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{statusNotification}</span>
            </div>
            <button 
              onClick={() => setStatusNotification(null)}
              className="p-1 hover:bg-emerald-700 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Top Header */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-md shadow-orange-600/30">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded-md border border-orange-800/40">
                  Retirada no Balcão
                </span>
                <span className="text-[11px] font-mono font-bold text-stone-400">
                  Pedido #{orderNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                {activeStep === 2 ? 'Pronto para Retirada no Balcão! 🛍️' : activeStep === 3 ? 'Pedido Concluído!' : 'Acompanhamento ao Vivo'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              title={isSoundEnabled ? 'Som de alertas ativado' : 'Som desativado'}
              className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                isSoundEnabled 
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 hover:bg-orange-500/30' 
                  : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-white'
              }`}
            >
              {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 bg-stone-800 text-stone-400 hover:text-white rounded-xl hover:bg-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-6">

          {/* Stepper Pipeline (Igual ao Motoboy e ao Painel de Controle) */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Progresso do Pedido</span>
                <h4 className="text-sm font-black text-stone-900">
                  Etapa {activeStep + 1} de 4: <span className="text-orange-600">{steps[activeStep].title}</span>
                </h4>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ao Vivo</span>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="space-y-3">
              {steps.map((st, idx) => {
                const IconComponent = st.icon;
                const isCompleted = idx < activeStep;
                const isCurrent = idx === activeStep;

                return (
                  <div 
                    key={idx}
                    className={`flex items-start gap-3.5 p-3 rounded-2xl transition-all border ${
                      isCurrent 
                        ? `${st.activeColor} shadow-sm font-bold scale-[1.01]` 
                        : isCompleted 
                        ? 'bg-stone-50 border-stone-200/60 opacity-90' 
                        : 'bg-white border-transparent opacity-40'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isCurrent 
                        ? `${st.color} text-white animate-pulse` 
                        : isCompleted 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-stone-200 text-stone-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <IconComponent className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-tight ${isCurrent ? 'text-stone-900' : isCompleted ? 'text-stone-700' : 'text-stone-400'}`}>
                          {st.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-600 text-white animate-bounce">
                            Agora
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] font-bold text-emerald-600">Concluído ✓</span>
                        )}
                      </div>
                      <p className={`text-[11px] leading-tight mt-0.5 ${isCurrent ? 'text-stone-600 font-medium' : 'text-stone-400'}`}>
                        {st.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card com Informações da Loja e Ponto de Retirada no Balcão */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-orange-600/30">
                  🏪
                </div>
                <div>
                  <h4 className="text-sm font-black text-stone-900 uppercase tracking-tight">
                    Ponto de Retirada no Balcão
                  </h4>
                  <p className="text-[11px] text-stone-500 font-medium">
                    {storeInfo?.name || 'DONAMARA - REVENDA'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${activeStep === 2 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse' : 'bg-stone-100 text-stone-700 border border-stone-200'}`}>
                {activeStep === 2 ? '🛍️ Pronto p/ Retirar!' : '⏳ Em Andamento'}
              </span>
            </div>

            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-stone-700">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-stone-900 block font-black">Endereço para Retirada:</strong>
                  <p className="text-stone-600">{storeInfo?.address || 'Consulte o estabelecimento'}</p>
                </div>
              </div>

              {storeInfo?.hours && (
                <div className="flex items-start gap-2.5 text-stone-700 pt-1 border-t border-stone-200/60">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-900 block font-black">Horário de Funcionamento:</strong>
                    <p className="text-stone-600">{storeInfo.hours}</p>
                  </div>
                </div>
              )}
            </div>

            {storeInfo?.whatsapp && (
              <div className="pt-1">
                <a
                  href={`https://wa.me/55${storeInfo.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de informações sobre o meu pedido de retirada #${orderNumber} na DONAMARA.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Falar com o Balcão via WhatsApp</span>
                </a>
              </div>
            )}
          </div>

          {/* Resumo dos Itens do Pedido */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                Itens do Pedido #{orderNumber}
              </h4>
              {order.items?.some((it: any) => it.isFrozen || it.prepType?.startsWith('congelado') || (it.prepLabel && it.prepLabel.toLowerCase().includes('congelad'))) && (
                <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded-full uppercase">
                  ❄️ Salgados Congelados
                </span>
              )}
            </div>

            {order.items?.some((it: any) => it.isFrozen || it.prepType?.startsWith('congelado') || (it.prepLabel && it.prepLabel.toLowerCase().includes('congelad'))) && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 leading-relaxed space-y-1">
                <p className="font-black text-blue-950 flex items-center gap-1.5">
                  <span>⏱️</span> Prazo de Produção: Até 48 Horas
                </p>
                <p className="text-[11px] text-blue-800">
                  Apesar do prazo de 48h, <strong>o seu pedido pode ficar pronto antes</strong>! Avisaremos você por alertas assim que for liberado.
                </p>
              </div>
            )}

            <div className="divide-y divide-stone-100 text-xs">
              {order.items?.map((item: any, idx: number) => {
                const isHighlight = item.isFrozen || item.prepType?.startsWith('congelado') || (item.name || '').toLowerCase().includes('congelado');
                return (
                  <div key={idx} className="py-2.5 border-b border-stone-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isHighlight ? 'text-blue-700' : 'text-stone-800'}`}>
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-stone-500 font-mono">
                        R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    {item.prepLabel && (
                      <div className="text-[10px] uppercase mt-0.5 ml-4 font-black flex items-center gap-1"
                           style={{ color: item.isFrozen || item.prepType?.startsWith('congelado') ? '#1d4ed8' : '#b45309' }}>
                        <span>{item.isFrozen || item.prepType?.startsWith('congelado') ? '❄️' : '🔥'}</span>
                        <span>{item.prepLabel}</span>
                      </div>
                    )}
                    {item.flavor && (
                      <div className={`text-[10px] uppercase mt-0.5 ml-4 ${
                        (item.flavor.name || '').toLowerCase().includes('congelado') || (item.flavor.name || '').toLowerCase().includes('normal')
                          ? 'text-red-600 font-black'
                          : 'text-stone-400 font-medium'
                      }`}>
                        + Sabor: {item.flavor.name}
                      </div>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <div className="mt-0.5 ml-4 space-y-0.5">
                        {item.addons.map((a: any, aIdx: number) => {
                          const isAHighlight = (a.name || '').toLowerCase().includes('congelado') || (a.name || '').toLowerCase().includes('normal');
                          return (
                            <div key={aIdx} className={`text-[10px] uppercase ${isAHighlight ? 'text-red-600 font-black' : 'text-stone-400 font-medium'}`}>
                              + {a.name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between text-sm">
              <span className="font-black text-stone-900">Total Pago:</span>
              <span className="font-black text-orange-600 font-mono text-base">
                R$ {Number(order.total || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Opção de Fazer Acréscimo no Pedido (se ainda na fila e pagamento na retirada) */}
            {order && order.status === 'pending' && !((order.paymentMethod && order.paymentMethod.includes('Online')) || order.paymentStatus === 'approved') && onStartAppend && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-300 rounded-2xl p-4 space-y-2.5 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    ➕
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-orange-950 uppercase tracking-tight">
                      Deseja fazer um acréscimo neste pedido?
                    </h5>
                    <p className="text-[11px] text-orange-800 font-medium leading-relaxed">
                      Seu pedido ainda está na fila aguardando início do preparo e o pagamento é na retirada. Você pode adicionar mais itens agora!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartAppend(order)}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Fazer Acréscimo / Adicionar Mais Itens</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-stone-200 shrink-0 flex items-center justify-between gap-3">
          <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Atualizado automaticamente via satélite e rede local</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
          >
            Voltar ao Cardápio
          </button>
        </div>

      </div>
    </div>
  );
};
