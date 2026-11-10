import React, { useState } from 'react';
import { X, ShieldCheck, Download, Upload, Trash2, RotateCcw, Plus, Clock, Sparkles, Database, HardDrive, ShoppingBag, Users, UtensilsCrossed } from 'lucide-react';

interface TotemBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  backups: any[];
  onRefreshBackups: () => Promise<void>;
  onCreateBackup: (name?: string) => Promise<void>;
  onRestoreBackup: (backupId?: string, customBackup?: any) => Promise<void>;
  onDownloadBackup: (backup: any) => void;
  onUploadBackupFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteBackup: (backupId: string) => Promise<void>;
  onDownloadFullBackup: () => void;
  onUploadFullBackupFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isCreating: boolean;
  isRestoring: boolean;
  activeCategoriesCount: number;
  activeProductsCount: number;
  ordersCount: number;
  customersCount: number;
  tablesCount: number;
}

export const TotemBackupModal: React.FC<TotemBackupModalProps> = ({
  isOpen,
  onClose,
  backups,
  onCreateBackup,
  onRestoreBackup,
  onDownloadBackup,
  onUploadBackupFile,
  onDeleteBackup,
  onDownloadFullBackup,
  onUploadFullBackupFile,
  isCreating,
  isRestoring,
  activeCategoriesCount,
  activeProductsCount,
  ordersCount,
  customersCount,
  tablesCount,
}) => {
  const safeBackups = Array.isArray(backups) ? backups : [];
  const [activeTab, setActiveTab] = useState<'full' | 'hourly' | 'totem'>('full');
  const [backupNameInput, setBackupNameInput] = useState('');
  const [hourlyBackups, setHourlyBackups] = React.useState<any[]>([]);
  const [isLoadingHourly, setIsLoadingHourly] = React.useState(false);

  const fetchHourlyBackups = async () => {
    try {
      setIsLoadingHourly(true);
      const res = await fetch('/api/db/hourly-backups');
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        setHourlyBackups(data.backups);
      }
    } catch (err) {
      console.error('Erro ao buscar backups horários:', err);
    } finally {
      setIsLoadingHourly(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && activeTab === 'hourly') {
      fetchHourlyBackups();
    }
  }, [isOpen, activeTab]);

  const handleRestoreHourly = async (filename: string) => {
    if (!window.confirm(`Deseja realmente restaurar o sistema para o ponto de backup automático "${filename}"?\n\nIsso substituirá o estado atual pelos dados salvos nessa hora.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/db/hourly-backups/restore/${encodeURIComponent(filename)}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Backup horário restaurado com sucesso! A página será recarregada.');
        window.location.reload();
      } else {
        alert('Erro ao restaurar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err: any) {
      alert('Erro de conexão ao restaurar backup: ' + err.message);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Data não informada';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const handleSubmitNewBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateBackup(backupNameInput);
    setBackupNameInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-3xl w-full my-8 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-stone-900 p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20 shadow-inner">
              💾
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Central de Backup &amp; Restauração</span>
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Sistema 100% Protegido
                </span>
              </h3>
              <p className="text-xs text-blue-100/90 mt-0.5 font-medium">
                Faça backup e restaure dados completos do sistema (Vendas, Clientes, Mesas e Totem)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-stone-100 border-b border-stone-200 p-2 px-5 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('full')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'full'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup Completo</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('hourly'); fetchHourlyBackups(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'hourly'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Backups Automáticos (Hora em Hora)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('totem')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'totem'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
            }`}
          >
            <span>📱</span>
            <span>Totem ({safeBackups.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'full' ? (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Full System Status Banner */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-stone-50 border border-blue-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-stone-900 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-600" />
                      <span>O que o Backup Completo salva?</span>
                    </h4>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      Diferente do backup exclusivo do Totem, este arquivo armazena <strong>absolutamente tudo</strong>: configurações da loja, horários, categorias, produtos, histórico de vendas e pedidos, clientes cadastrados (leads), mesas e mídias da TV.
                    </p>
                  </div>
                </div>

                {/* System Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-blue-100">
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">Categorias & Produtos</span>
                    <span className="text-sm font-black text-blue-700">{activeCategoriesCount} cat / {activeProductsCount} prod</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">Vendas / Pedidos</span>
                    <span className="text-sm font-black text-emerald-700 flex items-center justify-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" /> {ordersCount}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">Clientes / Leads</span>
                    <span className="text-sm font-black text-purple-700 flex items-center justify-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {customersCount}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">Mesas & QR</span>
                    <span className="text-sm font-black text-amber-700 flex items-center justify-center gap-1">
                      <UtensilsCrossed className="w-3.5 h-3.5" /> {tablesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions for Full Backup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Download Full Backup */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                      <Download className="w-5 h-5" />
                    </div>
                    <h5 className="text-sm font-black text-stone-900">Baixar Backup Completo</h5>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Gera um arquivo <code>.json</code> contendo todo o estado atual do sistema para você guardar com segurança em seu computador ou nuvem.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDownloadFullBackup}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo .JSON Completo</span>
                  </button>
                </div>

                {/* Restore Full Backup */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h5 className="text-sm font-black text-stone-900">Restaurar Sistema Completo</h5>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Selecione um arquivo de backup completo pré-salvo para restaurar todas as configurações, vendas, clientes e cardápio instantaneamente.
                    </p>
                  </div>
                  <label className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer text-center">
                    <Upload className="w-4 h-4" />
                    <span>Selecionar e Restaurar .JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onUploadFullBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span>💡</span> Dica de Segurança em Produção:
                </p>
                <p className="leading-relaxed">
                  Recomendamos realizar o download do <strong>Backup Completo</strong> ao final de cada dia de expediente para garantir que seu histórico de vendas e cadastros permaneça totalmente seguro contra qualquer imprevisto de hardware.
                </p>
              </div>
            </div>
          ) : activeTab === 'hourly' ? (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-stone-900">Sistema de Backup Automático de Hora em Hora</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    O servidor salva automaticamente uma cópia completa de todo o sistema (vendas, clientes, cardápio e configurações) a cada 60 minutos. Os últimos 72 backups (3 dias) são mantidos em rotação automática.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black uppercase tracking-wider text-stone-600">
                  Backups Automáticos Disponíveis ({hourlyBackups.length})
                </h5>
                <button
                  type="button"
                  onClick={fetchHourlyBackups}
                  disabled={isLoadingHourly}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Clock className={`w-3.5 h-3.5 ${isLoadingHourly ? 'animate-spin' : ''}`} />
                  <span>Atualizar Lista</span>
                </button>
              </div>

              {isLoadingHourly ? (
                <div className="py-12 text-center text-xs text-stone-500">Carregando backups automáticos...</div>
              ) : hourlyBackups.length === 0 ? (
                <div className="py-12 text-center bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-6 text-stone-500 text-xs">
                  Nenhum backup automático gerado ainda. O primeiro backup será gerado automaticamente nos primeiros minutos de funcionamento do servidor.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {hourlyBackups.map((b) => (
                    <div key={b.filename} className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-300 transition-all shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h6 className="text-sm font-black text-stone-900 font-mono">{b.filename}</h6>
                          <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {b.sizeKb} KB
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1">
                          Criado em: <strong className="text-stone-700">{formatDate(b.createdAt)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/db/hourly-backups/download/${encodeURIComponent(b.filename)}`}
                          download={b.filename}
                          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                          title="Baixar arquivo JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRestoreHourly(b.filename)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Restaurar este backup horário"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Current Totem Status Bar */}
              <div className="bg-blue-50/90 border border-blue-100 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Estado Atual do Cardápio do Totem:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                    <span>📱</span> {activeCategoriesCount} Categorias
                  </span>
                  <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                    <span>🏷️</span> {activeProductsCount} Produtos
                  </span>
                </div>
              </div>

              {/* Section 1: Create New Backup */}
              <form onSubmit={handleSubmitNewBackup} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-600" />
                    Criar Ponto de Restauração do Totem
                  </h4>
                  <label className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-100/80 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors border border-blue-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importar Totem (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onUploadBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Nome do backup (ex: Cardápio Fim de Semana)..."
                    value={backupNameInput}
                    onChange={(e) => setBackupNameInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isCreating ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Salvar Backup Totem
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Section 2: Backup History */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center justify-between">
                  <span>Histórico de Backups do Totem ({safeBackups.length})</span>
                  <span className="text-[10px] font-normal text-stone-400 capitalize">Ordenados do mais recente ao mais antigo</span>
                </h4>

                {safeBackups.length === 0 ? (
                  <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center mx-auto text-xl">
                      📂
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-700">Nenhum backup do Totem encontrado</p>
                      <p className="text-xs text-stone-500 mt-0.5">Clique no botão acima para criar o seu primeiro ponto de restauração do Totem.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCreateBackup('Backup Padrão Inicial')}
                      disabled={isCreating}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Criar Primeiro Backup
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {safeBackups.map((b) => (
                      <div
                        key={b.id}
                        className="bg-white border border-stone-200 hover:border-blue-300 rounded-2xl p-4 transition-all shadow-xs space-y-2 group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h5 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                              <span className="text-blue-600">📦</span>
                              <span>{b.name}</span>
                            </h5>
                            <p className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1.5 font-medium">
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>Salvo em: {formatDate(b.createdAt)}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onRestoreBackup(b.id)}
                              disabled={isRestoring}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {isRestoring ? (
                                <Clock className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              <span>Restaurar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDownloadBackup(b)}
                              className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer"
                              title="Baixar arquivo (.json)"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteBackup(b.id)}
                              className="p-2 bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                              title="Excluir backup"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1 border-t border-stone-100 text-[11px] font-semibold text-stone-600">
                          <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                            <span>📱</span> {b.activeCategoriesCount ?? (b.categories?.filter((c: any) => c.availableForKiosk).length || 0)} Categorias ativas
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                            <span>🏷️</span> {b.activeProductsCount ?? (b.products?.filter((p: any) => p.availableForKiosk).length || 0)} Produtos ativos
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-stone-500 font-medium">
            🔒 Todos os dados são salvos com segurança no servidor e em disco duplo.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
