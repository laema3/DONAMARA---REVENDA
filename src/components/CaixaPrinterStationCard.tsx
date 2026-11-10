import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Check, 
  AlertCircle, 
  Zap, 
  Download, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  Sliders,
  Laptop,
  Usb,
  Network,
  Globe,
  Wifi,
  Terminal,
  Activity,
  RefreshCw,
  Coins,
  Volume2
} from 'lucide-react';
import { StoreInfo } from '../store/useStore';
import { 
  getActiveOrderPrinter, 
  getLocalCaixaPrinter, 
  setLocalCaixaPrinter, 
  downloadChromeKioskShortcut,
  connectWebSerialPrinter,
  disconnectWebSerialPrinter,
  hasActiveSerialConnection,
  isWebSerialSupported,
  printReceipt,
  createSampleOrder,
  getNetworkPrinterConfig,
  setNetworkPrinterConfig,
  testNetworkPrinterIp,
  downloadWindowsNetworkPrinterScript,
  fetchPrinterAgentStatus,
  triggerPrinterAgentTestJob,
  downloadWindowsAgentBat,
  openCashDrawer,
  playPrintBeepSound
} from '../utils/printer';

interface CaixaPrinterStationCardProps {
  storeInfo: StoreInfo;
  onUpdateStoreInfo?: (updates: Partial<StoreInfo>) => Promise<void> | void;
  currentUserEmail?: string;
  isCaixaUser?: boolean;
}

export const CaixaPrinterStationCard: React.FC<CaixaPrinterStationCardProps> = ({
  storeInfo,
  onUpdateStoreInfo,
  currentUserEmail,
  isCaixaUser = false
}) => {
  const [connectionType, setConnectionType] = useState<'network' | 'windows'>('network');
  const [networkIp, setNetworkIp] = useState('');
  const [networkPort, setNetworkPort] = useState(9100);
  const [isTestingNetIp, setIsTestingNetIp] = useState(false);

  const [selectedPrinterName, setSelectedPrinterName] = useState('');
  const [customPrinterInput, setCustomPrinterInput] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isAutoPrint, setIsAutoPrint] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{
    isOnline: boolean;
    lastSeen?: number;
    secondsAgo?: number;
    hostname?: string;
    version?: string;
    totalPrinted?: number;
    pendingCount?: number;
  }>({ isOnline: false });
  const [isTriggeringAgentTest, setIsTriggeringAgentTest] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [isTestingDrawer, setIsTestingDrawer] = useState(false);
  const [showDrawerGuide, setShowDrawerGuide] = useState(false);

  // Determina a impressora ativa atual
  const activePrinter = getActiveOrderPrinter(storeInfo);

  useEffect(() => {
    const netConf = getNetworkPrinterConfig(storeInfo);
    setNetworkIp(netConf.ip || '');
    setNetworkPort(netConf.port || 9100);
    setConnectionType(storeInfo?.printerConnectionType === 'windows' ? 'windows' : 'network');

    const local = getLocalCaixaPrinter();
    const current = local || storeInfo?.caixaPrinterName || storeInfo?.preferredPrinterName || 'Impressora Térmica Padrão';
    setSelectedPrinterName(current);
    setCustomPrinterInput(current);

    const autoPrintStorage = localStorage.getItem('donamara_auto_print_caixa');
    if (autoPrintStorage !== null) {
      setIsAutoPrint(autoPrintStorage === 'true');
    } else {
      setIsAutoPrint(Boolean(storeInfo?.autoPrintOrdersOnCaixa));
    }

    setIsSerialConnected(hasActiveSerialConnection());

    // Monitora periodicamente o status do Agente Windows local
    const pollAgent = async () => {
      const res = await fetchPrinterAgentStatus();
      setAgentStatus(res);
    };
    pollAgent();
    const agentInterval = setInterval(pollAgent, 4000);

    return () => {
      clearInterval(agentInterval);
    };
  }, [storeInfo]);

  const handleTriggerAgentTest = async () => {
    setIsTriggeringAgentTest(true);
    setFeedbackMsg(null);
    try {
      const res = await triggerPrinterAgentTestJob();
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: '✅ Cupom de teste enviado para o Agente Windows! A impressão sairá na EPSON em segundos.'
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res.message || 'Falha ao solicitar teste para o agente.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erro ao conectar ao servidor.'
      });
    } finally {
      setIsTriggeringAgentTest(false);
    }
  };

  // Lista de impressoras cadastradas na loja
  const configuredList = React.useMemo(() => {
    try {
      if (storeInfo?.configuredPrinters) {
        const parsed = typeof storeInfo.configuredPrinters === 'string'
          ? JSON.parse(storeInfo.configuredPrinters)
          : storeInfo.configuredPrinters;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return [
      { id: 'p1', name: 'Impressora Térmica 80mm', model: 'Térmica 80mm', isOrderPrinter: true }
    ];
  }, [storeInfo?.configuredPrinters]);

  const handleFixEpsonDefault = async () => {
    setIsSaving(true);
    const defaultPrinterName = selectedPrinterName || 'Impressora Térmica 80mm';
    const ip = networkIp.trim();
    const port = networkPort || 9100;

    setSelectedPrinterName(defaultPrinterName);
    setCustomPrinterInput(defaultPrinterName);
    if (ip) setNetworkPrinterConfig(ip, port);
    setLocalCaixaPrinter(defaultPrinterName);

    const updatedPrinters = [
      { id: 'p1', name: defaultPrinterName, model: 'Térmica 80mm', isOrderPrinter: true, ...(ip ? { ip } : {}) }
    ];

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({
          printerConnectionType: ip ? 'network' : 'windows',
          networkPrinterIp: ip,
          networkPrinterPort: port,
          caixaPrinterName: defaultPrinterName,
          preferredPrinterName: defaultPrinterName,
          configuredPrinters: updatedPrinters,
          autoPrintOrdersOnCaixa: true
        });
      }
      setIsAutoPrint(true);
      localStorage.setItem('donamara_auto_print_caixa', 'true');

      setFeedbackMsg({
        type: 'success',
        text: '✅ Impressora padrão configurada com sucesso para pedidos!'
      });
      setTimeout(() => setFeedbackMsg(null), 8000);
    } catch (e: any) {
      setFeedbackMsg({
        type: 'info',
        text: 'Configurações da impressora salvas no navegador local!'
      });
      setTimeout(() => setFeedbackMsg(null), 8000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNetworkPrinter = async () => {
    const trimmedIp = networkIp.trim();
    if (!trimmedIp) return;

    setIsSaving(true);
    setNetworkPrinterConfig(trimmedIp, networkPort);

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({
          printerConnectionType: 'network',
          networkPrinterIp: trimmedIp,
          networkPrinterPort: networkPort
        });
      }
      setFeedbackMsg({
        type: 'success',
        text: `Impressora de Rede ${trimmedIp}:${networkPort} salva e fixada como padrão do site!`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      setFeedbackMsg({
        type: 'info',
        text: `Impressora de Rede salva localmente no navegador deste computador como ${trimmedIp}:${networkPort}.`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNetworkIp = async () => {
    const trimmedIp = networkIp.trim();
    if (!trimmedIp) return;

    setIsTestingNetIp(true);
    try {
      const res = await testNetworkPrinterIp(trimmedIp, networkPort);
      setFeedbackMsg({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Falha ao conectar no IP da impressora'
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } finally {
      setIsTestingNetIp(false);
    }
  };

  const handleOpenCashDrawer = async () => {
    setIsTestingDrawer(true);
    try {
      const res = await openCashDrawer(networkIp, networkPort);
      setFeedbackMsg({
        type: res.success ? 'success' : 'info',
        text: res.success
          ? 'Comando de abertura enviado com sucesso para a impressora! A trava da gaveta deve se soltar.'
          : `Aviso: ${res.message}. Certifique-se de que o cabo RJ-11 da gaveta está conectado na porta DK atrás da impressora.`
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Falha ao acionar comando de abertura da gaveta'
      });
      setTimeout(() => setFeedbackMsg(null), 7000);
    } finally {
      setIsTestingDrawer(false);
    }
  };

  const handleSavePrinterChoice = async (nameToSave: string) => {
    const trimmed = nameToSave.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setLocalCaixaPrinter(trimmed);
    setSelectedPrinterName(trimmed);

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({ 
          printerConnectionType: 'windows',
          caixaPrinterName: trimmed 
        });
      }
      setFeedbackMsg({
        type: 'success',
        text: `Impressora "${trimmed}" fixada com sucesso para esta estação do Caixa!`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      setFeedbackMsg({
        type: 'info',
        text: `Impressora salva localmente no computador do Caixa como "${trimmed}".`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSaving(false);
      setIsEditingCustom(false);
    }
  };

  const handleToggleAutoPrint = async (enabled: boolean) => {
    setIsAutoPrint(enabled);
    localStorage.setItem('donamara_auto_print_caixa', String(enabled));

    try {
      if (onUpdateStoreInfo) {
        await onUpdateStoreInfo({ autoPrintOrdersOnCaixa: enabled });
      }
      setFeedbackMsg({
        type: 'success',
        text: enabled 
          ? 'Impressão automática de novos pedidos ATIVADA! Novos pedidos serão impressos no Caixa.' 
          : 'Impressão automática desativada. Os pedidos poderão ser impressos manualmente no botão Imprimir.'
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (e) {}
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const sample = createSampleOrder(storeInfo);
      sample.customerName = 'TESTE CAIXA';
      sample.id = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
      
      const res = await printReceipt(sample, storeInfo);
      setFeedbackMsg({
        type: 'success',
        text: `Cupom de teste enviado para a impressora [${activePrinter.name}] (${
          res === 'network-ip' ? 'via Rede TCP/IP Direta' :
          res === 'webserial' ? 'via USB Direto' : 'via Diálogo do Navegador'
        }).`
      });
      setTimeout(() => setFeedbackMsg(null), 6000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Erro ao testar impressão: ${err?.message || 'Falha no envio'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectSerial = async () => {
    if (isSerialConnected) {
      await disconnectWebSerialPrinter();
      setIsSerialConnected(false);
      setFeedbackMsg({ type: 'info', text: 'Conexão USB direta desconectada. O sistema voltará ao modo padrão.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      return;
    }

    const res = await connectWebSerialPrinter();
    if (res.success) {
      setIsSerialConnected(true);
      setFeedbackMsg({ type: 'success', text: res.message });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border-2 border-orange-300/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-orange-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                Estação de Impressão do Caixa
              </h3>
              <span className="bg-orange-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Impressora Fixa
              </span>
              {isCaixaUser && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Laptop className="w-2.5 h-2.5" /> Estação: caixa@donamara.com.br
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              Defina exatamente para qual impressora os pedidos do site serão enviados, sem risco de confusão na hora de imprimir.
            </p>
          </div>
        </div>

        {/* Status Atual e Botão de Teste Rápido */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Emite um cupom de teste agora para conferir a impressora física"
          >
            <Printer className="w-3.5 h-3.5 text-orange-400" />
            <span>{isTesting ? 'Imprimindo...' : 'Testar Impressão Agora'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex flex-col gap-2 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
          feedbackMsg.type === 'error' ? 'bg-red-50 text-red-900 border border-red-300' :
          'bg-blue-100 text-blue-800 border border-blue-300'
        }`}>
          <div className="flex items-start gap-2.5">
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />}
            <span className="leading-relaxed">{feedbackMsg.text}</span>
          </div>

          {/* Botão de resolução instantânea quando ocorre Timeout em IP de Rede Local */}
          {feedbackMsg.type === 'error' && (feedbackMsg.text.includes('Tempo limite esgotado') || feedbackMsg.text.includes('192.168.') || feedbackMsg.text.includes('Driver Windows')) && (
            <div className="mt-1 pt-2.5 border-t border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-white/90 p-2.5 rounded-lg">
              <div className="text-[11px] text-stone-700 font-semibold leading-snug">
                💡 <strong>Solução para Impressão Automática no Caixa:</strong> Como o site roda na nuvem e a impressora está no IP local da sua loja (<code>{networkIp}</code>), altere para <strong>"Driver Windows / USB Local"</strong> para que seu computador no caixa envie os pedidos automaticamente sem falhas!
              </div>
              <button
                type="button"
                onClick={async () => {
                  setConnectionType('windows');
                  if (onUpdateStoreInfo) {
                    await onUpdateStoreInfo({ printerConnectionType: 'windows' });
                  }
                  setFeedbackMsg({
                    type: 'success',
                    text: '✅ Modo alterado para "Driver Windows / USB Local"! Agora todos os novos pedidos do site serão impressos automaticamente pelo seu computador no caixa.'
                  });
                  setTimeout(() => setFeedbackMsg(null), 8000);
                }}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shrink-0 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Mudar para Driver Windows Agora</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Banner Informativo de Impressão Sem Diálogo (0 Cliques) */}
      <div className="bg-amber-50/90 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-600 fill-amber-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-950 font-black">Como imprimir sem precisar clicar no botão "Imprimir" (0 Cliques):</strong><br />
            Para que o Google Chrome envie a impressão direto para a impressora e feche a janela sozinho em meio segundo, baixe o atalho do Windows e abra o painel por ele.
          </div>
        </div>
        <button
          type="button"
          onClick={downloadChromeKioskShortcut}
          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar Atalho Sem Diálogo (.bat)</span>
        </button>
      </div>

      {/* Banner de Definição Rápida EPSON 192.168.0.90 Oficial */}
      <div className="bg-emerald-50 border-2 border-emerald-300 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
            🖨️
          </div>
          <div className="text-xs text-emerald-950 leading-relaxed">
            <div className="font-black text-sm text-emerald-900 flex items-center gap-2 flex-wrap">
              <span>Impressora Oficial de Pedidos: EPSON (IP 192.168.0.90)</span>
              <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">
                Elgin i9 Ignorada
              </span>
            </div>
            <p className="text-emerald-800 text-[11px] mt-0.5">
              O sistema foi configurado para direcionar todos os novos pedidos exclusivamente para a <strong>EPSON</strong> no IP <strong>192.168.0.90</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFixEpsonDefault}
          disabled={isSaving}
          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          title="Garante que a EPSON (192.168.0.90) seja a impressora padrão oficial e ignora a Elgin i9"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Aplicando...' : 'Reaplicar EPSON (192.168.0.90)'}</span>
        </button>
      </div>

      {/* Bloco Dedicado: Agente Windows de Segundo Plano (Disparo Instantâneo para Smartphone) */}
      <div className={`p-4 rounded-xl border-2 transition-all shadow-xs ${
        agentStatus.isOnline
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300'
          : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
              agentStatus.isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              <Terminal className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-stone-900">
                  Agente Windows de Segundo Plano (Smartphone ➔ EPSON)
                </span>
                {agentStatus.isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ONLINE ({agentStatus.hostname || 'Caixa PC'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    NÃO DETECTADO
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                {agentStatus.isOnline ? (
                  <>
                    O agente está conectado e rodando em segundo plano no Windows (última resposta há{' '}
                    <strong>{agentStatus.secondsAgo ?? 0}s</strong>). Qualquer pedido feito pelo smartphone do cliente é impresso{' '}
                    <strong>instantaneamente</strong>, mesmo com o navegador minimizado ou fechado!
                  </>
                ) : (
                  <>
                    Garante que pedidos do <strong>smartphone</strong> saiam na EPSON na hora, mesmo se o Chrome estiver minimizado ou em segundo plano.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Botões de Ação do Agente */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={downloadWindowsAgentBat}
              className="px-3.5 py-2 bg-stone-900 hover:bg-black active:scale-[0.98] text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Baixar o arquivo .bat executável do Agente Windows"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Baixar Agente Windows (.bat)</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerAgentTest}
              disabled={isTriggeringAgentTest}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Envia um pedido de teste para a fila do agente imprimir na EPSON"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isTriggeringAgentTest ? 'Enviando...' : 'Testar Impressão Agente'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAgentDetails(!showAgentDetails)}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 rounded-xl transition-all cursor-pointer"
              title="Instruções de instalação e uso do Agente"
            >
              {showAgentDetails ? <ChevronUp className="w-4 h-4" /> : <HelpCircle className="w-4 h-4 text-stone-500" />}
            </button>
          </div>
        </div>

        {/* Detalhes e Guia Passo a Passo do Agente */}
        {showAgentDetails && (
          <div className="mt-3 pt-3 border-t border-stone-200/60 text-xs text-stone-800 space-y-2">
            <div className="font-bold text-stone-900">Como funciona o Agente Windows (Opção 2):</div>
            <ol className="list-decimal list-inside space-y-1 text-stone-700">
              <li>Clique em <strong>"Baixar Agente Windows (.bat)"</strong> acima e salve no computador do Caixa.</li>
              <li>Dê <strong>dois cliques</strong> no arquivo <code>Iniciar-Agente-DonaMara.bat</code> baixado.</li>
              <li>Uma janela de comando se abrirá e exibirá <code>[Conectado!] Monitorando pedidos do smartphone em segundo plano...</code></li>
              <li>Você pode <strong>minimizar a janela</strong>! Ela continuará vigiando o servidor 24 horas por dia.</li>
              <li>(Dica) Para iniciar sozinho ao ligar o computador: Pressione <code>Win + R</code>, digite <code>shell:startup</code> e cole um atalho do arquivo <code>.bat</code> lá dentro.</li>
            </ol>
            {agentStatus.isOnline && (
              <div className="mt-2 p-2 bg-emerald-100/60 rounded-lg text-emerald-900 font-mono text-[11px] flex items-center justify-between">
                <span>Total de cupons impressos pelo agente: <strong>{agentStatus.totalPrinted || 0}</strong></span>
                <span>Fila pendente: <strong>{agentStatus.pendingCount || 0}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 bg-white/70 p-1.5 rounded-xl border border-orange-200">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setConnectionType('network');
              if (onUpdateStoreInfo) onUpdateStoreInfo({ printerConnectionType: 'network' });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              connectionType === 'network'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Impressora de Rede (por IP)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConnectionType('windows');
              if (onUpdateStoreInfo) onUpdateStoreInfo({ printerConnectionType: 'windows' });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              connectionType === 'windows'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Driver Windows / USB Local</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-stone-700 hidden sm:flex items-center gap-1">
          <span>Destino Atual:</span>
          <span className="text-orange-700 font-mono bg-orange-100/70 px-2 py-0.5 rounded-md">
            {activePrinter.name}
          </span>
        </div>
      </div>

      {/* Conteúdo do Modo: Rede por IP */}
      {connectionType === 'network' ? (
        <div className="bg-white/95 p-4 rounded-xl border border-orange-200 shadow-xs space-y-3">
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 space-y-1.5">
            <div className="font-black text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Por que a impressora pode ignorar o IP e imprimir na padrão do Windows?</span>
            </div>
            <p className="leading-relaxed">
              O Google Chrome no Windows envia os trabalhos de impressão para a <strong>Impressora Padrão do Windows</strong>. Se você preencheu o IP acima, o Windows precisa ter a porta TCP/IP instalada para redirecionar o tráfego corretamente para a impressora térmica.
            </p>
            <p className="font-bold text-amber-900">
              👉 Clique no botão <strong>"Instalar Porta TCP/IP no Windows (.bat)"</strong> abaixo para que o Windows reconheça este IP e o defina como padrão.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-600" />
                <span>Endereço IP da Impressora de Cupom na Rede:</span>
                <span className="text-orange-600 font-mono">[{networkIp}:{networkPort}]</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.200 ou 192.168.0.150"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                  className="w-full sm:w-64 font-mono font-bold bg-stone-50 border border-orange-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-orange-500 outline-none"
                />

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-500">Porta:</span>
                  <input
                    type="number"
                    value={networkPort}
                    onChange={(e) => setNetworkPort(Number(e.target.value) || 9100)}
                    className="w-20 font-mono font-bold bg-stone-50 border border-stone-300 rounded-xl px-2 py-2 text-xs text-stone-900 text-center focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveNetworkPrinter}
                    disabled={isSaving || !networkIp.trim()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar e Fixar como Padrão</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestNetworkIp}
                    disabled={isTestingNetIp || !networkIp.trim()}
                    className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <Wifi className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isTestingNetIp ? 'Conectando...' : 'Testar Conexão IP'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Toggle de Auto-Impressão */}
            <div className="shrink-0 p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-black text-stone-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  Impressão Automática
                </span>
                <span className="text-[10px] text-stone-500">Imprimir na hora ao chegar pedido</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoPrint}
                  onChange={(e) => handleToggleAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>

          {/* Ações e Ferramentas para Impressora de Rede */}
          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  downloadWindowsNetworkPrinterScript(
                    networkIp || '192.168.1.200',
                    selectedPrinterName || 'Impressora Cupom Rede'
                  );
                }}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Gera um instalador .bat para configurar a porta de rede Standard TCP/IP no Windows"
              >
                <Download className="w-3.5 h-3.5 text-orange-600" />
                <span>Instalar Porta TCP/IP no Windows (.bat)</span>
              </button>

              <button
                type="button"
                onClick={downloadChromeKioskShortcut}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Baixa um atalho do Windows para abrir o sistema em modo direto sem diálogo de confirmação"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Atalho Sem Diálogo (--kiosk-printing)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-stone-600 hover:text-stone-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Como funciona a impressora por IP</span>
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        /* Conteúdo do Modo: Driver Windows / USB Local */
        <div className="bg-white/90 p-4 rounded-xl border border-orange-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-black text-stone-800 mb-1 flex items-center gap-1.5">
                <span>Impressora de Cupom Selecionada para Este Computador:</span>
                <span className="text-orange-600 font-bold font-mono">[{activePrinter.name}]</span>
              </label>

              {!isEditingCustom ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={selectedPrinterName}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsEditingCustom(true);
                      } else {
                        handleSavePrinterChoice(e.target.value);
                      }
                    }}
                    className="w-full sm:w-80 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                  >
                    <optgroup label="Impressoras Cadastradas">
                      {configuredList.map((p: any) => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.model || 'Térmica'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Outras Opções">
                      <option value="custom">✏️ Digitar outro nome exato da impressora no Windows...</option>
                    </optgroup>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsEditingCustom(true)}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Alterar Nome / Digitar Manual
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Elgin i9, EPSON TM-T20, Bematech..."
                    value={customPrinterInput}
                    onChange={(e) => setCustomPrinterInput(e.target.value)}
                    className="flex-1 max-w-md bg-stone-50 border border-orange-400 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSavePrinterChoice(customPrinterInput)}
                      disabled={isSaving || !customPrinterInput.trim()}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar e Fixar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingCustom(false)}
                      className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle de Auto-Impressão */}
            <div className="shrink-0 p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-black text-stone-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  Impressão Automática
                </span>
                <span className="text-[10px] text-stone-500">Imprimir na hora ao chegar pedido</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoPrint}
                  onChange={(e) => handleToggleAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>

          {/* Garantia Anti-Erro & Ações */}
          <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Opção Web Serial Direto */}
              {isWebSerialSupported() && (
                <button
                  type="button"
                  onClick={handleConnectSerial}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSerialConnected
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  }`}
                  title="Conecta o cabo USB/Serial diretamente à impressora térmica, imprimindo sem abrir telas"
                >
                  <Usb className="w-3.5 h-3.5 text-stone-600" />
                  <span>{isSerialConnected ? 'Cabo USB Conectado (ESC/POS Direto)' : 'Conectar Cabo USB Direto'}</span>
                </button>
              )}

              {/* Download do Atalho Kiosk do Windows */}
              <button
                type="button"
                onClick={downloadChromeKioskShortcut}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Baixa um atalho pronto do Windows para abrir o sistema com impressão direta sem janela de diálogo"
              >
                <Download className="w-3.5 h-3.5 text-orange-600" />
                <span>Baixar Atalho Windows Sem Diálogo (--kiosk-printing)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-stone-600 hover:text-stone-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Como garantir que a operadora nunca erre a impressora</span>
              {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Guia Rápido Passo-a-Passo */}
      {showInstructions && (
        <div className="bg-white p-4 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-3 animate-in fade-in duration-200">
          <div className="font-bold text-stone-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-600" />
            <span>Vantagens e Como Configurar a Impressora de Rede por IP:</span>
          </div>

          <ol className="list-decimal pl-5 space-y-2 text-stone-600 leading-relaxed">
            <li>
              <strong>Mais Assertivo (Por IP):</strong> Com o IP definido (ex: <code>{networkIp}</code> na porta <code>{networkPort}</code>), os pedidos do site são enviados diretamente ao endereço fixo da impressora, eliminando qualquer risco da operadora se confundir com outras impressoras instaladas no computador.
            </li>
            <li>
              <strong>Porta Standard TCP/IP no Windows:</strong> Caso queira que o próprio Windows também imprima sempre nela, clique em <em>"Instalar Porta TCP/IP no Windows (.bat)"</em>. O script configura a porta de rede no Windows automaticamente.
            </li>
            <li>
              <strong>Aviso Visual no Cupom:</strong> O sistema coloca no cabeçalho do cupom impresso a identificação <code>🖨️ DESTINO: IMPRESSORA DE REDE ({networkIp}:{networkPort})</code>.
            </li>
            <li>
              <strong>Modo Sem Janelas (Kiosk Printing):</strong> Com a impressão automática ligada e o atalho Kiosk, ao chegar um novo pedido ele é impresso diretamente sem abrir caixas de diálogo na tela.
            </li>
          </ol>
        </div>
      )}

      {/* Seção de Separação Total entre Impressão de TOTEM e IMPRESSÃO DE MESA / WINDOWS */}
      <div className="bg-white/95 border border-orange-200 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-600" />
            <h4 className="text-xs sm:text-sm font-black text-stone-900">
              Formatação de Cupom Separada (Totem vs. Consumo na Mesa / Caixa)
            </h4>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            Configurações Decopladas
          </span>
        </div>

        <p className="text-xs text-stone-600">
          Altere as configurações de vias, corte e tamanho em branco do <strong>Consumo na Mesa / Caixa</strong> sem afetar nada do <strong>Totem</strong> que já está configurado.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: TOTEM */}
          <div className="bg-amber-50/70 border border-amber-300/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                📱 1. Impressora do TOTEM (Térmica Direta)
              </span>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                Autoatendimento
              </span>
            </div>

            {/* Vias Totem */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Número de Vias:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateStoreInfo?.({ totemPrinterCopies: 2 })}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    (storeInfo?.totemPrinterCopies ?? 2) === 2
                      ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  2 Vias (Cliente + Balcão) [Padrão]
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStoreInfo?.({ totemPrinterCopies: 1 })}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    storeInfo?.totemPrinterCopies === 1
                      ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  1 Via Única
                </button>
              </div>
            </div>

            {/* Corte Totem */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Guilhotina / Corte:</label>
              <select
                value={storeInfo?.totemPrinterCutMode || 'partial'}
                onChange={(e) => onUpdateStoreInfo?.({ totemPrinterCutMode: e.target.value as any })}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="partial">1 Picote Parcial (Recomendado)</option>
                <option value="full">1 Corte Total</option>
                <option value="none">Sem Corte no Código</option>
              </select>
            </div>

            {/* Espaço no final Totem */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Espaço em Branco no Final (Avanço):</label>
              <select
                value={storeInfo?.totemPrinterBottomSpaceCm ?? 2.5}
                onChange={(e) => onUpdateStoreInfo?.({ totemPrinterBottomSpaceCm: Number(e.target.value) })}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value={1.5}>1.5 cm (Muito Curto)</option>
                <option value={2.5}>2.5 cm (Ideal para Totem)</option>
                <option value={4.0}>4.0 cm (Médio)</option>
                <option value={6.0}>6.0 cm (Longo)</option>
              </select>
            </div>
          </div>

          {/* Card 2: WINDOWS / CONSUMO NA MESA */}
          <div className="bg-blue-50/70 border border-blue-300/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/80">
              <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                🖥️ 2. Impressora MESA / CAIXA (Windows / Rede IP 192.168.0.90)
              </span>
              <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                Consumo na Mesa
              </span>
            </div>

            {/* Vias Mesa/Windows */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Número de Vias:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateStoreInfo?.({ windowsPrinterCopies: 1 })}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    storeInfo?.windowsPrinterCopies === 1
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  1 Via Única
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStoreInfo?.({ windowsPrinterCopies: 2 })}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    (storeInfo?.windowsPrinterCopies ?? 2) === 2
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  2 Vias (Cliente + Atendente)
                </button>
              </div>
            </div>

            {/* Corte Mesa/Windows */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Guilhotina / Corte:</label>
              <select
                value={storeInfo?.windowsPrinterCutMode || 'partial'}
                onChange={(e) => onUpdateStoreInfo?.({ windowsPrinterCutMode: e.target.value as any })}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="partial">1 Picote Parcial (Recomendado)</option>
                <option value="full">1 Corte Total</option>
                <option value="none">Sem Corte no Código</option>
              </select>
            </div>

            {/* Espaço no final Mesa/Windows */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Espaço em Branco no Final (Avanço p/ Observações):</label>
              <select
                value={storeInfo?.windowsPrinterBottomSpaceCm ?? 8.0}
                onChange={(e) => onUpdateStoreInfo?.({ windowsPrinterBottomSpaceCm: Number(e.target.value) })}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value={4.0}>4.0 cm (Padrão Curto)</option>
                <option value={6.0}>6.0 cm (Médio)</option>
                <option value={8.0}>8.0 cm (Ideal / 8 Centímetros p/ Observações)</option>
                <option value={10.0}>10.0 cm (Extra Amplo)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Dedicada: Gaveta de Dinheiro do Caixa (Conector RJ-11 / Impressora Térmica) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-stone-900">
                  Gaveta de Dinheiro do Caixa (Conector RJ-11 / Impressora Térmica)
                </span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Conexão Direta na Impressora
                </span>
              </div>
              <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                A gaveta de dinheiro <strong>não se conecta diretamente ao computador</strong> (ela não tem porta USB). Ela se liga diretamente na porta traseira da impressora de cupom (porta identificada como <strong>"DK"</strong>, <strong>"Drawer"</strong> ou ícone de gaveta). É a impressora que manda o pulso elétrico para a gaveta abrir!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleOpenCashDrawer}
              disabled={isTestingDrawer}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
              title="Envia comando ESC/POS com pulso elétrico para a porta RJ-11 da impressora abrir a gaveta"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>{isTestingDrawer ? 'Enviando Pulso...' : '⚡ Testar Abertura da Gaveta'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDrawerGuide(!showDrawerGuide)}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 rounded-xl transition-all cursor-pointer"
              title="Como configurar no Windows para abrir automaticamente"
            >
              {showDrawerGuide ? <ChevronUp className="w-4 h-4" /> : <HelpCircle className="w-4 h-4 text-emerald-700" />}
            </button>
          </div>
        </div>

        {/* Guia Didático de Configuração da Gaveta */}
        {showDrawerGuide && (
          <div className="mt-3 pt-3 border-t border-emerald-200/80 text-xs text-stone-800 space-y-3 bg-white/90 p-4 rounded-xl">
            <div className="font-black text-stone-900 flex items-center gap-1.5 text-xs sm:text-sm">
              <span>💡 Como funciona e como configurar para abrir automaticamente no Windows:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
              <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                <strong className="text-emerald-950 font-bold block mb-1">1. Conexão Física (Cabo RJ-11):</strong>
                O conector da gaveta parece um plugue de telefone. Conecte-o na parte de trás da impressora térmica (porta <strong>"DK" - Drawer Kick-out</strong>). A gaveta possui uma mola de empuxo e uma trava acionada por eletroímã (solenoide de 12V ou 24V).
              </div>

              <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                <strong className="text-emerald-950 font-bold block mb-1">2. Quem manda a ordem para abrir?</strong>
                O <strong>driver do Windows</strong> ou o <strong>próprio sistema</strong>! Ao imprimir o cupom, um comando envia o sinal elétrico para a porta RJ-11, liberando a mola da gaveta instantaneamente.
              </div>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200 space-y-2 text-[11px]">
              <strong className="text-stone-900 font-bold block">Passo a passo no Windows para abrir automaticamente ao imprimir qualquer cupom:</strong>
              <ol className="list-decimal pl-5 space-y-1.5 text-stone-700">
                <li>No computador do Caixa, abra o <strong>Painel de Controle ➔ Dispositivos e Impressoras</strong>.</li>
                <li>Clique com o <strong>botão direito</strong> na impressora EPSON / Elgin do caixa e escolha <strong>Propriedades da Impressora</strong>.</li>
                <li>Acesse a aba <strong>Configurações do Dispositivo</strong> (ou <em>Preferências de Impressão ➔ Recursos Avançados / Cash Drawer</em>).</li>
                <li>Procure pelo item <strong>"Gaveta de Dinheiro" (Cash Drawer)</strong>.</li>
                <li>Altere para <strong>"Abrir antes de imprimir"</strong> ou <strong>"Abrir após imprimir"</strong> e clique em <strong>Aplicar / OK</strong>.</li>
                <li>Pronto! Sempre que o Caixa imprimir uma venda, a gaveta abrirá sozinha.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Seção Dedicada: Aviso Sonoro ao Imprimir (Epson TM-T20X e Computador) */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-300 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-stone-900">
                  Aviso Sonoro ao Imprimir Pedido (Epson TM-T20X)
                </span>
                <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full border border-blue-300">
                  Áudio Ativo no Sistema
                </span>
              </div>
              <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                A <strong>Epson TM-T20X</strong> não tem alto-falante interno de fábrica (apenas o som mecânico da guilhotina cortando o papel). Por isso, o sistema DONAMARA agora toca automaticamente um <strong>aviso sonoro nítido (bip duplo de restaurante)</strong> pelas caixas de som do computador a cada impressão!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                playPrintBeepSound();
                setFeedbackMsg({
                  type: 'success',
                  text: 'Som de impressão tocado! Este mesmo alerta sonoro toca a cada impressão disparada no Caixa.'
                });
                setTimeout(() => setFeedbackMsg(null), 5000);
              }}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2"
              title="Testar o som que o computador emite a cada cupom impresso"
            >
              <Volume2 className="w-4 h-4 text-amber-300" />
              <span>🔊 Testar Som de Impressão</span>
            </button>
          </div>
        </div>

        <div className="bg-white/80 p-3.5 rounded-xl border border-blue-200 text-[11px] text-stone-700 space-y-2 leading-relaxed">
          <strong className="text-blue-950 font-bold block text-xs">
            Como ter aviso sonoro na Epson TM-T20X (Opções disponíveis):
          </strong>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
              <span className="font-bold text-blue-950 block mb-0.5">Opção 1: Som pelo Computador (Já Ativo e Gratuito)</span>
              O sistema dispara um chime sonoro pelo alto-falante do PC do caixa a cada impressão. Você pode ajustar o volume diretamente nas caixinhas de som do computador, garantindo som alto sem conflito com a gaveta de dinheiro.
            </div>
            <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
              <span className="font-bold text-blue-950 block mb-0.5">Opção 2: Buzzer Físico Epson (OT-BZ20)</span>
              A Epson comercializa um acessório chamado <strong>Buzzer OT-BZ20</strong>. Ele se conecta na porta traseira RJ-11 da impressora. <em>Atenção:</em> se a gaveta de dinheiro já estiver ocupando o plug RJ-11, é necessário um adaptador divisor Y de cabo RJ-11.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
