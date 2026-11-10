import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, DollarSign, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface DeliveryZone {
  id: string;
  neighborhood: string;
  cepStart: string;
  cepEnd: string;
  fee: number;
  isActive: boolean;
}

export const DeliveryZonesTab: React.FC = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [neighborhood, setNeighborhood] = useState('');
  const [cepStart, setCepStart] = useState('');
  const [cepEnd, setCepEnd] = useState('');
  const [fee, setFee] = useState('5.00');
  const [loading, setLoading] = useState(false);

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/db/delivery-zones');
      if (res.ok) setZones(await res.json());
    } catch (e) {
      console.error('Erro ao buscar zonas de entrega:', e);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neighborhood.trim() || !cepStart.trim() || !cepEnd.trim()) {
      alert('Preencha o nome do bairro, CEP inicial e CEP final.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/db/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `zone_${Date.now()}`,
          neighborhood: neighborhood.trim(),
          cepStart: cepStart.trim(),
          cepEnd: cepEnd.trim(),
          fee: parseFloat(fee) || 0,
          isActive: true,
          createdAt: Date.now()
        })
      });
      if (res.ok) {
        setNeighborhood('');
        setCepStart('');
        setCepEnd('');
        setFee('5.00');
        await fetchZones();
        alert('Faixa de CEP e Bairro cadastrados com sucesso!');
      } else {
        alert('Erro ao salvar zona de entrega.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Deseja realmente remover esta zona de entrega?')) return;
    try {
      const res = await fetch(`/api/db/delivery-zones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchZones();
      }
    } catch (e) {
      alert('Erro ao excluir zona.');
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-orange-600" />
            <span>Faixas de CEP & Taxas de Entrega</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Cadastre as faixas de CEP (Inicial e Final) atendidas e o valor da taxa para cada região.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cadastro de Faixa de CEP */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 space-y-5">
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-600" />
            <span>Adicionar Faixa de CEP</span>
          </h2>

          <form onSubmit={handleAddZone} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Nome do Bairro *</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">CEP Inicial *</label>
              <input
                type="text"
                value={cepStart}
                onChange={(e) => setCepStart(e.target.value)}
                placeholder="38010-000"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">CEP Final *</label>
              <input
                type="text"
                value={cepEnd}
                onChange={(e) => setCepEnd(e.target.value)}
                placeholder="38019-999"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Taxa de Entrega (R$) *</label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="5.00"
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl font-black text-sm transition-all shadow-md shadow-orange-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Salvar Faixa de CEP</span>
            </button>
          </form>
        </div>

        {/* Lista de Faixas Cadastradas */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-stone-200 space-y-4">
          <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <span>Faixas de CEP Atendidas ({zones.length})</span>
          </h2>

          {zones.length === 0 ? (
            <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30 text-stone-400" />
              <p className="font-bold text-stone-700 text-sm">Nenhuma faixa de CEP cadastrada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map(z => (
                <div key={z.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-black text-stone-900 text-base">{z.neighborhood}</div>
                    <div className="text-xs text-stone-500 font-mono">
                      Faixa: {z.cepStart} até {z.cepEnd}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-black text-emerald-600 text-base">{formatCurrency(z.fee)}</span>
                    <button
                      onClick={() => handleDeleteZone(z.id)}
                      className="p-2 text-stone-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
