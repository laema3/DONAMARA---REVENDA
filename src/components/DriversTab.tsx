import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Phone, MapPin, Clock, CheckCircle2, User, 
  ShieldCheck, DollarSign, Package, Pencil, KeyRound, Eye, EyeOff, 
  AlertCircle, AlertTriangle, X, Check, Dices 
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

export const DriversTab: React.FC<{ orders: any[] }> = ({ orders }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Moto Honda Fan - Placa XXX-0000');
  const [pixKey, setPixKey] = useState('');
  const [pinCode, setPinCode] = useState('1234');
  const [loading, setLoading] = useState(false);

  // States for Editing Driver & Password Reset
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editPixKey, setEditPixKey] = useState('');
  const [editPinCode, setEditPinCode] = useState('');
  const [editStatus, setEditStatus] = useState('available');
  const [showEditPin, setShowEditPin] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);

  // State for Delete Confirmation Modal
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  // In-app Notification Feedback
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/db/drivers');
      if (res.ok) setDrivers(await res.json());
    } catch (e) {
      console.error('Erro ao buscar motoboys:', e);
    }
  };

  useEffect(() => {
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      showFeedback('error', 'Preencha o nome e o telefone do motoboy.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/db/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `driver_${Date.now()}`,
          name: name.trim(),
          phone: phone.trim(),
          vehicle: vehicle.trim(),
          pixKey: pixKey.trim(),
          pinCode: pinCode.trim() || '1234',
          status: 'available',
          createdAt: Date.now()
        })
      });
      if (res.ok) {
        setName('');
        setPhone('');
        setPixKey('');
        setPinCode('1234');
        await fetchDrivers();
        showFeedback('success', 'Motoboy cadastrado com sucesso!');
      } else {
        showFeedback('error', 'Erro ao cadastrar motoboy.');
      }
    } catch (e) {
      showFeedback('error', 'Erro de conexão ao salvar motoboy.');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (drv: Driver) => {
    setEditingDriver(drv);
    setEditName(drv.name || '');
    setEditPhone(drv.phone || '');
    setEditVehicle(drv.vehicle || '');
    setEditPixKey(drv.pixKey || '');
    setEditPinCode(drv.pinCode || '1234');
    setEditStatus(drv.status || 'available');
    setShowEditPin(false);
    setShowEditConfirmModal(false);
  };

  const handleGenerateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setEditPinCode(randomPin);
    setShowEditPin(true);
  };

  // Handle Edit form submission: opens confirmation modal
  const handlePreSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      showFeedback('error', 'Preencha o nome e o telefone do motoboy.');
      return;
    }
    if (!editPinCode.trim()) {
      showFeedback('error', 'Informe um PIN/senha de acesso válido para o motoboy.');
      return;
    }
    setShowEditConfirmModal(true);
  };

  // Confirm and Execute Edit Save
  const handleConfirmSaveEdit = async () => {
    if (!editingDriver) return;
    setLoading(true);
    try {
      const updatedDriver = {
        id: editingDriver.id,
        name: editName.trim(),
        phone: editPhone.trim(),
        vehicle: editVehicle.trim(),
        pixKey: editPixKey.trim(),
        pinCode: editPinCode.trim(),
        status: editStatus
      };

      const res = await fetch(`/api/db/drivers/${editingDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDriver)
      });

      if (res.ok) {
        await fetchDrivers();
        const savedName = editName.trim();
        const savedPin = editPinCode.trim();
        setShowEditConfirmModal(false);
        setEditingDriver(null);
        showFeedback('success', `Cadastro e senha do motoboy ${savedName} atualizados com sucesso! Novo PIN de acesso: ${savedPin}`);
      } else {
        showFeedback('error', 'Erro ao atualizar dados do motoboy.');
      }
    } catch (e) {
      showFeedback('error', 'Erro de conexão ao salvar alterações.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Driver with Confirmation
  const handleConfirmDeleteDriver = async () => {
    if (!driverToDelete) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/db/drivers/${driverToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchDrivers();
        showFeedback('success', `Motoboy ${driverToDelete.name} excluído com sucesso.`);
        setDriverToDelete(null);
      } else {
        showFeedback('error', 'Erro ao excluir motoboy.');
      }
    } catch (e) {
      showFeedback('error', 'Erro de conexão ao excluir motoboy.');
    } finally {
      setLoading(false);
    }
  };

  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    const drv = drivers.find(d => d.id === driverId);
    try {
      const res = await fetch(`/api/db/orders/${orderId}/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: drv ? drv.id : null,
          driverName: drv ? drv.name : null
        })
      });
      if (res.ok) {
        playChimeSound();
        showFeedback('success', 'Motoboy atribuído com sucesso!');
      } else {
        showFeedback('error', 'Erro ao atribuir motoboy.');
      }
    } catch (e) {
      showFeedback('error', 'Erro de conexão ao atribuir motoboy.');
    }
  };

  const deliveryOrders = orders.filter(o => 
    (o.deliveryType === 'delivery' || o.type === 'delivery') && 
    o.type !== 'kiosk' && 
    !o.tableNumber
  );
  const activeDeliveries = deliveryOrders.filter(o => o.deliveryStatus === 'in_transit' || o.status === 'out_for_delivery');
  const pendingDeliveries = deliveryOrders.filter(o => 
    (o.status === 'ready' || o.status === 'ready_for_delivery' || o.status === 'preparing' || o.status === 'pending') && 
    (!o.driverId || o.deliveryStatus === 'pending')
  );

  return (
    <div className="space-y-8 p-4 sm:p-6">
      {/* Toast Notification */}
      {notification && (
        <div 
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top duration-200 ${
            notification.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-red-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/20 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
            <MotorcycleIcon className="w-7 h-7 text-orange-600" />
            <span>Gestão de Entregas & Motoboys</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Cadastre entregadores, redefina senhas/PIN em caso de esquecimento e controle entregas em rota.
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-4 py-3 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-600 font-medium">Entregas Ativas na Rua</div>
            <div className="text-lg font-black text-orange-700">{activeDeliveries.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cadastro de Novo Motoboy */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 space-y-5">
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-600" />
            <span>Cadastrar Novo Motoboy</span>
          </h2>

          <form onSubmit={handleAddDriver} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Silva"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">WhatsApp / Telefone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(34) 99999-9999"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Veículo / Placa</label>
              <input
                type="text"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Ex: Honda Fan 160 - Placa ABC-1234"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Chave Pix (Para repasse)</label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, Telefone ou Chave Aleatória"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">PIN de Acesso (Senha)</label>
              <input
                type="text"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Ex: 1234"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-center font-bold tracking-widest text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
              <p className="text-[11px] text-stone-500 mt-1">
                PIN de 4 a 6 dígitos usado pelo entregador para entrar no portal.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl font-black text-sm transition-all shadow-md shadow-orange-600/30 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>Salvar Novo Motoboy</span>
            </button>
          </form>

          {/* Lista de Motoboys Cadastrados */}
          <div className="pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-800">
                Entregadores Cadastrados ({drivers.length})
              </h3>
              <span className="text-[11px] text-stone-400 font-medium">Acesso & Senhas</span>
            </div>

            {drivers.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                Nenhum motoboy cadastrado ainda.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {drivers.map(drv => (
                  <div 
                    key={drv.id} 
                    className="p-3 bg-stone-50 hover:bg-orange-50/30 rounded-xl border border-stone-200 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                          {drv.name}
                        </span>
                        {drv.status === 'in_transit' ? (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md">
                            Na rua
                          </span>
                        ) : drv.status === 'offline' ? (
                          <span className="text-[10px] bg-stone-200 text-stone-600 font-bold px-1.5 py-0.5 rounded-md">
                            Offline
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                            Disponível
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">
                        {drv.vehicle} • {drv.phone}
                      </div>
                      <div className="text-[11px] text-stone-700 font-mono mt-1 flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3 text-orange-500" />
                        <span>PIN: <strong className="text-stone-900 bg-stone-200/80 px-1.5 py-0.5 rounded">{drv.pinCode || '1234'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão Editar com Confirmação */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(drv)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                        title="Editar cadastro ou redefinir senha do motoboy"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>

                      {/* Botão Excluir */}
                      <button
                        type="button"
                        onClick={() => setDriverToDelete(drv)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Excluir Motoboy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Entregas em Tempo Real & Fila de Atribuição */}
        <div className="lg:col-span-2 space-y-6">
          {/* Entregas Ativas na Rua */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 space-y-4">
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>Pedidos em Rota (Na Rua)</span>
            </h2>

            {activeDeliveries.length === 0 ? (
              <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <MotorcycleIcon className="w-12 h-12 mx-auto mb-2 opacity-30 text-stone-400" />
                <p className="font-bold text-stone-700 text-sm">Nenhum pedido em rota no momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDeliveries.map(ord => {
                  const acceptedTime = ord.deliveryAcceptedAt || ord.createdAt;
                  const elapsedMin = Math.floor((Date.now() - acceptedTime) / 60000);

                  return (
                    <div key={ord.id} className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-md">
                            Pedido #{String(ord.id).slice(-4).padStart(4, '0')}
                          </span>
                          <span className="text-xs font-bold text-stone-700">
                            Motoboy: <span className="text-orange-600">{ord.driverName || 'Não atribuído'}</span>
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>{ord.deliveryAddress || 'Endereço não informado'}</span>
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          Tempo em rota: <strong>{elapsedMin} minutos</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                          value={ord.driverId || ''}
                          onChange={(e) => handleAssignDriver(ord.id, e.target.value)}
                          className="p-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800"
                        >
                          <option value="">-- Alterar Motoboy --</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fila de Prontos para Entrega (Aguardando Motoboy) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 space-y-4">
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              <span>Pedidos Prontos Aguardando Coleta</span>
            </h2>

            {pendingDeliveries.length === 0 ? (
              <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30 text-stone-400" />
                <p className="font-bold text-stone-700 text-sm">Todos os pedidos foram coletados ou não há entregas prontas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDeliveries.map(ord => (
                  <div key={ord.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-amber-500 text-white px-2.5 py-0.5 rounded-md">
                          Pedido #{String(ord.id).slice(-4).padStart(4, '0')}
                        </span>
                        <span className="font-bold text-stone-900 text-sm">{ord.customerName}</span>
                      </div>
                      <div className="text-xs text-stone-600">{ord.deliveryAddress}</div>
                      <div className="text-xs font-black text-emerald-600">{formatCurrency(ord.total)}</div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleAssignDriver(ord.id, e.target.value);
                        }}
                        defaultValue=""
                        className="p-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 w-full sm:w-auto"
                      >
                        <option value="" disabled>Atribuir a Motoboy...</option>
                        {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL EDITAR CADASTRO DE MOTOBOY ================= */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Editar Cadastro de Motoboy</h3>
                  <p className="text-xs text-stone-400">Alteração de dados e redefinição de senha/PIN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDriver(null);
                  setShowEditConfirmModal(false);
                }}
                className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handlePreSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Card de Aviso sobre Esquecimento de Senha */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold block">Esqueceu a senha de acesso?</span>
                  Basta digitar um novo PIN de 4 a 6 dígitos abaixo ou clicar em <strong>"Gerar PIN"</strong>. Ao salvar com confirmação, a nova senha entrará em vigor imediatamente.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do motoboy"
                  className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">WhatsApp / Telefone *</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(34) 99999-9999"
                    className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Status do Motoboy</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="available">🟢 Disponível</option>
                    <option value="in_transit">🔵 Em Rota / Na Rua</option>
                    <option value="offline">⚪ Offline / Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Veículo / Placa</label>
                <input
                  type="text"
                  value={editVehicle}
                  onChange={(e) => setEditVehicle(e.target.value)}
                  placeholder="Ex: Honda Fan 160 - Placa ABC-1234"
                  className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Chave Pix (Para repasses)</label>
                <input
                  type="text"
                  value={editPixKey}
                  onChange={(e) => setEditPixKey(e.target.value)}
                  placeholder="CPF, Telefone ou Chave Aleatória"
                  className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Destaque para o PIN / Senha de Acesso */}
              <div className="p-4 bg-orange-50/70 rounded-2xl border-2 border-orange-300 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-orange-950 flex items-center gap-1.5 uppercase tracking-wide">
                    <KeyRound className="w-4 h-4 text-orange-600" />
                    <span>PIN de Acesso (Senha do Motoboy) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPin}
                    className="text-xs font-bold text-orange-700 hover:text-orange-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-orange-200 shadow-sm cursor-pointer"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Gerar Novo PIN</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showEditPin ? 'text' : 'password'}
                    maxLength={6}
                    value={editPinCode}
                    onChange={(e) => setEditPinCode(e.target.value)}
                    placeholder="Ex: 1234"
                    className="w-full p-3 pr-12 bg-white border border-orange-300 rounded-xl text-center text-lg font-mono font-black tracking-widest text-orange-950 focus:ring-2 focus:ring-orange-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPin(!showEditPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    title={showEditPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  >
                    {showEditPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-[11px] text-orange-800">
                  PIN atual em edição: <strong>{editPinCode || 'Sem PIN'}</strong>. Use este valor para repassar ao motoboy.
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-orange-600/30 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CONFIRMAÇÃO PARA SALVAR ALTERAÇÃO / SENHA ================= */}
      {showEditConfirmModal && editingDriver && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border-2 border-orange-500 space-y-4">
            <div className="flex items-center gap-3 text-orange-600">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900">Confirmar Alterações?</h3>
                <p className="text-xs text-stone-500">Confirmação de segurança cadastral</p>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Você está prestes a atualizar os dados e redefinir a senha do motoboy. Confira os dados antes de prosseguir:
            </p>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Motoboy:</span>
                <span className="font-bold text-stone-900">{editName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Telefone:</span>
                <span className="font-bold text-stone-900">{editPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Veículo:</span>
                <span className="font-medium text-stone-700">{editVehicle || 'Não informado'}</span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between items-center bg-orange-100/60 p-2.5 rounded-xl">
                <span className="font-bold text-orange-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-orange-600" />
                  Nova Senha / PIN:
                </span>
                <span className="font-mono text-base font-black text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-300">
                  {editPinCode}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 italic">
              * Se o motoboy esqueceu a senha, certifique-se de informá-lo sobre o novo PIN acima para que ele consiga fazer login.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditConfirmModal(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Voltar e Revisar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmSaveEdit}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Sim, Confirmar e Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ================= */}
      {driverToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">Excluir Motoboy?</h3>
                <p className="text-xs text-stone-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Deseja realmente remover o motoboy <strong>{driverToDelete.name}</strong>? Ele não poderá mais aceitar pedidos nem acessar o portal.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDriverToDelete(null)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDeleteDriver}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
