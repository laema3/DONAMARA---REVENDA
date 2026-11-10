import React, { useState } from 'react';
import { 
  Settings, 
  Bell, 
  Printer, 
  Palette, 
  Store, 
  Wrench, 
  Calendar, 
  Bot, 
  RefreshCw, 
  MonitorSmartphone, 
  ChevronDown, 
  CheckCircle, 
  Save, 
  Copy, 
  Clock, 
  Sparkles, 
  MessageCircle, 
  Eye, 
  EyeOff, 
  ChevronsUpDown,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  HelpCircle,
  Lightbulb,
  Sliders,
  ShieldAlert,
  FileText,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Download,
  Upload,
  Database,
  Server,
  Network,
  Globe,
  Wifi,
  Check,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { StoreInfo, AiTrainingExample, DEFAULT_AI_TRAINING_EXAMPLES } from '../store/useStore';
import { DaySchedule, formatWeeklyScheduleSummary, getStoreCurrentStatus } from '../utils/scheduleHelper';
import { sendNtfyNotification } from '../utils/ntfy';
import { AiAssistantModal } from './AiAssistantModal';
import { 
  printReceipt, 
  createSampleOrder, 
  getActiveOrderPrinter, 
  downloadChromeKioskShortcut, 
  setLocalCaixaPrinter, 
  getLocalCaixaPrinter,
  testNetworkPrinterIp,
  downloadWindowsNetworkPrinterScript,
  setNetworkPrinterConfig
} from '../utils/printer';

interface AdminSettingsCollapsibleProps {
  storeInfo: StoreInfo;
  isMaster: boolean;
  
  // Visual & Logo
  logoPreview: string;
  setLogoPreview: React.Dispatch<React.SetStateAction<string>>;
  isSavingLogo: boolean;
  logoSavedSuccess: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => void;
  handleDirectSaveLogo: () => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  addButtonColor: string;
  setAddButtonColor: (color: string) => void;
  showSystemIntroButtonState?: boolean;
  setShowSystemIntroButtonState?: (v: boolean) => void;
  handleToggleShowSystemIntroButton?: (v: boolean) => void;
  
  // Channels
  isOpenState: boolean;
  setIsOpenState: (v: boolean) => void;
  forceOpenState?: boolean;
  setForceOpenState?: (v: boolean) => void;
  handleSetOperationMode?: (mode: 'auto' | 'open' | 'closed') => void;
  inStoreEnabledState: boolean;
  setInStoreEnabledState: (v: boolean) => void;
  deliveryEnabledState: boolean;
  setDeliveryEnabledState: (v: boolean) => void;
  kioskEnabledState: boolean;
  setKioskEnabledState: (v: boolean) => void;
  requireQrCodeForOrderingState?: boolean;
  setRequireQrCodeForOrderingState?: (v: boolean) => void;
  deliveryScheduleEnabledState: boolean;
  setDeliveryScheduleEnabledState: (v: boolean) => void;
  deliveryScheduleSlotsState: string[];
  setDeliveryScheduleSlotsState: React.Dispatch<React.SetStateAction<string[]>>;
  scheduleSlotItemCapacityState?: number;
  setScheduleSlotItemCapacityState?: (v: number) => void;
  schedulePrepTimeNormalMinutesState?: number;
  setSchedulePrepTimeNormalMinutesState?: (v: number) => void;
  schedulePrepTimeFrozenMinutesState?: number;
  setSchedulePrepTimeFrozenMinutesState?: (v: number) => void;
  
  // Maintenance
  isMaintenanceState: boolean;
  setIsMaintenanceState: (v: boolean) => void;

  // Schedule
  weeklyScheduleState: DaySchedule[];
  setWeeklyScheduleState: React.Dispatch<React.SetStateAction<DaySchedule[]>>;
  handleDayScheduleChange: (dayOfWeek: number, field: keyof DaySchedule, value: any) => void;
  handleCopyWeekdayHours: (sourceDayOfWeek?: number) => void;
  handleResetScheduleHours: () => void;
  autoOpenCloseState: boolean;
  setAutoOpenCloseState: (v: boolean) => void;
  closedMessageState: string;
  setClosedMessageState: (v: string) => void;

  // AI Agent
  aiAgentEnabledState: boolean;
  setAiAgentEnabledState: (v: boolean) => void;
  aiAgentNameState: string;
  setAiAgentNameState: (v: string) => void;
  aiAgentToneState: string;
  setAiAgentToneState: (v: string) => void;
  aiAgentCustomPromptState: string;
  setAiAgentCustomPromptState: (v: string) => void;
  aiAgentWhatsAppPhoneState: string;
  setAiAgentWhatsAppPhoneState: (v: string) => void;
  aiAgentWhatsAppDefaultMessageState: string;
  setAiAgentWhatsAppDefaultMessageState: (v: string) => void;
  aiAgentTrainingExamplesState: AiTrainingExample[];
  setAiAgentTrainingExamplesState: React.Dispatch<React.SetStateAction<AiTrainingExample[]>>;
  aiAgentKnowledgeBaseState: string;
  setAiAgentKnowledgeBaseState: (v: string) => void;
  aiAgentForbiddenPhrasesState: string;
  setAiAgentForbiddenPhrasesState: (v: string) => void;
  aiAgentCreativityState: number;
  setAiAgentCreativityState: (v: number) => void;
  aiAgentAntiRepeatState: boolean;
  setAiAgentAntiRepeatState: (v: boolean) => void;
  isAiTestModalOpen: boolean;
  setIsAiTestModalOpen: (v: boolean) => void;

  // BlueFocus
  blueFocusConfig: any;
  setBlueFocusConfig: React.Dispatch<React.SetStateAction<any>>;
  handleSyncBlueFocus: (override?: any) => Promise<void>;
  handleSyncCustomersBlueFocus?: (override?: any) => Promise<void>;
  handleTestBlueFocus: () => Promise<void>;
  isTestingBlueFocus: boolean;
  isSyncing: boolean;
  isAutoSyncEnabled: boolean;
  setIsAutoSyncEnabled: (v: boolean) => void;

  // Connection
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
  setConnectionStatus: (v: 'idle' | 'testing' | 'success' | 'error') => void;
  connectionErrorMessage: string;
  setConnectionErrorMessage: (v: string) => void;

  // Printers
  configuredPrintersState: any[];
  printerCutModeState?: 'partial' | 'full' | 'none';
  setPrinterCutModeState?: (v: 'partial' | 'full' | 'none') => void;
  printerCopiesState?: number;
  setPrinterCopiesState?: (v: number) => void;
  handleAddPrinter: (name: string, model?: string) => void;
  handleToggleOrderPrinter: (id: string) => void;
  handleDeletePrinter: (id: string) => void;
  handleDirectSavePrinters: () => Promise<void>;
  preferredPrinterNameState: string;
  setPreferredPrinterNameState: (v: string) => void;
  caixaPrinterNameState?: string;
  setCaixaPrinterNameState?: (v: string) => void;
  autoPrintOrdersOnCaixaState?: boolean;
  setAutoPrintOrdersOnCaixaState?: (v: boolean) => void;
  printerConnectionTypeState?: 'network' | 'windows' | 'usb';
  setPrinterConnectionTypeState?: (v: 'network' | 'windows' | 'usb') => void;
  networkPrinterIpState?: string;
  setNetworkPrinterIpState?: (v: string) => void;
  networkPrinterPortState?: number;
  setNetworkPrinterPortState?: (v: number) => void;

  // Mercado Pago & Pagamentos Online
  mercadoPagoEnabledState: boolean;
  setMercadoPagoEnabledState: (v: boolean) => void;
  mercadoPagoAccessTokenState: string;
  setMercadoPagoAccessTokenState: (v: string) => void;
  mercadoPagoPublicKeyState: string;
  setMercadoPagoPublicKeyState: (v: string) => void;
  mercadoPagoPixKeyState: string;
  setMercadoPagoPixKeyState: (v: string) => void;
  
  onlinePaymentEnabledState: boolean;
  setOnlinePaymentEnabledState: (v: boolean) => void;
  onlinePaymentOperatorState: 'mercadopago' | 'stripe' | 'pagseguro';
  setOnlinePaymentOperatorState: (v: 'mercadopago' | 'stripe' | 'pagseguro') => void;
  onlinePaymentPublicKeyState: string;
  setOnlinePaymentPublicKeyState: (v: string) => void;
  onlinePaymentSecretKeyState: string;
  setOnlinePaymentSecretKeyState: (v: string) => void;
  
  // Estimativas de Entrega
  deliveryEstimatedTimeMinState: number;
  setDeliveryEstimatedTimeMinState: (v: number) => void;
  deliveryEstimatedTimeMaxState: number;
  setDeliveryEstimatedTimeMaxState: (v: number) => void;

  // Submit
  handleSaveSettings: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function AdminSettingsCollapsible(props: AdminSettingsCollapsibleProps) {
  const {
    storeInfo,
    isMaster,
    logoPreview,
    setLogoPreview,
    isSavingLogo,
    logoSavedSuccess,
    handleImageUpload,
    handleDirectSaveLogo,
    themeColor,
    setThemeColor,
    addButtonColor,
    setAddButtonColor,
    showSystemIntroButtonState = true,
    handleToggleShowSystemIntroButton,
    isOpenState,
    setIsOpenState,
    forceOpenState = false,
    setForceOpenState,
    handleSetOperationMode,
    inStoreEnabledState,
    setInStoreEnabledState,
    deliveryEnabledState,
    setDeliveryEnabledState,
    kioskEnabledState,
    setKioskEnabledState,
    requireQrCodeForOrderingState = true,
    setRequireQrCodeForOrderingState,
    deliveryScheduleEnabledState,
    setDeliveryScheduleEnabledState,
    deliveryScheduleSlotsState,
    setDeliveryScheduleSlotsState,
    scheduleSlotItemCapacityState = 100,
    setScheduleSlotItemCapacityState,
    schedulePrepTimeNormalMinutesState = 40,
    setSchedulePrepTimeNormalMinutesState,
    schedulePrepTimeFrozenMinutesState = 90,
    setSchedulePrepTimeFrozenMinutesState,
    isMaintenanceState,
    setIsMaintenanceState,
    weeklyScheduleState,
    handleDayScheduleChange,
    handleCopyWeekdayHours,
    handleResetScheduleHours,
    autoOpenCloseState,
    setAutoOpenCloseState,
    closedMessageState,
    setClosedMessageState,
    aiAgentEnabledState,
    setAiAgentEnabledState,
    aiAgentNameState,
    setAiAgentNameState,
    aiAgentToneState,
    setAiAgentToneState,
    aiAgentCustomPromptState,
    setAiAgentCustomPromptState,
    aiAgentWhatsAppPhoneState,
    setAiAgentWhatsAppPhoneState,
    aiAgentWhatsAppDefaultMessageState,
    setAiAgentWhatsAppDefaultMessageState,
    aiAgentTrainingExamplesState,
    setAiAgentTrainingExamplesState,
    aiAgentKnowledgeBaseState,
    setAiAgentKnowledgeBaseState,
    aiAgentForbiddenPhrasesState,
    setAiAgentForbiddenPhrasesState,
    aiAgentCreativityState,
    setAiAgentCreativityState,
    aiAgentAntiRepeatState,
    setAiAgentAntiRepeatState,
    isAiTestModalOpen,
    setIsAiTestModalOpen,
    blueFocusConfig,
    setBlueFocusConfig,
    handleSyncBlueFocus,
    handleSyncCustomersBlueFocus,
    handleTestBlueFocus,
    isTestingBlueFocus,
    isSyncing,
    isAutoSyncEnabled,
    setIsAutoSyncEnabled,
    connectionStatus,
    setConnectionStatus,
    connectionErrorMessage,
    setConnectionErrorMessage,
    configuredPrintersState,
    printerCutModeState = 'partial',
    setPrinterCutModeState,
    printerCopiesState = 2,
    setPrinterCopiesState,
    handleAddPrinter,
    handleToggleOrderPrinter,
    handleDeletePrinter,
    handleDirectSavePrinters,
    preferredPrinterNameState,
    setPreferredPrinterNameState,
    caixaPrinterNameState = 'Elgin i9 (Balcão / Caixa)',
    setCaixaPrinterNameState,
    autoPrintOrdersOnCaixaState = false,
    setAutoPrintOrdersOnCaixaState,
    printerConnectionTypeState = 'network',
    setPrinterConnectionTypeState,
    networkPrinterIpState = '192.168.0.90',
    setNetworkPrinterIpState,
    networkPrinterPortState = 9100,
    setNetworkPrinterPortState,
    mercadoPagoEnabledState,
    setMercadoPagoEnabledState,
    mercadoPagoAccessTokenState,
    setMercadoPagoAccessTokenState,
    mercadoPagoPublicKeyState,
    setMercadoPagoPublicKeyState,
    mercadoPagoPixKeyState,
    setMercadoPagoPixKeyState,
    onlinePaymentEnabledState,
    setOnlinePaymentEnabledState,
    onlinePaymentOperatorState,
    setOnlinePaymentOperatorState,
    onlinePaymentPublicKeyState,
    setOnlinePaymentPublicKeyState,
    onlinePaymentSecretKeyState,
    setOnlinePaymentSecretKeyState,
    deliveryEstimatedTimeMinState,
    setDeliveryEstimatedTimeMinState,
    deliveryEstimatedTimeMaxState,
    setDeliveryEstimatedTimeMaxState,
    handleSaveSettings
  } = props;

  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterModel, setNewPrinterModel] = useState('Térmica 80mm');
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [isTestingNetIp, setIsTestingNetIp] = useState(false);
  const [netIpTestFeedback, setNetIpTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [showBlueFocusToken, setShowBlueFocusToken] = useState(false);
  const [showMpToken, setShowMpToken] = useState(false);
  const [blueFocusSaveFeedback, setBlueFocusSaveFeedback] = useState<string | null>(null);


  const handleSaveBlueFocusConfig = () => {
    const cfg = {
      empresaId: blueFocusConfig.empresaId || 'DONAMARA',
      usuarioId: blueFocusConfig.usuarioId || 'CONSULTA',
      pdvCodigo: blueFocusConfig.pdvCodigo || '1000',
      pessoaId: blueFocusConfig.pessoaId || '0',
      syncUrl: blueFocusConfig.syncUrl || '',
      orderUrl: blueFocusConfig.orderUrl || '',
      tipoAtualizacao: blueFocusConfig.tipoAtualizacao || 'A',
      tipo: blueFocusConfig.tipo || '4',
      dataInicial: blueFocusConfig.dataInicial || '30/12/1899',
      startCargaNumero: String(blueFocusConfig.startCargaNumero || '0'),
      startCargaSequencia: String(blueFocusConfig.startCargaSequencia || '0'),
      startProdutoId: String(blueFocusConfig.startProdutoId || '0'),
      authToken: blueFocusConfig.authToken || '',
      batchSize: String(blueFocusConfig.batchSize || '4')
    };

    localStorage.setItem('bluefocus_empresa_id', cfg.empresaId);
    localStorage.setItem('bluefocus_usuario_id', cfg.usuarioId);
    localStorage.setItem('bluefocus_pdv_codigo', cfg.pdvCodigo);
    localStorage.setItem('bluefocus_pessoa_id', cfg.pessoaId);
    localStorage.setItem('bluefocus_sync_url', cfg.syncUrl);
    localStorage.setItem('bluefocus_order_url', cfg.orderUrl);
    localStorage.setItem('bluefocus_tipo_atualizacao', cfg.tipoAtualizacao);
    localStorage.setItem('bluefocus_tipo', cfg.tipo);
    localStorage.setItem('bluefocus_data_inicial', cfg.dataInicial);
    localStorage.setItem('bluefocus_start_carga_numero', cfg.startCargaNumero);
    localStorage.setItem('bluefocus_start_carga_sequencia', cfg.startCargaSequencia);
    localStorage.setItem('bluefocus_start_produto_id', cfg.startProdutoId);
    localStorage.setItem('bluefocus_auth_token', cfg.authToken);
    localStorage.setItem('bluefocus_batch_size', cfg.batchSize);

    setBlueFocusConfig((prev: any) => ({ ...prev, ...cfg }));
    setBlueFocusSaveFeedback('Configurações da integração BlueFocus salvas com sucesso!');
    setTimeout(() => setBlueFocusSaveFeedback(null), 3500);
  };

  const activePrinter = getActiveOrderPrinter(storeInfo);

  const handleTestPrintWindows = async () => {
    setIsTestingPrint(true);
    try {
      const sample = createSampleOrder(storeInfo);
      await printReceipt(sample, storeInfo);
    } catch (err) {
      console.error('Erro ao testar impressão no Windows:', err);
    } finally {
      setIsTestingPrint(false);
    }
  };

  const backupInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backupStatusMsg, setBackupStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    setBackupStatusMsg(null);
    try {
      const res = await fetch('/api/db/backup');
      if (!res.ok) throw new Error('Falha ao exportar backup');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donamara_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBackupStatusMsg({ type: 'success', text: 'Backup exportado com sucesso! Guarde este arquivo em seu computador.' });
    } catch (e: any) {
      setBackupStatusMsg({ type: 'error', text: e.message || 'Erro ao baixar backup.' });
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoringBackup(true);
    setBackupStatusMsg(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/db/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao restaurar');
      setBackupStatusMsg({ 
        type: 'success', 
        text: `Backup restaurado com sucesso! Recarregando sistema...` 
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setBackupStatusMsg({ type: 'error', text: 'Erro ao restaurar: ' + (e.message || 'Arquivo JSON inválido.') });
    } finally {
      setIsRestoringBackup(false);
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  // AI Training Helpers
  const handleAddTrainingExample = () => {
    const newEx: AiTrainingExample = {
      id: `train_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      question: '',
      answer: '',
      active: true,
    };
    setAiAgentTrainingExamplesState((prev) => [newEx, ...(Array.isArray(prev) ? prev : [])]);
  };

  const handleUpdateTrainingExample = (id: string, field: keyof AiTrainingExample, value: any) => {
    setAiAgentTrainingExamplesState((prev) =>
      (Array.isArray(prev) ? prev : []).map((ex) =>
        ex.id === id ? { ...ex, [field]: value } : ex
      )
    );
  };

  const handleDeleteTrainingExample = (id: string) => {
    setAiAgentTrainingExamplesState((prev) =>
      (Array.isArray(prev) ? prev : []).filter((ex) => ex.id !== id)
    );
  };

  const handleResetTrainingExamples = () => {
    setAiAgentTrainingExamplesState(DEFAULT_AI_TRAINING_EXAMPLES);
  };

  // Section open/closed state (all collapsed by default as requested)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: false,
    notifications: false,
    printer: true,
    visual: false,
    channels: false,
    maintenance: false,
    schedule: false,
    ai_agent: false,
    bluefocus: false,
    database: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleExpandAll = () => {
    setOpenSections({
      general: true,
      notifications: true,
      printer: true,
      visual: true,
      channels: true,
      maintenance: true,
      schedule: true,
      ai_agent: true,
      bluefocus: true,
      database: true,
    });
  };

  const handleCollapseAll = () => {
    setOpenSections({
      general: false,
      notifications: false,
      printer: false,
      visual: false,
      channels: false,
      maintenance: false,
      schedule: false,
      ai_agent: false,
      bluefocus: false,
      database: false,
    });
  };

  const currentStoreStatus = getStoreCurrentStatus(weeklyScheduleState, isOpenState, autoOpenCloseState);
  const openCount = Object.values(openSections).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header & Global Expand/Collapse Buttons */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-orange-600" />
            Painel de Controle & Configurações
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Clique em qualquer opção abaixo para abrir ou fechar seus ajustes.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={openCount === 0 ? handleExpandAll : handleCollapseAll}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ChevronsUpDown className="w-4 h-4" />
            <span>{openCount === 0 ? 'Expandir Todas' : 'Recolher Todas'}</span>
          </button>
        </div>
      </div>

      {/* CARD DE DESTAQUE: Botão Flutuante Conhecer o Sistema */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 rounded-2xl p-4 sm:p-5 border-2 border-amber-400 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-6 h-6 text-yellow-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-black text-stone-900">
                Botão Flutuante: "CLIQUE PARA CONHECER ESSE SISTEMA"
              </span>
              <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                showSystemIntroButtonState 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-stone-300 text-stone-700'
              }`}>
                {showSystemIntroButtonState ? '🟢 Ativado (Visível no Cardápio)' : '⚪ Desativado (Oculto)'}
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Exibe um botão flutuante dourado no canto inferior do cardápio público para os clientes conhecerem o sistema e abrirem o WhatsApp direto (34-9-9632-0500).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <label className="relative cursor-pointer flex items-center gap-3 bg-white/90 px-3.5 py-2 rounded-xl border border-amber-300 shadow-xs hover:bg-white transition-all">
            <span className="text-xs font-black text-stone-800">
              {showSystemIntroButtonState ? 'LIGADO' : 'DESLIGADO'}
            </span>
            <input 
              type="checkbox" 
              name="showSystemIntroButton" 
              checked={showSystemIntroButtonState}
              onChange={(e) => handleToggleShowSystemIntroButton?.(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-3.5">
        {/* 1. Informações Gerais */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('general')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Informações Gerais</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {storeInfo.name || 'DONAMARA - REVENDA'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Nome da loja, frase de destaque, WhatsApp, Instagram, endereço e horários
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.general ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.general ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.general ? 'block' : 'hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Nome da Loja</label>
                <input type="text" name="name" defaultValue={storeInfo.name} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Frase de Destaque (Hero)</label>
                <input type="text" name="headerPhrase" defaultValue={storeInfo.headerPhrase} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">WhatsApp</label>
                <input type="text" name="whatsapp" defaultValue={storeInfo.whatsapp} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Instagram</label>
                <input type="text" name="instagram" defaultValue={storeInfo.instagram} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Endereço Completo</label>
                <input type="text" name="address" defaultValue={storeInfo.address} required className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Horário de Funcionamento (Texto)</label>
                <textarea name="hours" defaultValue={storeInfo.hours} required rows={2} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Notificações Push (NTFY) / Notícias */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('notifications')}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-800">Notificações Push (NTFY)</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                      ntfy.sh/{storeInfo.ntfyTopic || 'donamara_pedidos'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Alertas instantâneos no seu celular e navegador para novos cadastros e pedidos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                  {openSections.notifications ? 'Recolher' : 'Expandir'}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.notifications ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>

            <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.notifications ? 'block' : 'hidden'}`}>
              <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                Receba alertas sonoros e visuais no seu celular (App NTFY no Android/iOS ou pelo navegador) quando novos clientes fizerem cadastro e quando novos pedidos chegarem.
              </p>
              
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-200">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-stone-800 block">Status das Notificações PUSH</span>
                    <span className="text-[11px] text-stone-500">Ative para receber alertas no celular ou desative temporariamente para fazer testes sem notificações.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      name="ntfyEnabled" 
                      defaultChecked={storeInfo.ntfyEnabled !== false} 
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">Tópico / Canal do NTFY</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-3 text-stone-400 font-mono text-xs">ntfy.sh/</span>
                      <input 
                        type="text" 
                        name="ntfyTopic" 
                        id="ntfyTopicInput"
                        defaultValue={storeInfo.ntfyTopic || 'donamara_pedidos'} 
                        required 
                        className="w-full p-2.5 pl-18 border rounded-xl font-mono text-xs bg-white focus:ring-2 focus:ring-orange-500 outline-none" 
                        placeholder="donamara_pedidos"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const input = document.getElementById('ntfyTopicInput') as HTMLInputElement;
                        const topic = input?.value?.trim() || storeInfo.ntfyTopic || 'donamara_pedidos';
                        const ok = await sendNtfyNotification({
                          topic,
                          title: '🥟 Teste de Notificação DONAMARA',
                          message: 'Seu canal do NTFY está funcionando perfeitamente!',
                          priority: 4,
                          tags: ['tada', 'dumpling', 'white_check_mark']
                        });
                        if (ok) {
                          alert(`✅ Notificação de teste enviada com sucesso para https://ntfy.sh/${topic}!`);
                        } else {
                          alert(`⚠️ Falha ao enviar notificação de teste para https://ntfy.sh/${topic}. Verifique sua conexão.`);
                        }
                      }}
                      className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                    >
                      <Bell className="w-4 h-4" />
                      Enviar Notificação Teste
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2">
                    💡 <strong>Como receber no celular:</strong> Instale o app <strong>ntfy</strong> (grátis na Play Store / App Store), clique em <strong>+ (Inscrever-se)</strong> e digite exatamente o nome do tópico acima (ex: <code>{storeInfo.ntfyTopic || 'donamara_pedidos'}</code>). Ou acesse direto pelo navegador em <a href={`https://ntfy.sh/${storeInfo.ntfyTopic || 'donamara_pedidos'}`} target="_blank" rel="noreferrer" className="text-orange-600 underline font-semibold">ntfy.sh/{storeInfo.ntfyTopic || 'donamara_pedidos'}</a>.
                  </p>
                </div>
              </div>
            </div>
          </div>

        {/* 3. Impressora Térmica */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('printer')}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-800">Impressora de Cupom & Balcão</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Térmica 80mm / 58mm
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Impressão direta de pedidos para caixa e produção sem necessidade de IP
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                  {openSections.printer ? 'Recolher' : 'Expandir'}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.printer ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>

            <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.printer ? 'block' : 'hidden'}`}>
              <div className="space-y-4">
                {/* Seletor de Modo: Impressora de Rede por IP vs Driver Local */}
                <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50/50 p-4 rounded-2xl border-2 border-orange-300 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Network className="w-5 h-5 text-orange-600" />
                        <h4 className="text-sm font-black text-stone-900">
                          Modo da Impressora Padrão do Site
                        </h4>
                        <span className="bg-orange-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                          Recomendado
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Defina a impressora pelo <strong>Endereço IP na rede</strong> para garantir que os pedidos do site sejam impressos sempre na impressora certa, sem risco de confusão com outras impressoras instaladas.
                      </p>
                    </div>

                    {/* Botões de Alternância de Modo */}
                    <div className="flex items-center bg-stone-200/80 p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setPrinterConnectionTypeState?.('network')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          printerConnectionTypeState === 'network'
                            ? 'bg-white text-orange-700 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Network className="w-3.5 h-3.5" />
                        <span>Rede por IP (TCP/IP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrinterConnectionTypeState?.('windows')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          printerConnectionTypeState === 'windows'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Driver Windows / USB</span>
                      </button>
                    </div>
                  </div>

                  {/* Configuração Específica do Modo Rede por IP */}
                  {printerConnectionTypeState === 'network' && (
                    <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-2xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-orange-600" />
                            <span>Endereço IP da Impressora na Rede Local:</span>
                          </label>
                          <input
                            type="text"
                            value={networkPrinterIpState}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNetworkPrinterIpState?.(val);
                              setNetworkPrinterConfig(val, networkPrinterPortState || 9100);
                            }}
                            placeholder="Ex: 192.168.0.90 ou 192.168.0.150"
                            className="w-full font-mono font-bold text-sm bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          />
                          <span className="text-[11px] text-stone-500 mt-1 block">
                            IP fixado na impressora de cupom (cabo de rede RJ45 ou Wi-Fi conectada no mesmo roteador).
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                            <span>Porta TCP (Padrão 9100):</span>
                          </label>
                          <input
                            type="number"
                            value={networkPrinterPortState}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 9100;
                              setNetworkPrinterPortState?.(val);
                              setNetworkPrinterConfig(networkPrinterIpState || '192.168.0.90', val);
                            }}
                            placeholder="9100"
                            className="w-full font-mono font-bold text-sm bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          />
                          <span className="text-[11px] text-stone-500 mt-1 block">
                            Porta ESC/POS padrão universal.
                          </span>
                        </div>
                      </div>

                      {/* Feedback do Teste de IP */}
                      {netIpTestFeedback && (
                        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                          netIpTestFeedback.success 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-50 text-amber-800 border border-amber-300'
                        }`}>
                          {netIpTestFeedback.success ? (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span>{netIpTestFeedback.message}</span>
                        </div>
                      )}

                      {/* Ações de Teste e Download do Script */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsTestingNetIp(true);
                              setNetIpTestFeedback(null);
                              try {
                                const res = await testNetworkPrinterIp(
                                  networkPrinterIpState || '192.168.1.200', 
                                  networkPrinterPortState || 9100
                                );
                                setNetIpTestFeedback(res);
                              } catch (err: any) {
                                setNetIpTestFeedback({ success: false, message: err?.message || 'Falha ao testar conexão' });
                              } finally {
                                setIsTestingNetIp(false);
                              }
                            }}
                            disabled={isTestingNetIp || !networkPrinterIpState}
                            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Wifi className="w-3.5 h-3.5 text-orange-400" />
                            <span>{isTestingNetIp ? 'Testando Conexão...' : 'Testar Conexão com este IP'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              downloadWindowsNetworkPrinterScript(
                                networkPrinterIpState || '192.168.1.200',
                                caixaPrinterNameState || 'Impressora Cupom Rede'
                              );
                            }}
                            className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                            title="Gera um script rápido (.bat) para criar a porta de rede Standard TCP/IP no Windows automaticamente"
                          >
                            <Download className="w-3.5 h-3.5 text-orange-600" />
                            <span>Criar Porta TCP/IP no Windows (.bat)</span>
                          </button>
                        </div>

                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3" /> Padrão ativo: {networkPrinterIpState || '192.168.1.200'}:{networkPrinterPortState || 9100}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  Cadastre o nome da sua impressora térmica exatamente como ela aparece no seu <strong>Windows</strong> ou sistema. Marque o <strong>checkbox</strong> na impressora que será usada para imprimir os pedidos.
                </p>

                {/* Add New Printer Form */}
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
                  <label className="block text-xs font-bold text-stone-700">Cadastrar Nova Impressora:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <input
                        type="text"
                        value={newPrinterName}
                        onChange={(e) => setNewPrinterName(e.target.value)}
                        placeholder="Nome no Windows (ex: Elgin i9, EPSON TM-T20)"
                        className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg bg-white focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newPrinterModel}
                        onChange={(e) => setNewPrinterModel(e.target.value)}
                        placeholder="Local / Modelo (ex: Caixa, Balcão, Cozinha)"
                        className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg bg-white focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (newPrinterName.trim()) {
                          handleAddPrinter(newPrinterName, newPrinterModel);
                          setNewPrinterName('');
                          setNewPrinterModel('Térmica 80mm');
                        } else {
                          alert('Por favor, digite o nome da impressora no Windows.');
                        }
                      }}
                      className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Impressora
                    </button>
                  </div>
                </div>

                {/* Printers List */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-stone-700">Impressoras Cadastradas:</label>
                  {configuredPrintersState.length === 0 ? (
                    <div className="text-center py-4 bg-stone-50 rounded-xl border border-dashed border-stone-300 text-stone-500 text-xs">
                      Nenhuma impressora personalizada cadastrada ainda. Adicione o nome da sua impressora no campo acima.
                    </div>
                  ) : (
                    configuredPrintersState.map((printer) => (
                      <div 
                        key={printer.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          printer.isOrderPrinter 
                            ? 'bg-orange-50 border-orange-300 shadow-xs' 
                            : 'bg-white border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={printer.isOrderPrinter}
                            onChange={() => handleToggleOrderPrinter(printer.id)}
                            className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-2">
                              {printer.name}
                              {printer.isOrderPrinter && (
                                <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  Exclusiva para Pedidos
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 font-mono">{printer.model}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeletePrinter(printer.id)}
                            className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors text-xs font-bold cursor-pointer"
                            title="Remover Impressora"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Configuração de Picote / Guilhotina para Totem & Impressora Térmica */}
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Comando de Corte / Picote de Papel (Totem & Impressora Térmica)</span>
                      <span className="text-[11px] text-stone-500">Defina como a guilhotina da impressora térmica deve se comportar ao finalizar o cupom.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${printerCutModeState === 'partial' ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20' : 'bg-stone-50/80 border-stone-200 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="printerCutMode" 
                        value="partial"
                        checked={printerCutModeState === 'partial'}
                        onChange={() => setPrinterCutModeState?.('partial')}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">1 Picote Parcial</span>
                        <span className="text-[10px] text-stone-500 block leading-tight">Recomendado. Faz 1 picote com aba para destacar facilmente sem derrubar o cupom.</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${printerCutModeState === 'full' ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20' : 'bg-stone-50/80 border-stone-200 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="printerCutMode" 
                        value="full"
                        checked={printerCutModeState === 'full'}
                        onChange={() => setPrinterCutModeState?.('full')}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">1 Corte Total</span>
                        <span className="text-[10px] text-stone-500 block leading-tight">Aciona a lâmina 1 única vez cortando 100% da largura do papel.</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${printerCutModeState === 'none' ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20' : 'bg-stone-50/80 border-stone-200 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="printerCutMode" 
                        value="none"
                        checked={printerCutModeState === 'none'}
                        onChange={() => setPrinterCutModeState?.('none')}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">Sem Corte no Código</span>
                        <span className="text-[10px] text-stone-500 block leading-tight">Não envia comando de corte. Ideal caso sua impressora já tenha corte automático nativo.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Configuração de Quantidade de Vias de Impressão */}
                <div className="p-3.5 bg-orange-50/60 rounded-xl border border-orange-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Número de Vias de Impressão (Cópias do Cupom)</span>
                      <span className="text-[11px] text-stone-500">Defina se a impressora deve emitir duas vias separadas (Cliente e Atendente) ou apenas uma via única.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${printerCopiesState === 2 ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20' : 'bg-stone-50/80 border-stone-200 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="printerCopies" 
                        value="2"
                        checked={printerCopiesState === 2}
                        onChange={() => setPrinterCopiesState?.(2)}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block flex items-center gap-1.5">
                          <span>2 Vias (1ª Cliente + 2ª Balcão)</span>
                          <span className="bg-orange-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase">Recomendado</span>
                        </span>
                        <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                          Emite a 1ª via para entregar ao cliente e a 2ª via com caixas de conferência [ ] para a atendente do balcão.
                        </span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${printerCopiesState === 1 ? 'bg-white border-orange-500 shadow-xs ring-1 ring-orange-500/20' : 'bg-stone-50/80 border-stone-200 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="printerCopies" 
                        value="1"
                        checked={printerCopiesState === 1}
                        onChange={() => setPrinterCopiesState?.(1)}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">1 Via Única</span>
                        <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                          Emite apenas 1 único cupom por pedido (ideal para economia de papel ou uso simplificado).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Trava de Impressora Específica do Caixa (caixa@donamara.com.br) */}
                <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-300 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-900">Trava da Impressora do Caixa (caixa@donamara.com.br)</span>
                        <span className="bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                          Anti-Confusão
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-600 block mt-0.5">
                        Defina qual impressora térmica é usada exclusivamente pelo operador de caixa neste computador.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={downloadChromeKioskShortcut}
                      className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-orange-300 text-orange-800 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="Gera o atalho do Windows para impressão direta sem janela de diálogo"
                    >
                      <Download className="w-3.5 h-3.5 text-orange-600" />
                      <span>Atalho Sem Diálogo (Kiosk)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        Nome Exato da Impressora Térmica do Caixa:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={caixaPrinterNameState}
                          onChange={(e) => {
                            setCaixaPrinterNameState?.(e.target.value);
                            setLocalCaixaPrinter(e.target.value);
                          }}
                          placeholder="Ex: Elgin i9, EPSON TM-T20..."
                          className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLocalCaixaPrinter(caixaPrinterNameState);
                            alert(`Impressora "${caixaPrinterNameState}" fixada no computador local com sucesso!`);
                          }}
                          className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Salva no navegador deste computador físico"
                        >
                          Fixar Neste PC
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200">
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">Auto-Imprimir ao Chegar Pedido</span>
                        <span className="text-[10px] text-stone-500 block">Dispara o cupom automaticamente no caixa</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoPrintOrdersOnCaixaState}
                          onChange={(e) => {
                            setAutoPrintOrdersOnCaixaState?.(e.target.checked);
                            localStorage.setItem('donamara_auto_print_caixa', String(e.target.checked));
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestPrintWindows}
                      disabled={isTestingPrint}
                      className="bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-800 border border-stone-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                      title="Abre a caixa de diálogo de impressão térmica com um cupom de teste"
                    >
                      <Printer className="w-3.5 h-3.5 text-stone-600" />
                      <span>{isTestingPrint ? 'Enviando Cupom de Teste...' : 'Testar Impressão'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleDirectSavePrinters}
                    className="bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Configuração de Impressoras
                  </button>
                </div>

                {/* Guia Informativo de Impressão */}
                <div className="text-[11px] text-stone-700 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-orange-600" />
                    <span>Como funciona a impressão dos pedidos:</span>
                  </div>
                  <p className="leading-relaxed text-stone-600">
                    1. Ao clicar em <strong>"Imprimir Cupom"</strong> nos pedidos (ou no botão de teste acima), o sistema dispara diretamente a impressão térmica para a impressora configurada.
                  </p>
                  <p className="leading-relaxed text-stone-600">
                    2. No campo <strong>Destino</strong> da caixa de impressão, selecione a sua impressora instalada {activePrinter.isConfigured ? <strong>({activePrinter.name})</strong> : ''}.
                  </p>
                  <p className="leading-relaxed text-stone-600">
                    3. O sistema e o navegador <strong>memorizam sua impressora automaticamente</strong>. Nas próximas impressões, ela já virá selecionada por padrão, bastando apenas confirmar!
                  </p>
                </div>
              </div>
            </div>
          </div>

        {/* 4. Identidade Visual & Cores */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('visual')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Identidade Visual & Cores</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-stone-300 inline-block" style={{ backgroundColor: themeColor }}></span>
                    <span className="text-[10px] font-mono font-bold text-stone-600">{themeColor}</span>
                  </div>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Logomarca da loja, cores dos botões, ícones e cabeçalhos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              {logoSavedSuccess && (
                <span className="hidden md:inline-flex text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Salvo!
                </span>
              )}
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.visual ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.visual ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.visual ? 'block' : 'hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">Logo da Loja</label>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <div className="w-20 h-20 aspect-square bg-stone-200/60 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden shadow-inner group relative shrink-0">
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-full" />
                        <button 
                          type="button"
                          onClick={() => setLogoPreview('')}
                          className="absolute inset-0 bg-red-600/85 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold uppercase cursor-pointer rounded-full"
                        >
                          Limpar
                        </button>
                      </>
                    ) : (
                      <Palette className="w-6 h-6 text-stone-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex flex-wrap gap-2">
                      <input 
                        type="file" 
                        id="logo-upload-collapsible"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" 
                        onChange={(e) => handleImageUpload(e, setLogoPreview)}
                        className="hidden"
                      />
                      <label 
                        htmlFor="logo-upload-collapsible"
                        className="inline-flex items-center gap-1.5 bg-orange-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-orange-700 cursor-pointer transition-colors shadow-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Escolher Arquivo
                      </label>
                      
                      <button
                        type="button"
                        onClick={handleDirectSaveLogo}
                        disabled={isSavingLogo}
                        className="inline-flex items-center gap-1.5 bg-stone-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer transition-all shadow-xs"
                      >
                        <Save className="w-3 h-3 text-amber-400" />
                        {isSavingLogo ? 'Salvando...' : 'Salvar Logo'}
                      </button>

                      {logoPreview !== '/logo.svg' && (
                        <button
                          type="button"
                          onClick={() => setLogoPreview('/logo.svg')}
                          className="text-[10px] font-semibold text-stone-600 hover:text-stone-900 px-2 py-1 underline cursor-pointer"
                        >
                          Padrão
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={logoPreview || ''}
                        onChange={(e) => setLogoPreview(e.target.value)}
                        placeholder="Ou cole a URL da imagem aqui (https://...)"
                        className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg text-stone-700 outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">Cor do Tema Principal</label>
                  <div className="flex gap-3">
                    <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-16 rounded-lg cursor-pointer" />
                    <input type="text" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">Cor do Botão "Adicionar"</label>
                  <div className="flex gap-3">
                    <input type="color" value={addButtonColor} onChange={(e) => setAddButtonColor(e.target.value)} className="h-10 w-16 rounded-lg cursor-pointer" />
                    <input type="text" value={addButtonColor} onChange={(e) => setAddButtonColor(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs font-mono" />
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200">
                  <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-stone-800 block">
                        Botão Flutuante (Conhecer o Sistema)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {showSystemIntroButtonState ? 'Visível no cardápio dos clientes' : 'Oculto'}
                      </span>
                    </div>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        name="showSystemIntroButton_sec4" 
                        checked={showSystemIntroButtonState}
                        onChange={(e) => handleToggleShowSystemIntroButton?.(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Status e Canais de Venda */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('channels')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Status e Canais de Venda</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpenState ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {isOpenState ? 'Loja Aberta' : 'Loja Fechada'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Consumo no Local, Delivery e Totem de Autoatendimento
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.channels ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.channels ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.channels ? 'block' : 'hidden'}`}>
            <p className="text-xs text-stone-500 mb-3">
              Defina de forma independente quais canais estão liberados para receber pedidos e controle o modo de operação da loja.
            </p>

            {/* Status & Modo de Operação da Loja */}
            {(() => {
              const currentStoreStatus = getStoreCurrentStatus(
                weeklyScheduleState,
                isOpenState,
                autoOpenCloseState,
                !!forceOpenState
              );

              return (
                <div className="mb-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-200">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                        Status Geral do Estabelecimento
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black shadow-xs ${
                          currentStoreStatus.isOpenNow
                            ? (forceOpenState && !currentStoreStatus.isWithinSchedule)
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${currentStoreStatus.isOpenNow ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                          {currentStoreStatus.isOpenNow 
                            ? (forceOpenState && !currentStoreStatus.isWithinSchedule ? 'Aberto Manualmente (Extra/Teste)' : 'Aberto Agora') 
                            : 'Fechado Agora'}
                        </span>
                        <span className="text-xs font-medium text-stone-700">
                          {currentStoreStatus.details}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Button */}
                    {!currentStoreStatus.isOpenNow ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (handleSetOperationMode) {
                            handleSetOperationMode('open');
                          } else {
                            setIsOpenState(true);
                            if (setForceOpenState) setForceOpenState(true);
                          }
                        }}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Abrir Loja Agora (Manual)</span>
                      </button>
                    ) : (forceOpenState && !currentStoreStatus.isWithinSchedule) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (handleSetOperationMode) {
                            handleSetOperationMode('auto');
                          } else {
                            if (setForceOpenState) setForceOpenState(false);
                          }
                        }}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-300" />
                        <span>Voltar para Escala Automática</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Botões de Seleção Rápida de Modo */}
                  <div>
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                      Modo de Abertura:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Modo Automático */}
                      <button
                        type="button"
                        onClick={() => {
                          if (handleSetOperationMode) {
                            handleSetOperationMode('auto');
                          } else {
                            setIsOpenState(true);
                            setAutoOpenCloseState(true);
                            if (setForceOpenState) setForceOpenState(false);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          autoOpenCloseState && !forceOpenState && isOpenState
                            ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-sm font-bold ring-2 ring-amber-400/40'
                            : 'bg-white hover:bg-stone-100/80 text-stone-700 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-extrabold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Horário Automático
                          </span>
                          {autoOpenCloseState && !forceOpenState && isOpenState && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-black/15 rounded-full font-black">ATIVO</span>
                          )}
                        </div>
                        <span className="text-[10px] leading-snug opacity-90">
                          Segue a escala semanal. Abre e fecha automaticamente pelo relógio.
                        </span>
                      </button>

                      {/* Modo Aberto Manual */}
                      <button
                        type="button"
                        onClick={() => {
                          if (handleSetOperationMode) {
                            handleSetOperationMode('open');
                          } else {
                            setIsOpenState(true);
                            if (setForceOpenState) setForceOpenState(true);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          forceOpenState || (!autoOpenCloseState && isOpenState)
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-bold ring-2 ring-emerald-400/40'
                            : 'bg-white hover:bg-stone-100/80 text-stone-700 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aberto Manualmente
                          </span>
                          {(forceOpenState || (!autoOpenCloseState && isOpenState)) && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-white/20 rounded-full font-black">ATIVO</span>
                          )}
                        </div>
                        <span className="text-[10px] leading-snug opacity-90">
                          Abre a loja agora para receber pedidos (ideal para testes ou expediente extra).
                        </span>
                      </button>

                      {/* Modo Fechado Manual */}
                      <button
                        type="button"
                        onClick={() => {
                          if (handleSetOperationMode) {
                            handleSetOperationMode('closed');
                          } else {
                            setIsOpenState(false);
                            if (setForceOpenState) setForceOpenState(false);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          !isOpenState
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-bold ring-2 ring-rose-400/40'
                            : 'bg-white hover:bg-stone-100/80 text-stone-700 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Fechado (Pausa)
                          </span>
                          {!isOpenState && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-white/20 rounded-full font-black">ATIVO</span>
                          )}
                        </div>
                        <span className="text-[10px] leading-snug opacity-90">
                          Pausa todos os canais em modo de apenas visualização imediatamente.
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-3">
              {/* Loja Aberta */}
              {(() => {
                const currentStatus = getStoreCurrentStatus(weeklyScheduleState, isOpenState, autoOpenCloseState, !!forceOpenState);
                return (
                  <>
                    <label className="flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl border border-stone-200 cursor-pointer transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">Loja Aberta (Geral)</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpenState ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {isOpenState ? (forceOpenState ? 'Aberto (Manual)' : 'Aberto') : 'Fechado (Pausado)'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">Interruptor mestre. Se desligado, pausa imediatamente toda a loja em modo de apenas visualização.</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="isOpen" 
                          checked={isOpenState}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsOpenState(checked);
                            if (!checked && setForceOpenState) {
                              setForceOpenState(false);
                            } else if (checked && !currentStatus.isWithinSchedule && setForceOpenState) {
                              setForceOpenState(true);
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </div>
                    </label>

                    {/* Consumo no Local */}
                    <label className="flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl border border-stone-200 cursor-pointer transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">Retirada & Mesas (Presencial)</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            !inStoreEnabledState 
                              ? 'bg-stone-200 text-stone-600'
                              : currentStatus.isOpenNow
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {!inStoreEnabledState 
                              ? 'Desativado' 
                              : currentStatus.isOpenNow
                                ? 'Aberto para Pedidos'
                                : 'Fechado Fora do Horário'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">Habilita ou desabilita pedidos para retirada ou consumo nas mesas.</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="inStoreEnabled" 
                          checked={inStoreEnabledState}
                          onChange={(e) => setInStoreEnabledState(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </div>
                    </label>

                    {/* Delivery (Desativado) */}
                    <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 opacity-60 cursor-not-allowed">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">Entrega (Delivery) (Desativado)</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                            Desativado
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">Função desativada neste projeto (apenas Retirada).</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="deliveryEnabled" 
                          checked={false}
                          disabled={true}
                          className="sr-only"
                        />
                        <div className="w-11 h-6 bg-stone-200 rounded-full"></div>
                      </div>
                    </label>

                    {/* Agendamento de Horários (Delivery / Retirada) */}
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label 
                          htmlFor="toggle-delivery-schedule"
                          className="flex-1 cursor-pointer select-none pr-4"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-800">Agendamento de Horários (Delivery / Retirada)</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${deliveryScheduleEnabledState ? 'bg-orange-100 text-orange-800' : 'bg-stone-200 text-stone-600'}`}>
                              {deliveryScheduleEnabledState ? 'Habilitado' : 'Desabilitado'}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500">Permite que o cliente escolha um horário (de 30 em 30 min, das 08:00 às 19:30) para o pedido.</span>
                        </label>
                        <label 
                          htmlFor="toggle-delivery-schedule"
                          className="relative inline-flex items-center cursor-pointer shrink-0"
                        >
                          <input 
                            id="toggle-delivery-schedule"
                            type="checkbox" 
                            checked={deliveryScheduleEnabledState}
                            onChange={(e) => setDeliveryScheduleEnabledState(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 cursor-pointer"></div>
                        </label>
                      </div>

                      {deliveryScheduleEnabledState && (
                        <div className="space-y-4 pt-3 border-t border-stone-200 animate-fadeIn">
                          {/* Configurações de Capacidade e Tempos de Preparo */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                            {/* 1. Capacidade por Horário em Quantidade de Salgados / Itens */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-wider text-amber-950 mb-1">
                                Capacidade por Bloco (Qtd. de Salgados)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="1"
                                  max="9999"
                                  value={scheduleSlotItemCapacityState ?? 100}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setScheduleSlotItemCapacityState?.(val);
                                  }}
                                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-black text-stone-900 focus:ring-2 focus:ring-orange-500 shadow-2xs font-mono"
                                  placeholder="Ex: 100"
                                />
                                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-amber-800">
                                  unidades
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-600 mt-1 leading-tight">
                                Limite máximo de salgados que podem ser agendados para o mesmo horário. A cada pedido, os itens são abatidos até esgotar.
                              </p>
                            </div>

                            {/* 2. Tempo para Retirada de Pedido Normal */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-wider text-amber-950 mb-1">
                                Tempo Retirada: Pedido Normal
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="5"
                                  max="360"
                                  value={schedulePrepTimeNormalMinutesState ?? 40}
                                  onChange={(e) => {
                                    const val = Math.max(5, parseInt(e.target.value, 10) || 40);
                                    setSchedulePrepTimeNormalMinutesState?.(val);
                                  }}
                                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-black text-stone-900 focus:ring-2 focus:ring-orange-500 shadow-2xs font-mono"
                                  placeholder="Ex: 40"
                                />
                                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-amber-800">
                                  minutos
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-600 mt-1 leading-tight">
                                Tempo mínimo de antecedência necessário para preparar pedidos comuns (fritos/assados). Padrão: 40 min.
                              </p>
                            </div>

                            {/* 3. Tempo para Retirada de Pedido Congelado */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-wider text-amber-950 mb-1">
                                Tempo Retirada: Pedido Congelado
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="10"
                                  max="720"
                                  value={schedulePrepTimeFrozenMinutesState ?? 90}
                                  onChange={(e) => {
                                    const val = Math.max(10, parseInt(e.target.value, 10) || 90);
                                    setSchedulePrepTimeFrozenMinutesState?.(val);
                                  }}
                                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-black text-stone-900 focus:ring-2 focus:ring-orange-500 shadow-2xs font-mono"
                                  placeholder="Ex: 90"
                                />
                                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-amber-800">
                                  minutos
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-600 mt-1 leading-tight">
                                Tempo de preparo aplicado automaticamente quando houver salgados congelados no carrinho. Padrão: 90 min.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-700">Horários Atendidos (De 30 em 30 min):</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setDeliveryScheduleSlotsState(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'])}
                                className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer"
                              >
                                Selecionar Todos
                              </button>
                              <span className="text-stone-300">|</span>
                              <button
                                type="button"
                                onClick={() => setDeliveryScheduleSlotsState([])}
                                className="text-[10px] font-bold text-stone-500 hover:underline cursor-pointer"
                              >
                                Desmarcar Todos
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'].map(slot => {
                              const isChecked = deliveryScheduleSlotsState.includes(slot);
                              return (
                                <label 
                                  key={slot}
                                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${isChecked ? 'bg-orange-600 text-white border-orange-600 shadow-xs' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setDeliveryScheduleSlotsState([...deliveryScheduleSlotsState, slot]);
                                      } else {
                                        setDeliveryScheduleSlotsState(deliveryScheduleSlotsState.filter(s => s !== slot));
                                      }
                                    }}
                                    className="hidden"
                                  />
                                  <span>{slot}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Totem (Desativado) */}
                    <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 opacity-60 cursor-not-allowed">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">Totem de Autoatendimento (Desativado)</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                            Desativado
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">Função desativada neste projeto.</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="kioskEnabled" 
                          checked={false}
                          disabled={true}
                          className="sr-only"
                        />
                        <div className="w-11 h-6 bg-stone-200 rounded-full"></div>
                      </div>
                    </label>

                    {/* Exigir Leitura de QR Code para Pedidos (Desativado) */}
                    <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 opacity-60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">Exigir QR Code da Mesa para Fazer Pedidos (Desativado)</span>
                        </div>
                        <span className="text-[11px] text-stone-600 block mt-0.5">
                          Função desativada neste projeto.
                        </span>
                      </div>
                      <div className="relative shrink-0 ml-3">
                        <input 
                          type="checkbox" 
                          checked={false}
                          disabled={true}
                          className="sr-only"
                        />
                        <div className="w-11 h-6 bg-stone-200 rounded-full"></div>
                      </div>
                    </label>

                    <div className="pt-6 pb-2 border-t border-stone-200 mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <h4 className="text-sm font-black text-stone-800 uppercase tracking-wider">Pagamento Online (Credenciais)</h4>
                      </div>
                      
                      <div className="space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <span className="text-xs font-bold text-stone-800">Ativar Módulo de Pagamento Online</span>
                            <p className="text-[11px] text-stone-500">Permite que clientes paguem online via Pix, Cartão de Crédito ou Débito.</p>
                          </div>
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              checked={onlinePaymentEnabledState}
                              onChange={(e) => setOnlinePaymentEnabledState(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                        </label>

                        {onlinePaymentEnabledState && (
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            <div>
                              <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1.5">Operadora de Pagamento</label>
                              <select
                                value={onlinePaymentOperatorState}
                                onChange={(e) => setOnlinePaymentOperatorState(e.target.value as any)}
                                className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                              >
                                <option value="mercadopago">Mercado Pago</option>
                                <option value="stripe">Stripe</option>
                                <option value="pagseguro">PagSeguro</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">Chave Pública (Public Key)</label>
                              <input 
                                type="text"
                                value={onlinePaymentPublicKeyState}
                                onChange={(e) => setOnlinePaymentPublicKeyState(e.target.value)}
                                placeholder="Ex: APP_USR-... ou pk_live_..."
                                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">Chave Secreta / Access Token</label>
                              <div className="relative">
                                <input 
                                  type={showMpToken ? "text" : "password"}
                                  value={onlinePaymentSecretKeyState}
                                  onChange={(e) => setOnlinePaymentSecretKeyState(e.target.value)}
                                  placeholder="Ex: APP_USR-... ou sk_live_..."
                                  className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-mono pr-10"
                                />
                                <button 
                                  type="button"
                                  onClick={() => setShowMpToken(!showMpToken)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
                                >
                                  {showMpToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">Chave Pix (Fallback / BR Code)</label>
                              <input 
                                type="text"
                                value={mercadoPagoPixKeyState}
                                onChange={(e) => setMercadoPagoPixKeyState(e.target.value)}
                                placeholder="CPF, CNPJ, E-mail ou Celular"
                                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 pb-2 border-t border-stone-200 mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-orange-600" />
                        <h4 className="text-sm font-black text-stone-800 uppercase tracking-wider">Tempo Estimado de Entrega</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1 text-center">Tempo Mínimo (Minutos)</label>
                          <input 
                            type="number"
                            value={deliveryEstimatedTimeMinState}
                            onChange={(e) => setDeliveryEstimatedTimeMinState(Number(e.target.value))}
                            className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1 text-center">Tempo Máximo (Minutos)</label>
                          <input 
                            type="number"
                            value={deliveryEstimatedTimeMaxState}
                            onChange={(e) => setDeliveryEstimatedTimeMaxState(Number(e.target.value))}
                            className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <p className="col-span-2 text-[10px] text-stone-500 text-center italic mt-1">
                          Este tempo será usado para exibir o cronômetro para o cliente após a finalização do pedido.
                        </p>
                      </div>
                    </div>

                  </>
                );
              })()}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                <div>
                  <p className="text-xs font-bold text-blue-900 mb-0.5">
                    Link direto do Totem: <span className="font-mono text-blue-700 font-normal">/totem</span>
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Abra este link em tela cheia no tablet do seu balcão ou totem.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/totem"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <span>📱</span>
                    Abrir Totem
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/totem`);
                      alert('Link do Totem copiado com sucesso!');
                    }}
                    className="bg-white text-stone-700 border border-stone-300 px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-stone-50 transition-all cursor-pointer"
                  >
                    Copiar Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Página em Manutenção */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('maintenance')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Página em Manutenção</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isMaintenanceState ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-stone-100 text-stone-600'}`}>
                    {isMaintenanceState ? 'Manutenção Ativa' : 'Desativada'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Bloqueia o cardápio temporariamente para o público enquanto você faz ajustes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.maintenance ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.maintenance ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.maintenance ? 'block' : 'hidden'}`}>
            <p className="text-xs text-stone-500 mb-3">
              Ative quando precisar corrigir preços ou cadastros antes de liberar para os clientes.
            </p>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    name="isMaintenance" 
                    checked={isMaintenanceState}
                    onChange={(e) => setIsMaintenanceState(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-800">Ativar Página de Manutenção</span>
                  <p className="text-[11px] text-stone-500">Exibe uma tela amigável com contatos aos visitantes.</p>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Mensagem exibida aos clientes
                </label>
                <textarea
                  name="maintenanceMessage"
                  defaultValue={storeInfo.maintenanceMessage || 'Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!'}
                  rows={2}
                  className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-stone-800 bg-white"
                  placeholder="Ex: Estamos atualizando nossos produtos e preços. Para dúvidas ou pedidos urgentes, entre em contato pelo nosso WhatsApp!"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href="/?bypass_maintenance=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                  <span>Testar Cardápio (Modo Bypass Admin)</span>
                </a>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-700" />
                  <span>Ver Tela de Manutenção Pública</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Horários por Dia da Semana */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('schedule')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Horários de Funcionamento por Dia</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentStoreStatus.isOpenNow ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>
                    Hoje: {currentStoreStatus.statusBadge}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Escala semanal completa, abertura e fechamento automático com relógio
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.schedule ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.schedule ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.schedule ? 'block' : 'hidden'}`}>
            {/* Auto Open/Close Box */}
            <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-200/80 mb-3 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-bold text-stone-800">Automação de Horário (Consumo no Local e Totem)</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${autoOpenCloseState ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                      {autoOpenCloseState ? 'Ativo' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    O Consumo na Loja e o Totem abrem e fecham automaticamente com base no relógio e na escala abaixo. O Delivery permanece com controle manual.
                  </p>
                </div>
                <div className="relative shrink-0 ml-3">
                  <input 
                    type="checkbox" 
                    checked={autoOpenCloseState}
                    onChange={(e) => setAutoOpenCloseState(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Mensagem exibida aos clientes quando a loja estiver fechada
                </label>
                <input
                  type="text"
                  value={closedMessageState}
                  onChange={(e) => setClosedMessageState(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Ex: Estamos fechados no momento. Abrimos novamente amanhã às 06:00!"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Escala dos Dias</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyWeekdayHours(1)}
                  className="text-xs bg-stone-100 hover:bg-orange-100 hover:text-orange-800 text-stone-700 px-2.5 py-1 rounded-lg border border-stone-200 font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Copiar Seg p/ Ter-Sex
                </button>
                <button
                  type="button"
                  onClick={handleResetScheduleHours}
                  className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 rounded-lg border border-stone-200 font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Padrão da Loja
                </button>
              </div>
            </div>

            {/* Table of days */}
            <div className="space-y-1.5">
              {weeklyScheduleState.map((day) => (
                <div 
                  key={day.dayOfWeek}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                    day.isOpen 
                      ? 'bg-white border-stone-200 shadow-2xs' 
                      : 'bg-stone-50/70 border-stone-200/60 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-[140px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={day.isOpen}
                          onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'isOpen', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                      <div>
                        <span className={`text-xs font-bold ${day.isOpen ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                          {day.dayName}
                        </span>
                        <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          day.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-600'
                        }`}>
                          {day.isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                    </div>

                    {day.isOpen ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-stone-500 text-[11px]">Abre:</span>
                          <input
                            type="time"
                            value={day.openTime}
                            onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'openTime', e.target.value)}
                            className="p-1 px-1.5 bg-stone-50 border border-stone-300 rounded text-xs font-mono font-bold text-stone-800"
                          />
                        </div>
                        <span className="text-stone-400 text-xs font-bold">às</span>
                        <div className="flex items-center gap-1">
                          <span className="text-stone-500 text-[11px]">Fecha:</span>
                          <input
                            type="time"
                            value={day.closeTime}
                            onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'closeTime', e.target.value)}
                            className="p-1 px-1.5 bg-stone-50 border border-stone-300 rounded text-xs font-mono font-bold text-stone-800"
                          />
                        </div>

                        <div className="flex items-center gap-1 pl-2 border-l border-stone-200">
                          <label className="flex items-center gap-1 cursor-pointer text-stone-500 hover:text-stone-800 text-[11px]">
                            <input
                              type="checkbox"
                              checked={!!day.hasBreak}
                              onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'hasBreak', e.target.checked)}
                              className="rounded text-orange-600 focus:ring-orange-500 w-3 h-3"
                            />
                            <span>Almoço</span>
                          </label>

                          {day.hasBreak && (
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={day.breakStart || '12:00'}
                                onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'breakStart', e.target.value)}
                                className="p-0.5 px-1 bg-stone-50 border border-stone-300 rounded text-[10px] font-mono"
                              />
                              <span className="text-stone-400">-</span>
                              <input
                                type="time"
                                value={day.breakEnd || '13:30'}
                                onChange={(e) => handleDayScheduleChange(day.dayOfWeek, 'breakEnd', e.target.value)}
                                className="p-0.5 px-1 bg-stone-50 border border-stone-300 rounded text-[10px] font-mono"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-stone-400 italic">Sem atendimento</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
              <span className="font-semibold text-stone-700">Resumo:</span>
              <span className="font-mono text-xs font-medium text-stone-800">{formatWeeklyScheduleSummary(weeklyScheduleState)}</span>
            </div>
          </div>
        </div>

        {/* 8. Agente Virtual Inteligente (Atendente I.A.) & Central de Aprendizado */}
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('ai_agent')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800">Agente Virtual Inteligente (Atendente I.A.) & Aprendizado</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${aiAgentEnabledState ? 'bg-purple-100 text-purple-800' : 'bg-stone-200 text-stone-600'}`}>
                    {aiAgentEnabledState ? `${aiAgentNameState || 'Dona Mara IA'} (Ativo)` : 'Desativado'}
                  </span>
                  {(aiAgentTrainingExamplesState || []).filter(e => e.active !== false).length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 hidden sm:inline-flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      {(aiAgentTrainingExamplesState || []).filter(e => e.active !== false).length} diálogos treinados
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Atendimento em tempo real, base de aprendizado personalizado, regras anti-repetição e pedidos WhatsApp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                {openSections.ai_agent ? 'Recolher' : 'Expandir'}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.ai_agent ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.ai_agent ? 'block' : 'hidden'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-xs text-stone-500">
                Configure a personalidade, adicione mensagens para o agente aprender e personalize o atendimento da loja.
              </p>
              <button
                type="button"
                onClick={() => setIsAiTestModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer w-fit shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Testar Agente I.A. no Simulador
              </button>
            </div>

            <div className="space-y-6">
              {/* Bloco 1: Status e Identidade */}
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200/80 space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800">Ativar Atendente I.A. no Cardápio</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${aiAgentEnabledState ? 'bg-purple-100 text-purple-800' : 'bg-stone-200 text-stone-600'}`}>
                        {aiAgentEnabledState ? 'Ativo' : 'Desativado'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">Exibe o botão flutuante e o chat interativo para os clientes no cardápio.</p>
                  </div>
                  <div className="relative shrink-0 ml-3">
                    <input 
                      type="checkbox" 
                      checked={aiAgentEnabledState}
                      onChange={(e) => setAiAgentEnabledState(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </div>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-purple-100">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                      Nome do Assistente Virtual
                    </label>
                    <input
                      type="text"
                      value={aiAgentNameState}
                      onChange={(e) => setAiAgentNameState(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                      placeholder="Ex: Dona Mara IA"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp de Transbordo / Envio de Pedidos
                    </label>
                    <input
                      type="text"
                      value={aiAgentWhatsAppPhoneState}
                      onChange={(e) => setAiAgentWhatsAppPhoneState(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                      placeholder="Ex: (34) 3338-3795"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Personalidade e Tom de Resposta
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAiAgentToneState('amigavel')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiAgentToneState === 'amigavel' 
                          ? 'bg-purple-100/70 border-purple-400 ring-2 ring-purple-500/20' 
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-stone-800 flex items-center gap-1 mb-0.5">
                        <span>🥟</span> Amigável & Acolhedor
                      </div>
                      <p className="text-[10px] text-stone-500 leading-snug">
                        Atendimento acolhedor, caloroso e atencioso.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiAgentToneState('direto')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiAgentToneState === 'direto' 
                          ? 'bg-purple-100/70 border-purple-400 ring-2 ring-purple-500/20' 
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-stone-800 flex items-center gap-1 mb-0.5">
                        <span>⚡</span> Rápido & Direto
                      </div>
                      <p className="text-[10px] text-stone-500 leading-snug">
                        Respostas curtas, objetivas, práticas e sem rodeios.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiAgentToneState('especialista')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiAgentToneState === 'especialista' 
                          ? 'bg-purple-100/70 border-purple-400 ring-2 ring-purple-500/20' 
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-stone-800 flex items-center gap-1 mb-0.5">
                        <span>👨‍🍳</span> Especialista & Chef
                      </div>
                      <p className="text-[10px] text-stone-500 leading-snug">
                        Conhece detalhes dos cafés, fermentações e harmonizações.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Central de Treinamento e Diálogos de Exemplo (Few-Shot) */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-800">
                        Exemplos de Treinamento (Como a I.A. deve responder)
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Adicione perguntas reais de clientes e defina exatamente a resposta ideal para a I.A. aprender o padrão.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetTrainingExamples}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Carregar modelos recomendados para atendimento"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Modelos Padrão
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTrainingExample}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo Diálogo
                    </button>
                  </div>
                </div>

                {/* Lista de Diálogos */}
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {(aiAgentTrainingExamplesState || []).length === 0 ? (
                    <div className="p-6 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                      <MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-xs text-stone-600 font-medium">Nenhum diálogo de treinamento adicionado.</p>
                      <p className="text-[11px] text-stone-400 mt-1">
                        Clique em "Novo Diálogo" ou "Modelos Padrão" para ensinar o atendente virtual.
                      </p>
                    </div>
                  ) : (
                    (aiAgentTrainingExamplesState || []).map((ex, idx) => (
                      <div 
                        key={ex.id || `train_${idx}`}
                        className={`p-3.5 rounded-xl border transition-all ${
                          ex.active !== false 
                            ? 'bg-stone-50/90 border-stone-200' 
                            : 'bg-stone-100/60 border-stone-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-stone-700">Diálogo de Referência</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ex.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                              {ex.active !== false ? 'Ativo' : 'Desativado'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500 font-medium mr-2">
                              <input
                                type="checkbox"
                                checked={ex.active !== false}
                                onChange={(e) => handleUpdateTrainingExample(ex.id, 'active', e.target.checked)}
                                className="w-3.5 h-3.5 text-purple-600 rounded border-stone-300 focus:ring-purple-500"
                              />
                              Ativar no aprendizado
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrainingExample(ex.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir este exemplo de treinamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-600 uppercase mb-0.5">
                              Pergunta do Cliente:
                            </label>
                            <input
                              type="text"
                              value={ex.question}
                              onChange={(e) => handleUpdateTrainingExample(ex.id, 'question', e.target.value)}
                              placeholder="Ex: Vocês aceitam encomendas de bolos ou tortas?"
                              className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-800 focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-stone-600 uppercase mb-0.5">
                              Resposta Ideal da I.A.:
                            </label>
                            <textarea
                              value={ex.answer}
                              onChange={(e) => handleUpdateTrainingExample(ex.id, 'answer', e.target.value)}
                              rows={2}
                              placeholder="Ex: Sim! Aceitamos encomendas personalizadas com pelo menos 24 horas de antecedência..."
                              className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-800 focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bloco 3: Base de Conhecimento e Políticas da Loja */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Base de Conhecimento Livre & Políticas da Loja
                  </h4>
                </div>
                <p className="text-[11px] text-stone-500">
                  Insira aqui informações detalhadas que você quer que o atendente consulte (ex: regras de entrega, histórico da casa, ingredientes especiais, estacionamento, etc).
                </p>
                <textarea
                  value={aiAgentKnowledgeBaseState}
                  onChange={(e) => setAiAgentKnowledgeBaseState(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                  placeholder="Ex: 
- Nossas entregas são feitas por motoboy próprio em até 5km.
- O pão francês sai quentinho todos os dias às 06:30, 10:00 e 16:30.
- Nossos bolos caseiros não levam conservantes químicos.
- Aceitamos encomendas de cento de salgados com 24h de aviso."
                />
              </div>

              {/* Bloco 4: Diretrizes Anti-Repetição e Criatividade */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-600" />
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Controle Anti-Repetição & Estilo de Geração
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Switch Anti-Repetição */}
                  <div className="p-3 bg-white rounded-xl border border-stone-200">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                          Modo Anti-Repetição Rigoroso
                        </span>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Proíbe a I.A. de repetir saudações ("Olá! Sou Dona Mara IA") no meio do chat e elimina respostas redundantes.
                        </p>
                      </div>
                      <div className="relative shrink-0 ml-3">
                        <input 
                          type="checkbox" 
                          checked={aiAgentAntiRepeatState}
                          onChange={(e) => setAiAgentAntiRepeatState(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </div>
                    </label>
                  </div>

                  {/* Nível de Criatividade / Temperatura */}
                  <div className="p-3 bg-white rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-stone-800">
                        Variação de Resposta (Criatividade)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {aiAgentCreativityState <= 0.4 ? 'Mais Direto (0.3)' : aiAgentCreativityState >= 0.8 ? 'Mais Variado (0.85)' : 'Equilibrado (0.65)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => setAiAgentCreativityState(0.3)}
                        className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all cursor-pointer ${
                          aiAgentCreativityState <= 0.4 ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        Direto & Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiAgentCreativityState(0.65)}
                        className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all cursor-pointer ${
                          aiAgentCreativityState > 0.4 && aiAgentCreativityState < 0.8 ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        Recomendado
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiAgentCreativityState(0.85)}
                        className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all cursor-pointer ${
                          aiAgentCreativityState >= 0.8 ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        Mais Variado
                      </button>
                    </div>
                  </div>
                </div>

                {/* Restrições / O que nunca dizer */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-red-700 mb-1 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Restrições e Frases Proibidas (O que a I.A. NUNCA deve prometer)
                  </label>
                  <textarea
                    value={aiAgentForbiddenPhrasesState}
                    onChange={(e) => setAiAgentForbiddenPhrasesState(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-red-500 outline-none leading-relaxed"
                    placeholder="Ex: Nunca prometer entrega em menos de 20 minutos; nunca prometer desconto sem autorização; nunca inventar sabores de bolo que não estão no cardápio."
                  />
                </div>

                {/* Mensagem Padrão do WhatsApp */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                      Avisos Rápidos de Fornadas do Dia
                    </label>
                    <input
                      type="text"
                      value={aiAgentCustomPromptState}
                      onChange={(e) => setAiAgentCustomPromptState(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Ex: Pão de queijo quentinho saindo agora!"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                      Mensagem pré-preenchida no WhatsApp
                    </label>
                    <input
                      type="text"
                      value={aiAgentWhatsAppDefaultMessageState}
                      onChange={(e) => setAiAgentWhatsAppDefaultMessageState(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-xs text-stone-800 focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Olá! Vim pelo cardápio da Dona Mara e gostaria de fazer um pedido."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 9. Integração BlueFocus (ERP) */}
        {isMaster && (
          <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('bluefocus')}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-800">Integração BlueFocus (ERP)</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAutoSyncEnabled ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'}`}>
                      {isAutoSyncEnabled ? 'Auto-Sync (08h, 14h, 18h) Ativo' : 'Sincronização Manual'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Sincronização de catálogo, preços, estoque e conexão com o servidor local
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                  {openSections.bluefocus ? 'Recolher' : 'Expandir'}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.bluefocus ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>

            <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.bluefocus ? 'block' : 'hidden'}`}>
              <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
                <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700">
                  <span className="flex items-center gap-1 font-bold pl-1 text-stone-800">
                    <Clock className="w-3.5 h-3.5 text-orange-600" />
                    Auto Sync (08h, 14h, 18h | Seg-Sex / Sáb 08h):
                  </span>
                  <div className="flex items-center bg-stone-200 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoSyncEnabled(true);
                        localStorage.setItem('bluefocus_auto_sync', 'true');
                        if (!localStorage.getItem('bluefocus_last_auto_sync_timestamp')) {
                          localStorage.setItem('bluefocus_last_auto_sync_timestamp', String(Date.now()));
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-black transition-all cursor-pointer ${
                        isAutoSyncEnabled ? 'bg-green-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoSyncEnabled(false);
                        localStorage.setItem('bluefocus_auto_sync', 'false');
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-black transition-all cursor-pointer ${
                        !isAutoSyncEnabled ? 'bg-stone-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" 
                    onClick={() => {
                      if (window.confirm('Deseja resetar os marcadores para zero e iniciar a sincronização completa agora?')) {
                        const resetConfig = { 
                          ...blueFocusConfig, 
                          tipo: '4',
                          startCargaNumero: '0', 
                          startCargaSequencia: '0',
                          startProdutoId: '0' 
                        };
                        setBlueFocusConfig(resetConfig);
                        localStorage.setItem('bluefocus_tipo', '4');
                        localStorage.setItem('bluefocus_start_carga_numero', '0');
                        localStorage.setItem('bluefocus_start_carga_sequencia', '0');
                        localStorage.setItem('bluefocus_start_produto_id', '0');
                        handleSyncBlueFocus(resetConfig);
                      }
                    }}
                    className="text-xs bg-stone-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-stone-200 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resetar p/ Início (Zero)
                  </button>
                  <button 
                    type="button" 
                    onClick={handleTestBlueFocus}
                    disabled={isTestingBlueFocus}
                    className="text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingBlueFocus ? 'animate-spin' : ''}`} />
                    Testar Conexão
                  </button>
                </div>
              </div>

              {/* Feedback toast de salvamento */}
              {blueFocusSaveFeedback && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{blueFocusSaveFeedback}</span>
                </div>
              )}

              <div className="space-y-6">
                {/* 1. Credenciais & Identificação */}
                <div>
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-stone-600" />
                    1. Credenciais & Identificação do PDV
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Chave de Autenticação (Token)
                      </label>
                      <div className="relative">
                        <input 
                          type={showBlueFocusToken ? 'text' : 'password'} 
                          value={blueFocusConfig.authToken || ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setBlueFocusConfig((prev: any) => ({ ...prev, authToken: val }));
                            localStorage.setItem('bluefocus_auth_token', val);
                          }}
                          placeholder="Opcional (se exigido)"
                          className="w-full p-2.5 pr-9 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-xs" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowBlueFocusToken(!showBlueFocusToken)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                          title={showBlueFocusToken ? 'Ocultar chave' : 'Mostrar chave'}
                        >
                          {showBlueFocusToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5">Cabeçalho HTTP 'autentica'</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Empresa ID
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.empresaId || 'DONAMARA'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, empresaId: val }));
                          localStorage.setItem('bluefocus_empresa_id', val);
                        }}
                        placeholder="DONAMARA"
                        className="w-full p-2.5 border rounded-xl bg-white text-stone-900 font-semibold focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Identificador da empresa no ERP</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Usuário ID
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.usuarioId || 'CONSULTA'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, usuarioId: val }));
                          localStorage.setItem('bluefocus_usuario_id', val);
                        }}
                        placeholder="CONSULTA"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Usuário com permissão de consulta</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        PDV Código
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.pdvCodigo || '1000'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, pdvCodigo: val }));
                          localStorage.setItem('bluefocus_pdv_codigo', val);
                        }}
                        placeholder="1000"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Código do terminal SAT / PDV</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Pessoa ID (PessoaId)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.pessoaId || '0'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, pessoaId: val }));
                          localStorage.setItem('bluefocus_pessoa_id', val);
                        }}
                        placeholder="0"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Identificador de pessoa (padrão: 0)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Lote por Requisição (Batch)
                      </label>
                      <select 
                        value={blueFocusConfig.batchSize || '4'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, batchSize: val }));
                          localStorage.setItem('bluefocus_batch_size', val);
                        }}
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      >
                        <option value="4">4 iterações / requisição (Recomendado)</option>
                        <option value="10">10 iterações / requisição</option>
                        <option value="20">20 iterações / requisição</option>
                        <option value="50">50 iterações / requisição</option>
                      </select>
                      <p className="text-[10px] text-stone-400 mt-0.5">Evita timeouts em redes lentas</p>
                    </div>
                  </div>
                </div>

                {/* 2. Endpoints & URLs dos Serviços SOAP */}
                <div>
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-stone-600" />
                    2. Endpoints SOAP do Servidor Local
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        URL de Sincronização (Catálogo / Produtos)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.syncUrl || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, syncUrl: val }));
                          localStorage.setItem('bluefocus_sync_url', val);
                        }}
                        placeholder="http://servidor-erp:8082/valim/servlet/aintegracaofcxexportacadsat"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Serviço: aintegracaofcxexportacadsat</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        URL de Exportação de Vendas / Pré-Venda
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.orderUrl || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, orderUrl: val }));
                          localStorage.setItem('bluefocus_order_url', val);
                        }}
                        placeholder="http://servidor-erp:8082/valim/servlet/aintegracaofcxregistravenda"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Serviço: aintegracaofcxregistravenda</p>
                    </div>
                  </div>
                </div>

                {/* 3. Parâmetros de Carga & Paginação (Marcadores ERP) */}
                <div>
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-stone-600" />
                    3. Parâmetros de Carga & Marcadores de Paginação
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Tipo de Sincronização
                      </label>
                      <select 
                        value={blueFocusConfig.tipoAtualizacao || 'A'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, tipoAtualizacao: val }));
                          localStorage.setItem('bluefocus_tipo_atualizacao', val);
                        }}
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      >
                        <option value="A">A - Apenas Alterações (Incremental)</option>
                        <option value="C">C - Carga Total (Completa)</option>
                      </select>
                      <p className="text-[10px] text-stone-400 mt-0.5">"A" no dia a dia; "C" para recarga geral</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Tipo de Dado (Padrão: 4)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.tipo || '4'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, tipo: val }));
                          localStorage.setItem('bluefocus_tipo', val);
                        }}
                        placeholder="4"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">4 = Produtos e Preços no Valim</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Data Inicial (DataHoraInicio)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.dataInicial || '30/12/1899'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, dataInicial: val }));
                          localStorage.setItem('bluefocus_data_inicial', val);
                        }}
                        placeholder="30/12/1899"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Filtro de data (DD/MM/AAAA)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Carga Inicial (Número)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.startCargaNumero ?? '0'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, startCargaNumero: val }));
                          localStorage.setItem('bluefocus_start_carga_numero', val);
                        }}
                        placeholder="0"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">CargaPDVNumero (marcador ERP)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        Carga Inicial (Sequência)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.startCargaSequencia ?? '0'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, startCargaSequencia: val }));
                          localStorage.setItem('bluefocus_start_carga_sequencia', val);
                        }}
                        placeholder="0"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">CargaPDVSequencia (marcador ERP)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                        ID do Produto Inicial (ProdutoId)
                      </label>
                      <input 
                        type="text" 
                        value={blueFocusConfig.startProdutoId ?? '0'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlueFocusConfig((prev: any) => ({ ...prev, startProdutoId: val }));
                          localStorage.setItem('bluefocus_start_produto_id', val);
                        }}
                        placeholder="0"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-mono" 
                      />
                      <p className="text-[10px] text-stone-400 mt-0.5">Marcador ProdutoId para pular até ID</p>
                    </div>
                  </div>
                </div>

                {/* 4. Barra de Ações */}
                <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBlueFocusConfig}
                      className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:bg-stone-900 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Salvar Configurações
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSyncBlueFocus(blueFocusConfig)}
                      disabled={isSyncing}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                        isSyncing 
                          ? 'bg-orange-100 text-orange-700 cursor-not-allowed' 
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar Produtos Agora'}
                    </button>
                    {handleSyncCustomersBlueFocus && (
                      <button
                        type="button"
                        onClick={() => handleSyncCustomersBlueFocus()}
                        disabled={isSyncing}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                          isSyncing 
                            ? 'bg-blue-100 text-blue-700 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Clientes Agora'}
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-stone-500">
                    💡 Todas as alterações são salvas localmente e utilizadas automaticamente pelo sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10. Status do Banco de Dados (Cloud SQL) */}
        {isMaster && (
          <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('database')}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <MonitorSmartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-800">Status do Banco de Dados (Cloud SQL PostgreSQL)</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${connectionStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
                      {connectionStatus === 'success' ? 'Conectado OK' : 'Cloud SQL Online'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Teste de latência, contagem de produtos/categorias e status da API
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="hidden sm:inline-block text-xs font-medium text-stone-400">
                  {openSections.database ? 'Recolher' : 'Expandir'}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${openSections.database ? 'bg-orange-100 text-orange-700 rotate-180' : 'bg-stone-100 text-stone-600'}`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>

            <div className={`px-5 pb-5 pt-3 border-t border-stone-100 ${openSections.database ? 'block' : 'hidden'}`}>
              <div className="space-y-4">
                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Persistência Permanente</p>
                    <p className="font-mono text-xs font-semibold text-emerald-700">PostgreSQL (Drizzle ORM)</p>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Ambiente Cloud</p>
                    <p className="font-mono text-xs break-all text-stone-700">Google Cloud / AI Studio</p>
                  </div>
                </div>

                {/* Persistence Notice for Database Deployments */}
                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Persistência de dados no PostgreSQL:
                  </p>
                  <p className="text-amber-800/90 text-[11px]">
                    Com a conexão do PostgreSQL ativa (Google Cloud SQL ou variável <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">DATABASE_URL</code>), 
                    <strong>todas as suas configurações, produtos, categorias e pedidos são salvos e sincronizados automaticamente no banco de dados</strong>!
                  </p>
                </div>
                
                {/* Connection Test Action */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" 
                      onClick={async () => {
                        setConnectionStatus('testing');
                        setConnectionErrorMessage('');
                        try {
                          const testRes = await fetch('/api/db/test-connection', { cache: 'no-store' });
                          let data: any = {};
                          try {
                            data = await testRes.json();
                          } catch (_) {}

                          if (testRes.ok && data.success) {
                            setConnectionStatus('success');
                            setConnectionErrorMessage(
                              `✅ ${data.message} | Banco: ${data.databaseName || 'PostgreSQL'} | Produtos: ${data.productCount} | Categorias: ${data.categoryCount} (${data.responseTimeMs}ms)`
                            );
                          } else {
                            setConnectionStatus('error');
                            const msg = data.message || `Erro HTTP ${testRes.status} no servidor de API.`;
                            const det = data.details ? `\n• Detalhe: ${data.details}` : '';
                            const env = data.envDetected ? `\n• DATABASE_URL detectada: ${data.envDetected.DATABASE_URL ? 'Sim' : 'Não'}` : '';
                            setConnectionErrorMessage(`⚠️ ${msg}${det}${env}`);
                          }
                        } catch (error: any) {
                          console.error('Test connection error:', error);
                          setConnectionStatus('error');
                          setConnectionErrorMessage(error.message || 'Erro desconhecido na conexão com o servidor.');
                        }
                      }}
                      disabled={connectionStatus === 'testing'}
                      className={`px-4 py-2 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                        connectionStatus === 'testing' ? 'bg-stone-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      {connectionStatus === 'testing' ? 'Testando Conexão...' : 'Testar Conexão com PostgreSQL'}
                    </button>
                    <p className="text-[11px] text-stone-500 italic">
                      Verifica em tempo real se o banco de dados está gravando e respondendo.
                    </p>
                  </div>

                  {connectionStatus === 'success' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2.5 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <p className="text-xs font-bold">Conexão com PostgreSQL ativa e gravando!</p>
                        <p className="text-[11px] font-mono mt-0.5 text-green-800">{connectionErrorMessage}</p>
                      </div>
                    </div>
                  )}

                  {connectionStatus === 'error' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-red-700">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <p className="text-xs font-bold">Aviso de Conexão com o Banco</p>
                      </div>
                      <p className="text-[11px] text-red-600 font-mono bg-white/50 p-2 rounded border border-red-100 whitespace-pre-line">
                        {connectionErrorMessage}
                      </p>
                    </div>
                  )}

                  {/* Backup & Restore Panel */}
                  <div className="mt-2 pt-4 border-t border-stone-200 space-y-3">
                    <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-stone-600" />
                      Backup & Restauração de Segurança (JSON)
                    </p>
                    <p className="text-[11px] text-stone-600">
                      Você pode baixar uma cópia completa de todas as configurações, catálogo de produtos, categorias e horários para o seu computador a qualquer momento, ou restaurar um backup anterior com 1 clique.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadBackup}
                        disabled={isDownloadingBackup}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isDownloadingBackup ? 'Gerando Backup...' : 'Baixar Backup Geral (JSON)'}
                      </button>

                      <input
                        ref={backupInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileRestore}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => backupInputRef.current?.click()}
                        disabled={isRestoringBackup}
                        className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {isRestoringBackup ? 'Restaurando...' : 'Restaurar de Arquivo JSON'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsRestoringBackup(true);
                          setBackupStatusMsg(null);
                          try {
                            const res = await fetch('/api/db/reset-all', { method: 'POST' });
                            const data = await res.json();
                            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao zerar banco de dados');
                            try {
                              Object.keys(localStorage).forEach(k => {
                                if (k.startsWith('donamara_')) {
                                  localStorage.removeItem(k);
                                }
                              });
                              localStorage.setItem('bluefocus_start_carga_numero', '0');
                              localStorage.setItem('bluefocus_start_carga_sequencia', '0');
                              localStorage.setItem('bluefocus_start_produto_id', '0');
                            } catch {}
                            setBackupStatusMsg({
                              type: 'success',
                              text: 'Banco de dados completamente zerado! Recarregando sistema...'
                            });
                            setTimeout(() => {
                              window.location.reload();
                            }, 1200);
                          } catch (e: any) {
                            setBackupStatusMsg({
                              type: 'error',
                              text: 'Erro ao zerar banco: ' + (e.message || 'Falha na operação.')
                            });
                          } finally {
                            setIsRestoringBackup(false);
                          }
                        }}
                        disabled={isRestoringBackup}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Zerar Todo o Banco de Dados
                      </button>
                    </div>

                    {backupStatusMsg && (
                      <div className={`p-3 rounded-xl text-xs font-medium ${
                        backupStatusMsg.type === 'success' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {backupStatusMsg.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Submit Bar */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-xs text-stone-500">
            Todas as opções editadas acima serão gravadas e sincronizadas no sistema.
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              type="submit" 
              className="w-full sm:w-auto bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-amber-400" />
              Salvar Todas as Configurações
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Teste do Agente I.A. */}
      {isAiTestModalOpen && (
        <AiAssistantModal 
          isOpen={isAiTestModalOpen} 
          onClose={() => setIsAiTestModalOpen(false)} 
        />
      )}
    </div>
  );
}
