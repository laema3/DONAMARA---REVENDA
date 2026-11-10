import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, MapPin, CheckCircle2, Clock, Navigation, ShieldCheck, 
  User, LogOut, DollarSign, Package, AlertCircle, KeyRound, X, 
  MessageCircle, ChefHat, BellRing, Volume2, VolumeX, PackageCheck, 
  RefreshCw, Search
} from 'lucide-react';
import { MotorcycleIcon } from './MotorcycleIcon';
import { formatCurrency } from '../lib/utils';

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  pixKey: string;
  status: string;
  pinCode: string;
}

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  deliveryFee?: number;
  status: string;
  createdAt: number;
  customerName: string;
  customerPhone?: string;
  type?: string;
  tableNumber?: string | number;
  deliveryType?: string;
  deliveryAddress?: string;
  driverId?: string;
  driverName?: string;
  deliveryStatus?: string; // 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled'
  deliveryAcceptedAt?: number;
  deliveryCompletedAt?: number;
  scheduledTime?: string;
  paymentMethod?: string;
  notes?: string;
}

export const MotoboyPortal: React.FC<{ storeInfo: any; onBack: () => void }> = ({ storeInfo, onBack }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(() => {
    try {
      const saved = localStorage.getItem('donamara_active_driver');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [pinInput, setPinInput] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'preparing' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Audio state
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('donamara_motoboy_sound') !== 'false';
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  
  // Status alert banner
  const [statusAlert, setStatusAlert] = useState<{
    message: string;
    orderId: string;
    status: string;
    badge: string;
  } | null>(null);

  // Modal states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // GPS Tracking state
  const [isGpsBroadcasting, setIsGpsBroadcasting] = useState(false);
  const [gpsWatchActive, setGpsWatchActive] = useState(false);

  // References for tracking previous orders statuses
  const prevOrdersMapRef = useRef<Map<string, { status: string; deliveryStatus?: string }>>(new Map());
  const isInitialLoadRef = useRef(true);

  // Web Audio Context for synthesized sound chimes
  const playChimeTone = (type: 'status_change' | 'ready' | 'urgent' | 'completed' = 'status_change') => {
    if (!isSoundEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;

        if (type === 'ready' || type === 'urgent') {
          // Double beep high chime (880Hz -> 1046Hz) for Pronto para Entrega / Pedido Novo
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(880, now);
          gain1.gain.setValueAtTime(0.45, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.22);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1046.5, now + 0.14);
          gain2.gain.setValueAtTime(0.5, now + 0.14);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.14);
          osc2.stop(now + 0.5);
        } else if (type === 'completed') {
          // Cheerful 4-tone resolution chime (C5-E5-G5-C6)
          const notes = [523.25, 659.25, 783.99, 1046.50];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0.35, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.25);
          });
        } else {
          // Ascending two-tone chime (587Hz -> 880Hz) for status change (Preparo, etc.)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now);
          gain1.gain.setValueAtTime(0.4, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.18);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, now + 0.1);
          gain2.gain.setValueAtTime(0.45, now + 0.1);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.1);
          osc2.stop(now + 0.42);
        }
        setAudioUnlocked(true);
        return;
      }
    } catch (e) {
      console.warn('Web Audio error:', e);
    }

    // Fallback via HTML5 Audio element
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const unlockAudio = () => {
    playChimeTone('status_change');
    setAudioUnlocked(true);
  };

  const toggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    localStorage.setItem('donamara_motoboy_sound', String(next));
    if (next) {
      playChimeTone('ready');
    }
  };

  // Helper for status label, colors and step index
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendente',
          description: 'Aguardando Início de Preparo',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          dotClass: 'bg-amber-500',
          stepIndex: 1,
          icon: Clock
        };
      case 'preparing':
        return {
          label: 'Em Preparo',
          description: 'Cozinha Preparando o Pedido',
          badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
          dotClass: 'bg-orange-500',
          stepIndex: 2,
          icon: ChefHat
        };
      case 'ready_for_delivery':
      case 'ready':
        return {
          label: 'Pronto p/ Entrega',
          description: 'Pronto no Balcão para Coleta',
          badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
          dotClass: 'bg-purple-600',
          stepIndex: 3,
          icon: PackageCheck
        };
      case 'out_for_delivery':
        return {
          label: 'Saiu p/ Entrega',
          description: 'Em Rota com o Motoboy',
          badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          dotClass: 'bg-indigo-600',
          stepIndex: 4,
          icon: MotorcycleIcon
        };
      case 'completed':
        return {
          label: 'Entregue',
          description: 'Entrega Concluída com Sucesso',
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dotClass: 'bg-emerald-600',
          stepIndex: 5,
          icon: CheckCircle2
        };
      case 'cancelled':
        return {
          label: 'Cancelado',
          description: 'Pedido Cancelado na Loja',
          badgeClass: 'bg-red-100 text-red-900 border-red-300',
          dotClass: 'bg-red-600',
          stepIndex: 0,
          icon: AlertCircle
        };
      default:
        return {
          label: status || 'Pendente',
          description: 'Status Atualizado',
          badgeClass: 'bg-stone-100 text-stone-800 border-stone-300',
          dotClass: 'bg-stone-500',
          stepIndex: 1,
          icon: Clock
        };
    }
  };

  // Stepper Visual Pipeline: 1. Pendente -> 2. Preparo -> 3. Pronto -> 4. Em Rota -> 5. Entregue
  const renderPipeline = (currentStatus: string) => {
    const steps = [
      { key: 'pending', label: '1. Pendente' },
      { key: 'preparing', label: '2. Preparo' },
      { key: 'ready_for_delivery', label: '3. Pronto' },
      { key: 'out_for_delivery', label: '4. Em Rota' },
      { key: 'completed', label: '5. Entregue' }
    ];

    const getStepNum = (st: string) => {
      if (st === 'pending') return 1;
      if (st === 'preparing') return 2;
      if (st === 'ready' || st === 'ready_for_delivery' || st === 'ready_for_pickup') return 3;
      if (st === 'out_for_delivery') return 4;
      if (st === 'completed') return 5;
      return 1;
    };

    const currentNum = getStepNum(currentStatus);
    const isCancelled = currentStatus === 'cancelled';

    if (isCancelled) {
      return (
        <div className="py-2 px-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>Pedido cancelado pelo estabelecimento.</span>
        </div>
      );
    }

    return (
      <div className="pt-2 pb-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1.5 px-0.5">
          <span>Etapa Atual:</span>
          <span className="font-extrabold text-stone-800">
            Passo {currentNum} de 5
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {steps.map((s, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === currentNum;
            const isPassed = stepNum < currentNum;

            return (
              <div key={s.key} className="flex flex-col items-center text-center">
                <div 
                  className={`w-full h-2 rounded-full transition-all duration-300 ${
                    isCurrent 
                      ? 'bg-orange-500 shadow-sm shadow-orange-500/50 animate-pulse' 
                      : isPassed 
                      ? 'bg-emerald-500' 
                      : 'bg-stone-200'
                  }`}
                />
                <span className={`text-[10px] mt-1 leading-tight font-black ${
                  isCurrent 
                    ? 'text-orange-600' 
                    : isPassed 
                    ? 'text-emerald-700' 
                    : 'text-stone-400'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // PWA Install prompt listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Efeito para Transmitir GPS do Motoboy em Tempo Real para o Cliente (Estilo iFood)
  useEffect(() => {
    if (!currentDriver) {
      setIsGpsBroadcasting(false);
      return;
    }

    const activeDeliveries = orders.filter(o => 
      o.driverId === currentDriver.id && 
      (o.deliveryStatus === 'in_transit' || o.status === 'out_for_delivery')
    );

    if (activeDeliveries.length === 0) {
      setIsGpsBroadcasting(false);
      return;
    }

    setIsGpsBroadcasting(true);
    let watchId: number | null = null;
    let fallbackInterval: any = null;

    const transmitLocation = async (lat: number, lng: number, heading = 0, speed = 0) => {
      try {
        await fetch(`/api/db/drivers/${currentDriver.id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, heading, speed })
        });
      } catch (err) {
        console.warn('Erro ao transmitir localização do motoboy:', err);
      }
    };

    if ('geolocation' in navigator) {
      setGpsWatchActive(true);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          transmitLocation(
            pos.coords.latitude, 
            pos.coords.longitude, 
            pos.coords.heading || 0, 
            pos.coords.speed || 0
          );
        },
        (err) => {
          console.warn('Aviso de GPS (simulando avanço de rota do motoboy):', err);
          let tick = 0;
          fallbackInterval = setInterval(() => {
            tick++;
            const simLat = -19.7478 + Math.sin(tick / 5) * 0.003;
            const simLng = -47.9392 + Math.cos(tick / 5) * 0.003;
            transmitLocation(simLat, simLng, 45, 25);
          }, 6000);
        },
        { enableHighAccuracy: true, maximumAge: 6000, timeout: 15000 }
      );
    } else {
      let tick = 0;
      fallbackInterval = setInterval(() => {
        tick++;
        const simLat = -19.7478 + Math.sin(tick / 5) * 0.003;
        const simLng = -47.9392 + Math.cos(tick / 5) * 0.003;
        transmitLocation(simLat, simLng, 45, 25);
      }, 6000);
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [currentDriver?.id, orders]);

  // Fetch orders & drivers and compare status changes
  const fetchDriversAndOrders = async () => {
    try {
      const [drvRes, ordRes] = await Promise.all([
        fetch('/api/db/drivers'),
        fetch('/api/db/orders')
      ]);

      if (drvRes.ok) setDrivers(await drvRes.json());
      
      if (ordRes.ok) {
        const newOrders: Order[] = await ordRes.json();
        
        // Filtrar exclusivamente pedidos de delivery (excluindo estritamente totem e mesas)
        const deliveryOrders = newOrders.filter((o: any) => 
          (o.deliveryType === 'delivery' || o.type === 'delivery') && 
          o.type !== 'kiosk' && 
          !o.tableNumber
        );

        if (isInitialLoadRef.current) {
          // Primeira carga: registra estado inicial sem soar alarme para evitar sustos
          isInitialLoadRef.current = false;
          const initialMap = new Map<string, { status: string; deliveryStatus?: string }>();
          deliveryOrders.forEach(o => {
            initialMap.set(String(o.id), { status: o.status, deliveryStatus: o.deliveryStatus });
          });
          prevOrdersMapRef.current = initialMap;
        } else {
          // Cargas subsequentes: detecta alterações de status ou novos pedidos
          let hasStatusChange = false;
          let changedOrder: { id: string; status: string; type: 'new' | 'status_change'; label: string } | null = null;

          for (const ord of deliveryOrders) {
            const ordId = String(ord.id);
            const prev = prevOrdersMapRef.current.get(ordId);

            if (!prev) {
              // Novo pedido de delivery chegou
              hasStatusChange = true;
              changedOrder = {
                id: ordId,
                status: ord.status,
                type: 'new',
                label: getStatusInfo(ord.status).label
              };
              break;
            } else if (prev.status !== ord.status || prev.deliveryStatus !== ord.deliveryStatus) {
              // Status existente foi alterado no painel de controle
              hasStatusChange = true;
              changedOrder = {
                id: ordId,
                status: ord.status,
                type: 'status_change',
                label: getStatusInfo(ord.status).label
              };
              break;
            }
          }

          if (hasStatusChange && changedOrder) {
            const soundTone = 
              changedOrder.status === 'ready' || changedOrder.status === 'ready_for_delivery' ? 'ready' :
              changedOrder.status === 'completed' ? 'completed' :
              changedOrder.type === 'new' ? 'urgent' : 'status_change';

            playChimeTone(soundTone);

            const shortId = changedOrder.id.slice(-4).padStart(4, '0');
            const alertMsg = changedOrder.type === 'new' 
              ? `Novo Pedido Delivery #${shortId} chegou!`
              : `Pedido #${shortId} alterou para: ${changedOrder.label}`;

            setStatusAlert({
              message: alertMsg,
              orderId: changedOrder.id,
              status: changedOrder.status,
              badge: changedOrder.label
            });

            // Auto-hide alert after 6 seconds
            setTimeout(() => {
              setStatusAlert(prev => prev?.orderId === changedOrder?.id ? null : prev);
            }, 6000);
          }

          // Atualiza mapa de referência
          const updatedMap = new Map<string, { status: string; deliveryStatus?: string }>();
          deliveryOrders.forEach(o => {
            updatedMap.set(String(o.id), { status: o.status, deliveryStatus: o.deliveryStatus });
          });
          prevOrdersMapRef.current = updatedMap;
        }

        setOrders(newOrders);
      }
    } catch (e) {
      console.error('Erro ao buscar dados do motoboy:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time synchronization via SSE + polling fallback
  useEffect(() => {
    fetchDriversAndOrders();

    // SSE Real-time connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.target === 'orders' || data.type === 'orders' || data.action?.includes('order')) {
            fetchDriversAndOrders();
          }
        } catch (e) {}
      };
      eventSource.onerror = () => {
        // SSE disconnected, polling will act as backup
      };
    } catch (e) {}

    // Polling backup every 3.5 seconds
    const interval = setInterval(fetchDriversAndOrders, 3500);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchDriversAndOrders();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const drv = drivers.find(d => d.id === selectedDriverId);
    if (!drv) {
      alert('Selecione um motoboy.');
      return;
    }
    if (drv.pinCode && drv.pinCode !== pinInput.trim()) {
      alert('PIN de acesso incorreto.');
      return;
    }
    setCurrentDriver(drv);
    localStorage.setItem('donamara_active_driver', JSON.stringify(drv));
    unlockAudio();
  };

  const handleLogout = () => {
    setCurrentDriver(null);
    localStorage.removeItem('donamara_active_driver');
    setPinInput('');
  };

  const handleAcceptDelivery = async (orderId: string) => {
    if (!currentDriver) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/db/orders/${orderId}/accept-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: currentDriver.id, driverName: currentDriver.name })
      });
      if (res.ok) {
        playChimeTone('status_change');
        await fetchDriversAndOrders();
        setActiveTab('active');
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao aceitar entrega. O pedido pode já ter sido pego por outro motoboy.');
      }
    } catch (e) {
      alert('Erro de conexão ao aceitar entrega.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    if (!currentDriver) return;
    if (!confirm('Deseja confirmar a entrega realizada com sucesso ao cliente?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/db/orders/${orderId}/complete-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: currentDriver.id })
      });
      if (res.ok) {
        playChimeTone('completed');
        await fetchDriversAndOrders();
        setActiveTab('history');
      } else {
        alert('Erro ao concluir entrega.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentDriver) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white text-stone-900 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-stone-200">
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="text-xs text-stone-500 hover:text-stone-800 font-bold">
              ← Voltar ao Início
            </button>
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <MotorcycleIcon className="w-7 h-7" />
            </div>
            <div className="w-12"></div>
          </div>

          <h1 className="text-2xl font-black text-center mb-1 text-stone-900">Portal do Motoboy</h1>
          <p className="text-xs text-stone-500 text-center mb-6">Identifique-se para acessar suas entregas em tempo real</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Selecione seu Nome</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full p-3.5 bg-stone-50 border border-stone-300 rounded-xl font-bold text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500 cursor-pointer"
                required
              >
                <option value="">-- Escolha seu cadastro --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.vehicle})</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-700">PIN de Acesso (Senha)</label>
                <button
                  type="button"
                  onClick={() => setShowForgotPinModal(true)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Digite seu PIN (Ex: 1234)"
                className="w-full p-3.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-center text-lg font-black tracking-widest text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-base shadow-lg shadow-orange-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Entrar no Portal</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-100 text-center">
            <button
              onClick={handleInstallClick}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4 text-orange-400" />
              <span>📲 Instalar App do Motoboy no Celular</span>
            </button>
            <p className="text-[11px] text-stone-400 mt-2">Instale o aplicativo na tela inicial do seu celular para acesso rápido.</p>
          </div>
        </div>

        {/* Modal Esqueceu a Senha / PIN */}
        {showForgotPinModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button
                type="button"
                onClick={() => setShowForgotPinModal(false)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 text-orange-600">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">Esqueceu seu PIN / Senha?</h3>
                  <p className="text-xs text-stone-500">Recuperação de acesso do entregador</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2">
                <p>
                  Por motivos de segurança, a redefinição de senha do motoboy é feita diretamente pelo <strong>administrador ou gerente da loja</strong> no painel de controle.
                </p>
                <p>
                  O administrador acessa o painel de controle (aba <strong>Entregadores</strong>), clica em <strong>"Editar"</strong> no seu cadastro e define um novo PIN de 4 dígitos.
                </p>
              </div>

              {storeInfo?.phone && (
                <a
                  href={`https://wa.me/55${storeInfo.phone.replace(/\D/g, '')}?text=Olá,%20sou%20motoboy%20e%20esqueci%20meu%20PIN%20de%20acesso%20ao%20portal.%20Poderia%20redefinir%20minha%20senha?`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Solicitar Redefinição via WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowForgotPinModal(false)}
                className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Entendi, Voltar ao Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filtrar exclusivamente pedidos de delivery (excluindo estritamente totem e mesas)
  const deliveryOrders = orders.filter(o => 
    (o.deliveryType === 'delivery' || o.type === 'delivery') && 
    o.type !== 'kiosk' && 
    !o.tableNumber
  );

  // Pedidos disponíveis para entrega (não atribuídos a outro motoboy ou pendentes)
  const availableOrdersRaw = deliveryOrders.filter(o => 
    (o.status === 'ready' || o.status === 'ready_for_delivery' || o.status === 'preparing' || o.status === 'pending') && 
    (!o.driverId || o.deliveryStatus === 'pending')
  );

  // Sub-filtros por etapa dentro de Disponíveis
  const availableOrders = availableOrdersRaw.filter(o => {
    if (statusFilter === 'ready') return o.status === 'ready' || o.status === 'ready_for_delivery';
    if (statusFilter === 'preparing') return o.status === 'preparing';
    if (statusFilter === 'pending') return o.status === 'pending';
    return true;
  }).filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.deliveryAddress || '').toLowerCase().includes(q) ||
      String(o.id).toLowerCase().includes(q)
    );
  });

  // Pedidos em rota com este motoboy
  const myActiveOrders = deliveryOrders.filter(o => 
    o.driverId === currentDriver.id && 
    o.deliveryStatus !== 'delivered' && 
    o.status !== 'completed' &&
    o.status !== 'cancelled'
  );

  // Histórico de pedidos entregues por este motoboy hoje
  const myHistoryOrders = deliveryOrders.filter(o => 
    o.driverId === currentDriver.id && 
    (o.deliveryStatus === 'delivered' || o.status === 'completed')
  );

  const readyCount = availableOrdersRaw.filter(o => o.status === 'ready' || o.status === 'ready_for_delivery').length;
  const preparingCount = availableOrdersRaw.filter(o => o.status === 'preparing').length;
  const pendingCount = availableOrdersRaw.filter(o => o.status === 'pending').length;

  // Cálculo de taxas acumuladas
  const totalEarnedToday = myHistoryOrders.reduce((sum, ord) => sum + (Number(ord.deliveryFee) || 8.00), 0);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans pb-16">
      {/* Floating Status Update Toast Alert */}
      {statusAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-stone-950 text-white p-4 rounded-2xl shadow-2xl border-2 border-orange-500 animate-in slide-in-from-top duration-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center font-bold shrink-0 animate-bounce">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Aviso Sonoro de Status</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              </div>
              <div className="text-xs sm:text-sm font-black text-white">{statusAlert.message}</div>
            </div>
          </div>
          <button 
            onClick={() => setStatusAlert(null)}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-stone-900 text-white px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-bold shadow-md shadow-orange-600/30">
            <MotorcycleIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-black text-sm sm:text-base leading-tight flex items-center gap-1.5">
              <span>{currentDriver.name}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-400">
              <span>{currentDriver.vehicle}</span>
              {isGpsBroadcasting && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>GPS Ativo</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle Button */}
          <button
            onClick={toggleSound}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isSoundEnabled 
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900' 
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
            }`}
            title={isSoundEnabled ? 'Alertas sonoros ativados (clique para silenciar ou testar)' : 'Alertas sonoros desativados (clique para ativar)'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            <span className="hidden sm:inline">{isSoundEnabled ? 'Som Ativo' : 'Mudo'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors cursor-pointer"
            title="Atualizar Pedidos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          {/* Install PWA Button */}
          <button
            onClick={handleInstallClick}
            className="p-2 sm:px-3 sm:py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Instalar App no Celular"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Instalar App</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors cursor-pointer"
            title="Sair do Portal"
          >
            <LogOut className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </header>

      {/* Audio Unlock Banner if blocked */}
      {!audioUnlocked && isSoundEnabled && (
        <button
          onClick={unlockAudio}
          className="w-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white px-4 py-2.5 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:brightness-105 active:scale-99"
        >
          <BellRing className="w-4 h-4 animate-bounce" />
          <span>Toque aqui para ativar o aviso sonoro automático de etapas e pedidos! 🔔</span>
        </button>
      )}

      {/* Stats Bar */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 grid grid-cols-2 gap-3 max-w-2xl w-full mx-auto my-3 rounded-2xl shadow-xs">
        <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Entregas Hoje</div>
            <div className="text-lg font-black text-orange-700">{myHistoryOrders.length}</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Taxas Acumuladas</div>
            <div className="text-lg font-black text-emerald-700">{formatCurrency(totalEarnedToday)}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-2xl w-full mx-auto px-4 mb-3">
        <div className="grid grid-cols-3 gap-2 bg-stone-200 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'available' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Disponíveis</span>
            {availableOrdersRaw.length > 0 && (
              <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                {availableOrdersRaw.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'active' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Em Rota</span>
            {myActiveOrders.length > 0 && (
              <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black">
                {myActiveOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Histórico</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-2xl w-full mx-auto px-4 flex-1 space-y-4">
        {activeTab === 'available' && (
          <div className="space-y-3">
            {/* Sub-Filters for stages inside Disponíveis */}
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-stone-700">Filtrar por Etapa:</span>
                <span className="text-[11px] text-stone-400">Total: {availableOrdersRaw.length} pedidos</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-stone-900 text-white shadow-xs' 
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Todos ({availableOrdersRaw.length})
                </button>
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'ready' 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Prontos p/ Coleta ({readyCount})
                </button>
                <button
                  onClick={() => setStatusFilter('preparing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'preparing' 
                      ? 'bg-orange-600 text-white shadow-xs' 
                      : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  Em Preparo ({preparingCount})
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'pending' 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Pendentes ({pendingCount})
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por cliente, endereço ou número..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* List of Orders */}
            {availableOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-stone-400 border border-stone-200">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-stone-400" />
                <p className="font-bold text-stone-700 text-sm">Nenhum pedido de delivery encontrado nesta categoria</p>
                <p className="text-xs text-stone-500 mt-1">Quando houver novos pedidos ou alterações na cozinha, você ouvirá um aviso sonoro imediato.</p>
              </div>
            ) : (
              availableOrders.map(ord => {
                const statusInfo = getStatusInfo(ord.status);
                const isReady = ord.status === 'ready' || ord.status === 'ready_for_delivery';
                const isPreparing = ord.status === 'preparing';
                const isPending = ord.status === 'pending';

                return (
                  <div key={ord.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-3.5 transition-all hover:shadow-md">
                    {/* Header with ID, Badge, Timestamp and Total */}
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black bg-stone-900 text-white px-2.5 py-1 rounded-lg">
                          #{String(ord.id).slice(-4).padStart(4, '0')}
                        </span>
                        
                        {/* Status Badge with matching color */}
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 uppercase ${statusInfo.badgeClass}`}>
                          <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass} ${isReady ? 'animate-ping' : ''}`} />
                          <span>{statusInfo.label}</span>
                        </span>

                        <span className="text-xs text-stone-500">
                          {new Date(ord.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="font-black text-emerald-600 text-base">{formatCurrency(ord.total)}</span>
                    </div>

                    {/* Stepper Pipeline */}
                    {renderPipeline(ord.status)}

                    {/* Customer & Address Details */}
                    <div className="space-y-1.5 text-sm pt-1">
                      <div className="font-bold text-stone-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-stone-400 shrink-0" />
                        <span>{ord.customerName || 'Cliente'}</span>
                      </div>
                      
                      <div className="text-stone-700 flex items-start gap-2 text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-stone-900">Endereço de Entrega:</div>
                          <div className="font-medium text-stone-700">{ord.deliveryAddress || 'Endereço não informado'}</div>
                        </div>
                      </div>

                      {ord.scheduledTime && (
                        <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-1.5 text-xs font-bold">
                          <span>⏰ Horário Agendado: {ord.scheduledTime}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons based on stage */}
                    <div className="pt-2">
                      {isReady ? (
                        <button
                          onClick={() => handleAcceptDelivery(ord.id)}
                          disabled={loading}
                          className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 active:scale-99 text-white rounded-xl font-black text-sm transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 animate-pulse"
                        >
                          <MotorcycleIcon className="w-5 h-5" />
                          <span>Pronto no Balcão! Aceitar e Iniciar Rota</span>
                        </button>
                      ) : isPreparing ? (
                        <button
                          onClick={() => handleAcceptDelivery(ord.id)}
                          disabled={loading}
                          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-sm transition-all cursor-pointer shadow-md shadow-orange-600/20 flex items-center justify-center gap-2"
                        >
                          <ChefHat className="w-5 h-5" />
                          <span>Em Preparo na Cozinha - Assumir Corrida</span>
                        </button>
                      ) : (
                        <div className="py-2.5 px-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Pendente: Aguardando a cozinha iniciar o preparo...</span>
                          </span>
                          <button
                            onClick={() => handleAcceptDelivery(ord.id)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-[11px] cursor-pointer shadow-xs"
                          >
                            Pré-Assumir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Em Rota */}
        {activeTab === 'active' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-stone-700 px-1">Entregas em Andamento ({myActiveOrders.length})</h2>
            {myActiveOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-stone-400 border border-stone-200">
                <MotorcycleIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-stone-400" />
                <p className="font-bold text-stone-700 text-sm">Você não está em nenhuma rota no momento</p>
                <p className="text-xs text-stone-500 mt-1">Aceite uma corrida disponível para iniciar a entrega.</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Ver Pedidos Disponíveis
                </button>
              </div>
            ) : (
              myActiveOrders.map(ord => {
                const acceptedTime = ord.deliveryAcceptedAt || ord.createdAt;
                const elapsedMin = Math.floor((Date.now() - acceptedTime) / 60000);
                const remainingMin = Math.max(0, 35 - elapsedMin);

                return (
                  <div key={ord.id} className="bg-white rounded-2xl p-5 border-2 border-emerald-500 shadow-md space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                          Pedido #{String(ord.id).slice(-4).padStart(4, '0')} (Em Rota)
                        </span>
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {formatCurrency(ord.total)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                        <span>~{remainingMin} min restantes</span>
                      </div>
                    </div>

                    {/* Stepper Pipeline */}
                    {renderPipeline(ord.status || 'out_for_delivery')}

                    {/* Live GPS badge indicator */}
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span className="font-bold">GPS Ao Vivo Transmitindo</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-emerald-600 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        Cliente Acompanhando 🗺️
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="font-bold text-stone-900 text-base">
                        {ord.customerName || 'Cliente'}
                      </div>
                      <div className="text-stone-700 flex items-start gap-2 text-xs bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-stone-900">Endereço de Entrega:</div>
                          <div className="font-medium text-stone-700">{ord.deliveryAddress || 'Endereço não informado'}</div>
                        </div>
                      </div>

                      {ord.customerPhone && (
                        <a
                          href={`https://wa.me/55${ord.customerPhone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(ord.customerName)},%20sou%20o%20motoboy%20da%20DONAMARA%20-%20REVENDA%20e%20estou%20a%20caminho%20com%20o%20seu%20pedido!%20🛵💨🥟`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                        >
                          <Phone className="w-4 h-4" />
                          <span>Chamar Cliente no WhatsApp</span>
                        </a>
                      )}

                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(ord.deliveryAddress || '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Abrir Rota no Google Maps / Waze</span>
                      </a>
                    </div>

                    <div className="pt-2 border-t border-stone-100">
                      <button
                        onClick={() => handleCompleteDelivery(ord.id)}
                        disabled={loading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-base transition-all cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                        <span>Confirmar Entrega Realizada</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Histórico */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-stone-700 px-1">Entregas Concluídas Hoje ({myHistoryOrders.length})</h2>
            {myHistoryOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-stone-400 border border-stone-200">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-stone-700 text-sm">Nenhuma entrega concluída ainda hoje</p>
                <p className="text-xs text-stone-500 mt-1">Conclua entregas para registrar seu histórico de ganhos.</p>
              </div>
            ) : (
              myHistoryOrders.map(ord => (
                <div key={ord.id} className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
                        <span>Pedido #{String(ord.id).slice(-4).padStart(4, '0')}</span>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Entregue
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 line-clamp-1 mt-0.5">{ord.customerName} - {ord.deliveryAddress}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-600">+ {formatCurrency(Number(ord.deliveryFee) || 8.00)}</div>
                      <div className="text-[10px] text-stone-400">Total: {formatCurrency(ord.total)}</div>
                    </div>
                  </div>
                  {/* Stepper Pipeline in completed state */}
                  {renderPipeline(ord.status || 'completed')}
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Instruções de Instalação */}
        {showInstallModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 w-8 h-8 bg-stone-100 hover:bg-stone-200 rounded-full flex items-center justify-center font-bold text-stone-600"
              >
                ✕
              </button>
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-4">
                <MotorcycleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-center mb-1">Como instalar o App do Motoboy</h3>
              <p className="text-xs text-stone-500 text-center mb-6">Tenha o aplicativo na tela inicial do seu smartphone para receber avisos sonoros e entregas.</p>

              <div className="space-y-4 text-xs text-stone-700 mb-6">
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <div className="font-black text-stone-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                    No Android (Google Chrome):
                  </div>
                  <p className="text-stone-600 pl-7">Toque no menu de 3 pontinhos no canto superior direito do navegador e selecione <b>"Adicionar à tela inicial"</b> ou <b>"Instalar aplicativo"</b>.</p>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                  <div className="font-black text-stone-900 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                    No iPhone (Safari / iOS):
                  </div>
                  <p className="text-stone-600 pl-7">Toque no ícone de <b>Compartilhar</b> (quadrado com seta para cima na barra inferior) e escolha <b>"Adicionar à Tela de Início"</b>.</p>
                </div>
              </div>

              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm cursor-pointer shadow-md"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
