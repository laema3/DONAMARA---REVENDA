import { Order, StoreInfo, useStore } from '../store/useStore';
import { formatDateBR } from '../lib/utils';

/**
 * Utilitário de impressão de cupom térmico (58mm e 80mm).
 * Gera estritamente 1 via única limpa e centralizada com avanço e picote de corte.
 */

export interface ActivePrinterInfo {
  name: string;
  model: string;
  isConfigured: boolean;
  isNetwork?: boolean;
  ip?: string;
  port?: number;
}

export const getNetworkPrinterConfig = (storeInfo: StoreInfo): { ip: string; port: number; enabled: boolean } => {
  let localIp = '';
  let localPort = '';
  try {
    if (typeof window !== 'undefined') {
      localIp = localStorage.getItem('donamara_network_printer_ip') || '';
      localPort = localStorage.getItem('donamara_network_printer_port') || '';
    }
  } catch (e) {}

  const ip = (localIp || storeInfo?.networkPrinterIp || '').trim();
  const port = Number(localPort) || Number(storeInfo?.networkPrinterPort) || 9100;
  const enabled = storeInfo?.printerConnectionType === 'network' || !storeInfo?.printerConnectionType;

  return { ip, port, enabled };
};

export const setLocalNetworkPrinter = (ip: string, port: number = 9100) => {
  try {
    if (typeof window !== 'undefined') {
      if (ip && ip.trim()) {
        localStorage.setItem('donamara_network_printer_ip', ip.trim());
      } else {
        localStorage.removeItem('donamara_network_printer_ip');
      }
      if (port) {
        localStorage.setItem('donamara_network_printer_port', String(port));
      }
    }
  } catch (e) {}
};

export const setNetworkPrinterConfig = setLocalNetworkPrinter;

export const testNetworkPrinterIp = async (ip: string, port: number = 9100): Promise<{ success: boolean; message: string; code?: string }> => {
  try {
    const res = await fetch('/api/printer/test-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `Não foi possível conectar na impressora: ${err?.message || 'Servidor inalcançável'}`
    };
  }
};

export const printViaNetworkIp = async (order: Order, storeInfo: StoreInfo): Promise<{ success: boolean; message?: string }> => {
  const { ip, port } = getNetworkPrinterConfig(storeInfo);
  if (!ip) return { success: false, message: 'IP da impressora não definido.' };

  const b64 = getEscPosReceiptBase64(order, storeInfo);

  // 1. Tenta envio direto pelo backend (Socket TCP porta 9100)
  try {
    const res = await fetch('/api/printer/network-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, escPosBase64: b64 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message };
      }
    }
  } catch (err) {
    console.warn('[Network Print] Envio TCP via backend falhou:', err);
  }

  return { success: false, message: 'Conexão direta não alcançada' };
};

export const downloadWindowsNetworkPrinterScript = (ip: string, portOrPrinterName: number | string = 9100, customPrinterName?: string) => {
  const safeIp = (ip || '192.168.0.100').trim();
  const safePort = typeof portOrPrinterName === 'number' ? portOrPrinterName : 9100;
  const sanitizedIpName = safeIp.replace(/\./g, '_');
  const batContent = `@echo off
title DONAMARA - Criar Porta TCP/IP ${safeIp} no Windows
cls
echo ======================================================================
echo    DONAMARA - CONFIGURADOR DE PORTA TCP/IP DA IMPRESSORA DE REDE
echo ======================================================================
echo.
echo Endereco IP: ${safeIp}
echo Porta TCP: ${safePort}
echo.
echo [!] IMPORTANTE: Certifique-se de executar este arquivo como Administrador!
echo.
pause
echo.
echo [1/2] Criando Porta TCP/IP IP_${safeIp}...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-PrinterPort -Name 'IP_${safeIp}' -PrinterHostAddress '${safeIp}' -PortNumber ${safePort} -ErrorAction SilentlyContinue"
echo.
echo [2/2] Verificando se a porta 'IP_${safeIp}' foi criada...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PrinterPort -Name 'IP_${safeIp}' | Select-Object Name, PrinterHostAddress, PortNumber"
echo.
echo ======================================================================
echo PORTA IP_${safeIp} CONFIGURADA COM SUCESSO!
echo.
echo INSTRUCOES FINAIS PARA VINCULAR SUA IMPRESSORA EPSON NO WINDOWS:
echo.
echo 1. Abra o "Painel de Controle" ^> "Dispositivos e Impressoras".
echo 2. Clique com o botao direito na sua Impressora Epson / Termica.
echo 3. Escolha "Propriedades da Impressora" e vá na aba "Portas".
echo 4. Marque a caixinha da porta "IP_${safeIp}" e clique em "Aplicar".
echo 5. Clique com o botao direito na impressora e escolha "Definir como Padrão".
echo ======================================================================
echo.
pause
exit
`;

  const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Criar_Porta_Rede_${sanitizedIpName}.bat`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 1000);
};

export const fetchPrinterAgentStatus = async (): Promise<{
  isOnline: boolean;
  lastSeen?: number;
  secondsAgo?: number;
  hostname?: string;
  version?: string;
  totalPrinted?: number;
  pendingCount?: number;
  configuredPrinter?: string;
}> => {
  try {
    const res = await fetch('/api/printer-agent/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { isOnline: false };
};

export const triggerPrinterAgentTestJob = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/printer-agent/test-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: 'Falha ao solicitar cupom de teste' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Erro de conexão' };
  }
};

export const downloadWindowsAgentBat = () => {
  const link = document.createElement('a');
  link.href = '/api/printer-agent/download/bat';
  link.download = 'Iniciar-Agente-DonaMara.bat';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try { document.body.removeChild(link); } catch (e) {}
  }, 500);
};

export const resolveItemCode = (item: any): string => {
  if (item?.externalId && String(item.externalId).trim()) return String(item.externalId).trim();
  if (item?.code && String(item.code).trim()) return String(item.code).trim();
  try {
    const products = useStore.getState?.()?.products;
    if (Array.isArray(products) && item?.productId) {
      const p = products.find(prod => prod.id === item.productId);
      if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
      if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
    }
  } catch (e) {}
  return '';
};

export const resolveAddonCode = (addon: any): string => {
  if (!addon) return '';
  if (addon?.externalId && String(addon.externalId).trim()) return String(addon.externalId).trim();
  if (addon?.code && String(addon.code).trim()) return String(addon.code).trim();
  try {
    const products = useStore.getState?.()?.products;
    if (Array.isArray(products)) {
      if (addon?.productId) {
        const p = products.find(prod => prod.id === addon.productId);
        if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
        if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
      }
      if (addon?.name) {
        const cleanName = String(addon.name).trim().toLowerCase();
        const p = products.find(prod => prod.name && prod.name.trim().toLowerCase() === cleanName);
        if (p?.externalId && String(p.externalId).trim()) return String(p.externalId).trim();
        if (p && (p as any).code && String((p as any).code).trim()) return String((p as any).code).trim();
      }
    }
  } catch (e) {}
  return '';
};

export type OrderModality = 'DELIVERY' | 'RETIRADA' | 'CONSUMO NA LOJA' | 'TOTEM';

export const resolveOrderModality = (order: any): OrderModality => {
  if (!order) return 'RETIRADA';
  const type = String(order.type || '').toLowerCase();
  const deliveryType = String(order.deliveryType || '').toLowerCase();
  const mode = String(order.mode || '').toLowerCase();
  const custName = String(order.customerName || '').toLowerCase();

  // 1. TOTEM
  if (type === 'kiosk' || mode === 'kiosk' || custName.includes('totem')) {
    return 'TOTEM';
  }

  // 2. CONSUMO NA LOJA (Mesa ou consumo local)
  if (order.tableNumber || type === 'dine_in' || deliveryType === 'dine_in') {
    return 'CONSUMO NA LOJA';
  }

  // 3. DELIVERY
  if (
    deliveryType === 'delivery' || 
    type === 'delivery' || 
    (order.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
    Boolean(order.deliveryNeighborhood)
  ) {
    return 'DELIVERY';
  }

  // 4. RETIRADA
  return 'RETIRADA';
};

export const getActiveOrderPrinter = (storeInfo: StoreInfo): ActivePrinterInfo => {
  const netConfig = getNetworkPrinterConfig(storeInfo);
  const isNetworkPreferred = storeInfo?.printerConnectionType === 'network' || (!storeInfo?.printerConnectionType && !!netConfig.ip);

  // Função auxiliar para ignorar a Elgin i9
  const isIgnoredElgin = (name: string) => /elgin/i.test(name || '');

  // 1. Se estiver configurado para impressora de rede por IP
  if (isNetworkPreferred && netConfig.ip) {
    return {
      name: `EPSON (Rede ${netConfig.ip}:${netConfig.port})`,
      model: `Epson Rede TCP/IP Porta ${netConfig.port}`,
      isConfigured: true,
      isNetwork: true,
      ip: netConfig.ip,
      port: netConfig.port
    };
  }

  // 2. Checa se este computador local (estação do caixa) tem impressora fixa definida no navegador (ignorando Elgin)
  try {
    if (typeof window !== 'undefined') {
      const localCaixa = localStorage.getItem('donamara_caixa_printer');
      if (localCaixa && localCaixa.trim() && !isIgnoredElgin(localCaixa)) {
        return { name: localCaixa.trim(), model: 'Térmica (Estação Caixa)', isConfigured: true };
      }
    }
  } catch (e) {}

  // 3. Checa a impressora definida nas configurações da loja especificamente para o Caixa (ignorando Elgin)
  if (storeInfo?.caixaPrinterName && storeInfo.caixaPrinterName.trim() && !isIgnoredElgin(storeInfo.caixaPrinterName)) {
    return { name: storeInfo.caixaPrinterName.trim(), model: 'Térmica (Caixa)', isConfigured: true };
  }

  // 4. Checa impressoras cadastradas na loja marcadas para pedidos (ignorando Elgin e priorizando EPSON)
  try {
    if (storeInfo?.configuredPrinters) {
      const printers = typeof storeInfo.configuredPrinters === 'string' 
        ? JSON.parse(storeInfo.configuredPrinters) 
        : storeInfo.configuredPrinters;
      if (Array.isArray(printers) && printers.length > 0) {
        // Prioridade 1: EPSON configurada para pedidos
        const epsonPrinter = printers.find((p: any) => /epson/i.test(p.name || '') && p.isOrderPrinter !== false);
        if (epsonPrinter && epsonPrinter.name) {
          return { name: epsonPrinter.name.trim(), model: epsonPrinter.model || 'Epson Térmica 80mm', isConfigured: true };
        }
        // Prioridade 2: Qualquer outra impressora que NÃO seja Elgin
        const nonElginOrderPrinter = printers.find((p: any) => p.isOrderPrinter && !isIgnoredElgin(p.name));
        if (nonElginOrderPrinter && nonElginOrderPrinter.name) {
          return { name: nonElginOrderPrinter.name.trim(), model: nonElginOrderPrinter.model || 'Térmica 80mm', isConfigured: true };
        }
      }
    }
  } catch (e) {}

  if (storeInfo?.preferredPrinterName && storeInfo.preferredPrinterName.trim() && !isIgnoredElgin(storeInfo.preferredPrinterName)) {
    return { name: storeInfo.preferredPrinterName.trim(), model: 'Térmica 80mm', isConfigured: true };
  }

  return { 
    name: 'Impressora Térmica Padrão', 
    model: 'Térmica 80mm', 
    isConfigured: false,
    isNetwork: false,
    ip: '',
    port: 9100
  };
};

export const getLocalCaixaPrinter = (): string => {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('donamara_caixa_printer') || '';
    }
  } catch (e) {}
  return '';
};

export const setLocalCaixaPrinter = (printerName: string) => {
  try {
    if (typeof window !== 'undefined') {
      if (printerName && printerName.trim()) {
        localStorage.setItem('donamara_caixa_printer', printerName.trim());
      } else {
        localStorage.removeItem('donamara_caixa_printer');
      }
    }
  } catch (e) {}
};

export const getFullReceiptHTML = (order: Order, storeInfo: StoreInfo, autoPrint: boolean = false): string => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const customerNameStr = order.customerName ? order.customerName.trim().toUpperCase() : 'CLIENTE';
  const orderNumber = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const storeName = (storeInfo?.name || 'DONAMARA - REVENDA').toUpperCase();
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order.items) ? order.items : [];

  const activePrinter = getActiveOrderPrinter(storeInfo);
  const activeOrderPrinterName = activePrinter.name;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>🖨️ DESTINO: ${activeOrderPrinterName.toUpperCase()} | Pedido #${orderNumber}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @page {
      margin: 0 !important;
      size: auto;
    }
    html, body {
      width: 100%;
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: fit-content !important;
      background-color: #fff;
      color: #000;
      font-family: 'Arial Black', Arial, 'Helvetica Neue', Helvetica, 'Courier New', monospace, sans-serif;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }
    .receipt-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0 !important;
      margin: 0 auto !important;
      height: auto !important;
      text-align: center;
    }
    .receipt-box {
      width: 100%;
      max-width: 245px;
      margin: 0 auto !important;
      padding: 2px 6px 4px 6px !important;
      height: auto !important;
      box-sizing: border-box !important;
    }
    .receipt-box-attendant {
      border-top: 1px dashed #000;
      padding-top: 8px !important;
    }
    .via-tag {
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
      padding: 3px 4px;
      margin: 2px 0 6px 0;
      border: 1.5px solid #000;
      text-transform: uppercase;
      border-radius: 3px;
    }
    .via-tag-client {
      background-color: #f3f3f3;
      color: #000;
    }
    .via-tag-attendant {
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cut-separator {
      width: 100%;
      max-width: 270px;
      text-align: center;
      margin: 12px 0 10px 0;
      page-break-after: always !important;
      break-after: page !important;
    }
    .cut-line-dashes {
      font-size: 11px;
      font-weight: 900;
      border-top: 2px dashed #000;
      border-bottom: 2px dashed #000;
      padding: 6px 0;
      letter-spacing: 0.5px;
    }
    .check-box {
      font-family: monospace;
      font-weight: 900;
      margin-right: 2px;
    }
    .box-modality {
      text-align: center;
      margin: 0 0 6px 0;
      font-weight: 900;
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      padding: 6px 4px;
      border-radius: 4px;
      line-height: 1.2;
    }
    .title {
      text-align: center;
      margin: 2px 0 6px 0;
      font-weight: 900;
      font-size: 20px;
      letter-spacing: 1px;
      text-transform: uppercase;
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      padding: 6px 4px;
      border-radius: 4px;
    }
    .customer-order-box {
      margin: 6px 0 8px 0;
      text-align: center;
    }
    .box-client {
      font-size: 15px;
      font-weight: 900;
      line-height: 1.3;
      word-break: break-word;
      color: #fff !important;
      background-color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      text-transform: uppercase;
      padding: 6px 4px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .box-order {
      font-size: 19px;
      font-weight: 900;
      line-height: 1.3;
      color: #fff !important;
      background-color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 7px 4px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .box-delivery-fee {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 900;
      color: #fff !important;
      background-color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 6px 8px;
      border-radius: 4px;
      margin-top: 3px;
    }
    .divider {
      border-top: 2px dashed #000;
      margin: 8px 0;
      width: 100%;
    }
    .divider-solid {
      border-top: 3px solid #000;
      margin: 8px 0;
      width: 100%;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
      font-weight: 900;
      font-size: 14px;
      gap: 6px;
      color: #000;
    }
    .item-name {
      flex: 1;
      word-break: break-word;
      text-align: left;
      font-weight: 900;
    }
    .item-price {
      white-space: nowrap;
      text-align: right;
      font-weight: 900;
    }
    .item-description {
      font-size: 11px;
      font-weight: 300 !important;
      font-style: italic !important;
      color: #333 !important;
      padding-left: 8px;
      margin-top: 1px;
      margin-bottom: 2px;
      line-height: 1.25;
      word-break: break-word;
    }
    .item-code-badge {
      display: inline-block;
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: monospace, Courier, monospace;
      font-size: 11px;
      font-weight: 900;
      padding: 1px 6px;
      border-radius: 3px;
      margin: 1px 0 2px 0;
      letter-spacing: 0.5px;
    }
    .addons {
      font-size: 12px;
      padding-left: 10px;
      color: #000;
      font-weight: 700;
      margin-bottom: 3px;
      word-break: break-word;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      font-size: 17px;
      margin-top: 4px;
      padding: 2px 0;
      color: #000;
    }
    .center {
      text-align: center;
      word-break: break-word;
    }
    .text-sm {
      font-size: 13px;
      font-weight: 700;
    }
    .bold {
      font-weight: 900;
    }
    .other-products-box {
      margin-top: 10px;
      border-top: 1px dashed #000;
      padding-top: 6px;
      text-align: left;
    }
    .other-products-title {
      font-weight: 900;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .other-products-space {
      display: block !important;
      width: 100% !important;
      clear: both !important;
      box-sizing: border-box !important;
    }
    .via-page-break {
      page-break-after: always !important;
      break-after: page !important;
    }
    .html-page-break {
      display: block !important;
      clear: both !important;
      page-break-before: always !important;
      break-before: page !important;
      page-break-after: always !important;
      break-after: page !important;
      height: 1px !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      visibility: hidden !important;
    }
    .cut-line {
      text-align: center;
      padding: 6px 0 8px 0;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: -0.5px;
    }

    @media print {
      @page {
        size: 80mm auto !important;
        margin: 0 !important;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        background-color: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .receipt-container {
        width: 100% !important;
        padding: 0 !important;
        margin: 0 auto !important;
        height: auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .receipt-box {
        width: 100% !important;
        max-width: 245px !important;
        margin: 0 auto !important;
        padding: 2px 6px 4px 6px !important;
        height: auto !important;
        box-sizing: border-box !important;
      }
      .via-page-break {
        page-break-after: always !important;
        break-after: page !important;
        padding-bottom: 2mm !important;
        margin-bottom: 0 !important;
      }
      .html-page-break {
        display: block !important;
        clear: both !important;
        page-break-before: always !important;
        break-before: page !important;
        page-break-after: always !important;
        break-after: page !important;
        height: 1px !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .other-products-box {
        margin-top: 8px !important;
        border-top: 1px dashed #000 !important;
        padding-top: 4px !important;
        text-align: left !important;
      }
      .other-products-title {
        font-weight: 900 !important;
        font-size: 11px !important;
        letter-spacing: 0.5px !important;
      }
      .other-products-space {
        display: block !important;
        width: 100% !important;
        clear: both !important;
        box-sizing: border-box !important;
      }
      .cut-separator {
        page-break-after: always !important;
        break-after: page !important;
      }
      .item-description {
        font-size: 11px !important;
        font-weight: 300 !important;
        font-style: italic !important;
        color: #000 !important;
        padding-left: 8px !important;
        margin-top: 1px !important;
        margin-bottom: 2px !important;
      }
      .box-modality, .title, .box-order, .box-client, .box-delivery-fee, .item-code-badge {
        background-color: #000 !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .cut-line {
        padding-top: 4px !important;
        padding-bottom: 2px !important;
      }
    }
  </style>
</head>
<body>
  ${(() => {
    const isKiosk = order.type === 'kiosk' || (order as any).channel === 'kiosk';
    // Regra mandatória: Esse cupom quando for sair, tem que ser impresso em duas vias (1ª Via Cliente + 2ª Via Balcão).
    const isSingleCopy = false;
    const bottomSpaceCm = isKiosk
      ? (storeInfo?.totemPrinterBottomSpaceCm ?? 2.5)
      : (storeInfo?.windowsPrinterBottomSpaceCm ?? 8.0);

    const rawItems = Array.isArray(order.items)
      ? order.items
      : (typeof (order as any).items === 'string' ? JSON.parse((order as any).items || '[]') : []);

    const itemsSubtotal = rawItems.reduce((sum: number, it: any) => {
      const itPrice = ((Number(it.price) || 0) + (Number(it.flavor?.price) || 0) + (it.addons?.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0) || 0));
      return sum + (itPrice * (Number(it.quantity) || 1));
    }, 0);

    const orderTotal = Number(order.total) || 0;
    const differenceFee = Math.max(0, orderTotal - itemsSubtotal);

    const isDeliveryOrder = order.deliveryType === 'delivery' || 
      order.type === 'delivery' || 
      Boolean(order.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
      Boolean((order as any).deliveryNeighborhood) ||
      (order.deliveryFee !== undefined && order.deliveryFee !== null && Number(order.deliveryFee) > 0) ||
      (differenceFee > 0.05 && !order.tableNumber && order.type !== 'kiosk');

    let deliveryFeeAmount = 0;
    if (order.deliveryFee !== undefined && order.deliveryFee !== null && Number(order.deliveryFee) > 0) {
      deliveryFeeAmount = Number(order.deliveryFee);
    } else if (differenceFee > 0.05) {
      deliveryFeeAmount = differenceFee;
    }

    let customerDisplayText = 'CLIENTE: BALCÃO / RETIRADA';
    if (order.customerName && order.customerName.trim() !== '' && order.customerName.trim().toUpperCase() !== 'CLIENTE' && order.customerName.trim().toUpperCase() !== 'CLIENTE TOTEM') {
      customerDisplayText = `CLIENTE: ${order.customerName.trim().toUpperCase()}`;
    } else if (isKiosk) {
      customerDisplayText = 'CLIENTE: TOTEM / AUTOATENDIMENTO';
    } else if (order.tableNumber) {
      customerDisplayText = `CLIENTE: MESA ${order.tableNumber}`;
    } else if (isDeliveryOrder) {
      customerDisplayText = 'CLIENTE: ENTREGA / DELIVERY';
    } else {
      customerDisplayText = 'CLIENTE: BALCÃO / RETIRADA';
    }

    const modalityText = resolveOrderModality(order);

    const renderSingleVia = (viaType: 'cliente' | 'balcao') => {
      const isClient = viaType === 'cliente';
      return `
      <div class="receipt-box ${!isClient ? 'receipt-box-attendant' : ''}">
        <!-- 1. PRIMEIRA INFORMAÇÃO NO TOPO DO CUPOM: MODALIDADE -->
        <div class="box-modality">*** ${modalityText} ***</div>

        ${activeOrderPrinterName ? `
        <div style="text-align: center; font-size: 11px; font-weight: 900; background: #000; color: #fff; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; letter-spacing: 0.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
          🖨️ DESTINO: ${activeOrderPrinterName.toUpperCase()}
        </div>` : ''}
        <div class="title">${storeName}</div>
        
        <div class="via-tag ${isClient ? 'via-tag-client' : 'via-tag-attendant'}">
          ${isSingleCopy ? '*** VIA ÚNICA ***' : (isClient ? '*** 1ª VIA - CLIENTE ***' : '*** 2ª VIA - BALCÃO (ATENDENTE) ***')}
        </div>

        <div class="customer-order-box">
          <div class="box-order">PEDIDO #${orderNumber}</div>
          <div class="box-client">${customerDisplayText}</div>
          ${order.tableNumber ? `<div class="box-client" style="font-size: 14px; margin-bottom: 2px;">🍽️ MESA: ${order.tableNumber}</div>` : ''}
        </div>

        ${(() => {
          const sTime = (order.scheduledTime || (order as any).scheduled_time || (order as any).scheduleTime || '').toString().trim();
          const rawDay = (order.scheduledDay || (order as any).scheduled_day || order.scheduledDate || (order as any).scheduled_date || '').toString().trim();
          const sDay = formatDateBR(rawDay);
          if (!sTime) return '';
          return `
          <div style="margin: 6px 0; padding: 6px 4px; background-color: #000 !important; color: #fff !important; text-align: center; border-radius: 4px; font-weight: 900; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
            <div style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #ffd700 !important;">*** HORÁRIO AGENDADO RETIRADA ***</div>
            ${sDay ? `<div style="font-size: 13px; letter-spacing: 0.5px; margin-top: 1px; text-transform: uppercase; color: #fff !important;">📅 ${sDay}</div>` : ''}
            <div style="font-size: 22px; letter-spacing: 1.5px; margin-top: 2px;">⏰ ${sTime}</div>
          </div>`;
        })()}

        ${order.customerPhone ? `<div class="center text-sm">Tel: ${order.customerPhone}</div>` : ''}
        ${order.deliveryAddress ? `<div class="center text-sm" style="margin-top: 2px;">End: ${order.deliveryAddress}</div>` : ''}
        
        <div class="center text-sm" style="margin-top: 2px;">${orderDate}</div>
        <div class="center text-sm bold" style="margin-top: 2px;">
          ${order.type === 'kiosk' 
            ? 'Canal: Totem Autoatendimento' 
            : (order.tableNumber 
                ? `Canal: Celular (Mesa ${order.tableNumber})` 
                : (order.deliveryType === 'delivery' ? 'Canal: Entrega em Domicílio' : 'Canal: Celular (QR Code Balcão)'))}
          ${(() => {
            const sTime = (order.scheduledTime || (order as any).scheduled_time || (order as any).scheduleTime || '').toString().trim();
            const rawDay = (order.scheduledDay || (order as any).scheduled_day || order.scheduledDate || (order as any).scheduled_date || '').toString().trim();
            const sDay = formatDateBR(rawDay);
            if (!sTime) return '';
            return `<br><span style="font-size: 13px; font-weight: 900; background-color: #000; color: #fff; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 3px;">⏰ RETIRADA: ${sDay ? sDay + ' às ' : ''}${sTime}</span>`;
          })()}
        </div>

        <div class="divider"></div>

        <div class="items-list">
          ${items.map(item => {
            const itemCode = resolveItemCode(item);
            const itemTotal = ((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1);
            return `
            <div class="item-row">
              <span class="item-name">${!isClient ? '<span class="check-box">[ ] </span>' : ''}${item.quantity || 1}x ${item.name || ''}</span>
              <span class="item-price">${formatCurrency(itemTotal)}</span>
            </div>
            ${item.prepLabel ? `<div class="addons" style="font-weight: 900; font-size: 11px; color: #000; text-transform: uppercase;">[ ] OPÇÃO: ${item.prepLabel}</div>` : ''}
            ${itemCode ? `<div style="padding-left: 4px; margin: 1px 0 3px 0;"><span class="item-code-badge">CÓD: ${itemCode}</span></div>` : ''}
            ${item.description && item.description.trim() !== '' ? `<div class="item-description">${item.description.trim()}</div>` : ''}
            ${(() => {
              if (!item.flavor) return '';
              const fCode = resolveAddonCode(item.flavor);
              return `<div class="addons">Sabor: ${item.flavor.name}${fCode ? ` <span class="item-code-badge" style="font-size: 10px; padding: 0 4px; margin-left: 4px;">CÓD: ${fCode}</span>` : ''}</div>`;
            })()}
            ${(() => {
              if (!item.addons || item.addons.length === 0) return '';
              return item.addons.map(a => {
                const aCode = resolveAddonCode(a);
                return `<div class="addons">+ ${a.name}${aCode ? ` <span class="item-code-badge" style="font-size: 10px; padding: 0 4px; margin-left: 4px;">CÓD: ${aCode}</span>` : ''}</div>`;
              }).join('');
            })()}
          `;
          }).join('')}
        </div>

        <div class="divider"></div>

        ${isDeliveryOrder ? `
        <div style="margin: 6px 0; padding: 4px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #000; margin-bottom: 3px;">
            <span>Subtotal dos Itens:</span>
            <span>${formatCurrency(itemsSubtotal)}</span>
          </div>
          <div class="box-delivery-fee">
            <span>🛵 TAXA DE ENTREGA:</span>
            <span>${deliveryFeeAmount > 0 ? formatCurrency(deliveryFeeAmount) : 'GRÁTIS'}</span>
          </div>
        </div>
        ` : ''}

        <div class="total-row">
          <span>TOTAL :</span>
          <span>${formatCurrency(order.total || 0)}</span>
        </div>

        <div class="center text-sm bold" style="margin-top: 4px;">
          Pagamento: ${order.paymentMethod || 'Não informado'}
        </div>

        ${!isClient ? `
        <div class="attendant-box" style="margin-top: 8px; font-size: 11px; border-top: 1px dashed #000; padding-top: 5px; text-align: left;">
          <div>Conferido / Atendente: ___________________</div>
        </div>
        ` : ''}

        <div class="divider-solid"></div>
        <div class="center text-sm" style="font-size: 11px; margin-top: 2px; font-weight: 900;">
          ${isClient ? '*** OBRIGADO PELA PREFERÊNCIA ***' : '*** CONTROLE INTERNO / BALCÃO ***'}
        </div>

        <div class="other-products-box" style="margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px; page-break-inside: avoid !important;">
          <div class="other-products-title" style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">OBSERVAÇÕES:</div>
          <div class="other-products-space" style="height: ${bottomSpaceCm}cm !important; min-height: ${bottomSpaceCm}cm !important; display: flex !important; flex-direction: column !important; justify-content: space-around !important; box-sizing: border-box !important; padding: 2px 0 !important; margin-top: 2px !important;">
            <div style="border-bottom: 1px dashed #888; width: 100%; height: 1.2cm;"></div>
            <div style="border-bottom: 1px dashed #888; width: 100%; height: 1.2cm;"></div>
            <div style="border-bottom: 1px dashed #888; width: 100%; height: 1.2cm;"></div>
            <div style="border-bottom: 1px dashed #888; width: 100%; height: 1.2cm;"></div>
          </div>
        </div>
        
        <div class="cut-line">
          ✂ - - - - - - - - - - - - ✂
        </div>
      </div>
      `;
    };

    if (isSingleCopy) {
      return `<div class="receipt-container">${renderSingleVia('cliente')}</div>`;
    }

    return `
      <div class="receipt-container via-page-break" style="page-break-after: always !important; break-after: page !important;">
        ${renderSingleVia('cliente')}
      </div>
      <div class="html-page-break" style="page-break-before: always !important; break-before: page !important; page-break-after: always !important; break-after: page !important; height: 1px; clear: both;"></div>
      <div class="receipt-container">
        ${renderSingleVia('balcao')}
      </div>
    `;
  })()}
  ${autoPrint ? `
  <script>
    window.onload = function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 200);
    };
    // Fecha a janela pop-up automaticamente APÓS a impressão ser enviada ao spooler do Windows
    window.onafterprint = function() {
      setTimeout(function() {
        try { window.close(); } catch(e) {}
      }, 200);
    };
  </script>` : ''}
</body>
</html>`;
};

export const normalizeEscPosText = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ');
};

export const getEscPosReceiptBase64 = (order: Order, storeInfo: StoreInfo): string => {
  const formatCurrency = (value: number) => {
    return 'R$ ' + (value || 0).toFixed(2).replace('.', ',');
  };
  const storeName = normalizeEscPosText((storeInfo?.name || 'DONAMARA - REVENDA').toUpperCase());
  const orderNumber = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const customerName = order.customerName ? normalizeEscPosText(order.customerName.trim().toUpperCase()) : 'CLIENTE';
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order.items) ? order.items : [];
  
  const isKiosk = order.type === 'kiosk' || (order as any).channel === 'kiosk';
  const cutMode = isKiosk
    ? (storeInfo?.totemPrinterCutMode || storeInfo?.printerCutMode || 'partial')
    : (storeInfo?.windowsPrinterCutMode || storeInfo?.printerCutMode || 'partial');

  // Regra mandatória: Esse cupom quando for sair, tem que ser impresso em duas vias (1ª Via Cliente + 2ª Via Balcão).
  const isSingleCopy = false;

  const bottomSpaceCm = isKiosk
    ? (storeInfo?.totemPrinterBottomSpaceCm ?? 2.5)
    : (storeInfo?.windowsPrinterBottomSpaceCm ?? 6.0);

  const feedLinesCount = Math.max(1, Math.min(12, Math.round(bottomSpaceCm * 2.2)));

  const buildViaLines = (viaType: 'cliente' | 'balcao', single: boolean = false): string[] => {
    const isClient = viaType === 'cliente';
    const lines: string[] = [];

    const rawItems = Array.isArray(order.items)
      ? order.items
      : (typeof (order as any).items === 'string' ? JSON.parse((order as any).items || '[]') : []);

    const itemsSubtotal = rawItems.reduce((sum: number, it: any) => {
      const itPrice = ((Number(it.price) || 0) + (Number(it.flavor?.price) || 0) + (it.addons?.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0) || 0));
      return sum + (itPrice * (Number(it.quantity) || 1));
    }, 0);

    const orderTotal = Number(order.total) || 0;
    const differenceFee = Math.max(0, orderTotal - itemsSubtotal);

    const isDeliveryOrder = order.deliveryType === 'delivery' || 
      order.type === 'delivery' || 
      Boolean(order.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
      Boolean((order as any).deliveryNeighborhood) ||
      (order.deliveryFee !== undefined && order.deliveryFee !== null && Number(order.deliveryFee) > 0) ||
      (differenceFee > 0.05 && !order.tableNumber && order.type !== 'kiosk');

    let deliveryFeeAmount = 0;
    if (order.deliveryFee !== undefined && order.deliveryFee !== null && Number(order.deliveryFee) > 0) {
      deliveryFeeAmount = Number(order.deliveryFee);
    } else if (differenceFee > 0.05) {
      deliveryFeeAmount = differenceFee;
    }

    const modalityText = resolveOrderModality(order);

    // Initialize printer
    lines.push('\x1B\x40'); 
    lines.push('\x1B\x74\x00'); // Standard code page

    // Center alignment
    lines.push('\x1B\x61\x01'); 

    // 1. PRIMEIRA INFORMAÇÃO NO TOPO DO CUPOM: MODALIDADE (DELIVERY, RETIRADA, CONSUMO NA LOJA, TOTEM)
    lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11');
    lines.push(`  *** ${modalityText} ***  \n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00');
    lines.push('\n');

    // TÍTULO DA LOJA EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO)
    lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x01');
    lines.push(`  ${storeName}  \n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00'); // Reset size and inverse

    // Via Header
    if (single) {
      lines.push('\x1B\x45\x01*** VIA UNICA ***\x1B\x45\x00\n');
    } else if (isClient) {
      lines.push('\x1B\x45\x01*** 1a VIA - CLIENTE ***\x1B\x45\x00\n');
    } else {
      lines.push('\x1B\x45\x01*** 2a VIA - BALCAO (ATENDENTE) ***\x1B\x45\x00\n');
    }

    lines.push('--------------------------------\n');
    // PEDIDO EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO)
    lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11'); // Negrito e Altura Dupla e Fundo Preto / Texto Branco
    lines.push(`  PEDIDO #${orderNumber}  \n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00'); // Reset tamanho e modo inverso

    // CLIENTE EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO) EM TODAS AS MODALIDADES (TOTEM, MESA, BALCÃO, DELIVERY)
    let escPosCustomerText = 'CLIENTE: BALCAO';
    if (order.customerName && order.customerName.trim() !== '' && order.customerName.trim().toUpperCase() !== 'CLIENTE' && order.customerName.trim().toUpperCase() !== 'CLIENTE TOTEM') {
      escPosCustomerText = `CLIENTE: ${normalizeEscPosText(order.customerName.trim().toUpperCase())}`;
    } else if (isKiosk) {
      escPosCustomerText = 'CLIENTE: TOTEM / AUTOATENDIMENTO';
    } else if (order.tableNumber) {
      escPosCustomerText = `CLIENTE: MESA ${order.tableNumber}`;
    } else if (isDeliveryOrder) {
      escPosCustomerText = 'CLIENTE: ENTREGA / DELIVERY';
    } else {
      escPosCustomerText = 'CLIENTE: RETIRADA BALCAO';
    }

    lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x01'); // Fundo preto, texto branco, largura dupla
    lines.push(`  ${escPosCustomerText}  \n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00');

    // Número da mesa em destaque se houver
    if (order.tableNumber) {
      lines.push('\x1D\x42\x01\x1B\x45\x01');
      lines.push(`  MESA: ${order.tableNumber}  \n`);
      lines.push('\x1B\x45\x00\x1D\x42\x00');
    }

    if (order.customerPhone) {
      lines.push(`Tel: ${order.customerPhone}\n`);
    }
    if (order.deliveryAddress) {
      lines.push(`End: ${normalizeEscPosText(order.deliveryAddress)}\n`);
    }
    const escScheduledTime = (order.scheduledTime || (order as any).scheduled_time || (order as any).scheduleTime || '').toString().trim();
    const rawEscDay = (order.scheduledDay || (order as any).scheduled_day || order.scheduledDate || (order as any).scheduled_date || '').toString().trim();
    const escScheduledDay = formatDateBR(rawEscDay);
    if (escScheduledTime) {
      lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11');
      lines.push(`*** HORARIO RETIRADA ***\n`);
      if (escScheduledDay) {
        lines.push(`     ${normalizeEscPosText(escScheduledDay)}     \n`);
      }
      lines.push(`       ${escScheduledTime}       \n`);
      lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00');
    }
    lines.push(`${orderDate}\n`);
    const channelEscPos = order.type === 'kiosk' 
      ? 'Canal: Totem Autoatendimento' 
      : (order.tableNumber 
          ? `Canal: Celular (Mesa ${order.tableNumber})` 
          : (order.deliveryType === 'delivery' ? 'Canal: Delivery' : 'Canal: Celular (QR Code Balcao)'));
    lines.push(`${channelEscPos}\n`);
    lines.push('--------------------------------\n');
    
    // Left alignment for items
    lines.push('\x1B\x61\x00'); 
    
    items.forEach(item => {
      const itemTotal = ((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1);
      const itemName = normalizeEscPosText(item.name || '');
      const itemCode = normalizeEscPosText(resolveItemCode(item));
      const checkbox = !isClient ? '[ ] ' : '';
      lines.push(`\x1B\x45\x01${checkbox}${item.quantity || 1}x ${itemName}\x1B\x45\x00\n`);
      if (item.prepLabel) {
        lines.push(`   \x1B\x45\x01* OPCAO: ${normalizeEscPosText(item.prepLabel.toUpperCase())}\x1B\x45\x00\n`);
      }
      if (itemCode) {
        lines.push(`   \x1D\x42\x01 COD: ${itemCode} \x1D\x42\x00\n`);
      }
      lines.push(`   Subtotal: ${formatCurrency(itemTotal)}\n`);
      if (item.description) lines.push(`   * ${normalizeEscPosText(item.description)}\n`);
      if (item.flavor) {
        const fCode = normalizeEscPosText(resolveAddonCode(item.flavor));
        lines.push(`   * Sabor: ${normalizeEscPosText(item.flavor.name)}${fCode ? ` \x1D\x42\x01 COD: ${fCode} \x1D\x42\x00` : ''}\n`);
      }
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(a => {
          const aCode = normalizeEscPosText(resolveAddonCode(a));
          lines.push(`   * + ${normalizeEscPosText(a.name)}${aCode ? ` \x1D\x42\x01 COD: ${aCode} \x1D\x42\x00` : ''}\n`);
        });
      }
    });

    lines.push('--------------------------------\n');
    if (isDeliveryOrder) {
      lines.push('\x1B\x61\x00'); // Left alignment
      lines.push(`Subtotal Itens: ${formatCurrency(itemsSubtotal)}\n`);
      // Taxa de entrega destacada com fundo preto e escrita branca
      lines.push('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x01'); // Invertido + Negrito + Largura dupla
      lines.push(` TAXA DE ENTREGA: ${deliveryFeeAmount > 0 ? formatCurrency(deliveryFeeAmount) : 'GRATIS'} \n`);
      lines.push('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00'); // Reset invertido
      lines.push('--------------------------------\n');
    }
    lines.push('\x1B\x61\x02'); // Right alignment
    lines.push('\x1B\x45\x01\x1D\x21\x01'); // Bold + Double height total
    lines.push(`TOTAL: ${formatCurrency(order.total || 0)}\n`);
    lines.push('\x1D\x21\x00\x1B\x45\x00'); // Normal font

    lines.push('\x1B\x61\x01'); // Center alignment
    lines.push(`Pagamento: ${normalizeEscPosText(order.paymentMethod || 'Balcao / Dinheiro')}\n`);
    lines.push('--------------------------------\n');

    if (isClient) {
      lines.push('*** OBRIGADO PELA PREFERENCIA ***\n');
    } else {
      lines.push('Conferido: _____________________\n');
      lines.push('*** CONTROLE INTERNO / BALCAO ***\n');
    }

    lines.push('--------------------------------\n');
    lines.push('\x1B\x61\x00'); // Left alignment
    lines.push('\x1B\x45\x01OBSERVACOES:\x1B\x45\x00\n');

    // Ajusta o avanço físico de papel no firmware da impressora antes do corte de acordo com a configuração do canal
    lines.push('\n'.repeat(Math.max(2, feedLinesCount)));
    lines.push(`\x1B\x64${String.fromCharCode(Math.min(feedLinesCount, 12))}`);
    
    // Comando de corte universal (GS V 66 0 e GS V 1 para Elgin, Epson, Bematech, Daruma, etc.)
    if (cutMode === 'full') {
      lines.push('\x1D\x56\x40\x00\x1D\x56\x00');
    } else {
      // Padrão/Parcial: Dispara o corte parcial / picote entre as vias
      lines.push('\x1D\x56\x42\x00\x1D\x56\x01');
    }

    return lines;
  };

  let allLines: string[] = [];
  if (isSingleCopy) {
    allLines = buildViaLines('cliente', true);
  } else {
    // 2 vias: Via 1 para o cliente (com corte) + Via 2 para a atendente do balcão (com corte)
    const via1 = buildViaLines('cliente', false);
    const via2 = buildViaLines('balcao', false);
    allLines = [...via1, '\n\n', ...via2];
  }

  const fullText = allLines.join('');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullText);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|Linux.*arm|Silk|AFT/i.test(ua);
};

export const isTabletOrAndroidEnvironment = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  return isAndroidDevice() || /Tablet|iPad/i.test(ua) || (Boolean(isTouch) && /Mobile/i.test(ua));
};

// Guarda de debounce para evitar disparos duplicados ou triplicados apenas em chamadas automáticas
let lastPrintedOrderId: string | number | null = null;
let lastPrintTimestamp: number = 0;



/**
 * Dispara a caixa de diálogo nativa do navegador/Windows para impressão em folha/térmica
 */
export const printNativeDialog = async (order: Order, storeInfo: StoreInfo): Promise<string | null> => {
  const fullHtml = getFullReceiptHTML(order, storeInfo, true);

  return new Promise((resolve) => {
    try {
      // 1. Tenta abrir janela popup dedicada (Essencial para o Windows e Chrome enviarem o trabalho ao spooler da impressora)
      const printWin = window.open('', '_blank', 'width=380,height=520,top=100,left=100');
      if (printWin) {
        const activePrinter = getActiveOrderPrinter(storeInfo);
        const orderNumStr = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
        printWin.document.title = `[IMPRIMINDO... ${activePrinter.name.toUpperCase()}] - Pedido #${orderNumStr}`;
        printWin.document.open();
        printWin.document.write(fullHtml);
        printWin.document.close();
        printWin.focus();
        resolve('popup');
        return;
      }

      // 2. Se popups estiverem bloqueados no navegador, usa o iframe como alternativa dentro da viewport
      const existingIframe = document.getElementById('receipt-print-frame');
      if (existingIframe) {
        try { existingIframe.remove(); } catch (e) {}
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '0px';
      iframe.style.left = '0px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-999';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        fallbackToWindowPrint(fullHtml);
        resolve('window-fallback');
        return;
      }

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          const frameWin = iframe.contentWindow;
          if (frameWin) {
            frameWin.focus();
            frameWin.print();
            resolve('iframe');
          } else {
            fallbackToWindowPrint(fullHtml);
            resolve('window-fallback');
          }
        } catch (err) {
          console.warn('[Impressão Desktop] Erro ao chamar print no iframe:', err);
          fallbackToWindowPrint(fullHtml);
          resolve('window-fallback');
        }
      }, 250);

    } catch (err) {
      console.error('[Impressão Desktop] Falha no fluxo de impressão:', err);
      fallbackToWindowPrint(fullHtml);
      resolve('window-fallback');
    }
  });
};

// ==========================================
// SUPORTE A WEB SERIAL (CABO USB/SERIAL DIRETO)
// ==========================================
let activeWebSerialPort: any = null;

export const isWebSerialSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
};

export const hasActiveSerialConnection = (): boolean => {
  return activeWebSerialPort !== null && !!activeWebSerialPort.writable;
};

export const connectWebSerialPrinter = async (): Promise<{ success: boolean; message: string }> => {
  if (!isWebSerialSupported()) {
    return {
      success: false,
      message: 'Este navegador não suporta Web Serial. Use Google Chrome ou Edge no Windows para conexão direta via cabo USB.'
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeWebSerialPort = port;
    return {
      success: true,
      message: 'Impressora conectada diretamente via porta USB/Serial! Agora todas as impressões serão enviadas sem abrir nenhuma tela do Windows.'
    };
  } catch (err: any) {
    console.warn('Erro ao conectar Web Serial:', err);
    return {
      success: false,
      message: err?.message || 'Seleção cancelada ou porta indisponível.'
    };
  }
};

export const disconnectWebSerialPrinter = async () => {
  if (activeWebSerialPort) {
    try {
      await activeWebSerialPort.close();
    } catch (e) {}
    activeWebSerialPort = null;
  }
};

export const printViaWebSerial = async (order: Order, storeInfo: StoreInfo): Promise<boolean> => {
  if (!activeWebSerialPort || !activeWebSerialPort.writable) return false;
  try {
    const b64 = getEscPosReceiptBase64(order, storeInfo);
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const writer = activeWebSerialPort.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    return true;
  } catch (err) {
    console.error('Falha na escrita Web Serial:', err);
    return false;
  }
};

/**
 * Faz download de um atalho do Windows (.bat) configurado com Chrome --kiosk-printing.
 * Usa perfil isolado (--user-data-dir) para garantir que o Chrome SEMPRE ative a impressão silenciosa
 * (0 cliques), mesmo se o Chrome normal já estiver aberto para navegação.
 */
export const downloadChromeKioskShortcut = () => {
  const currentUrl = window.location.origin + '/admin';
  const batContent = `@echo off
chcp 65001 > nul
title DONAMARA - Modo Caixa Terminal (Ativo em Segundo Plano e Minimizado)
cls
echo ======================================================================
echo           DONAMARA - MODO TERMINAL DE IMPRESSAO DO CAIXA
echo ======================================================================
echo.
echo * As impressoes serao enviadas DIRETAMENTE para a Impressora Padrao
echo   configurada no seu Windows, sem abrir nenhuma janela de confirmacao!
echo.
echo * FUNCIONA EM SEGUNDO PLANO, SEGUNDA AREA DE TRABALHO E MINIMIZADA!
echo.
echo * Abra o Painel de Controle do Windows e certifique-se de que a sua
echo   impressora de cupom termica esta marcada como 'Impressora Padrao'.
echo.
echo Iniciando o sistema em modo Caixa Silencioso de Alta Performance...
echo ======================================================================

set BROWSER_EXE=
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
if not defined BROWSER_EXE set "BROWSER_EXE=chrome.exe"

start "" "%BROWSER_EXE%" --user-data-dir="%LOCALAPPDATA%\\Google\\Chrome\\CaixaKioskData" --app="${currentUrl}" --kiosk-printing --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=CalculateNativeWinOcclusion --no-first-run --no-default-browser-check
exit
`;

  const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DonaMara_Caixa_Impressao_Direta.bat';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 1000);
};

/**
 * Dispara a impressão do cupom térmico (ESC/POS e tela nativa).
 * - Conexão USB/Serial Direta: Envia ESC/POS puro sem caixa de diálogo.
 * - Impressora de Rede / TCP: Dispara via socket IP da impressora.
 * - Todos os dispositivos: Abre a interface nativa com o formato térmico otimizado.
 */
export const printReceipt = async (order: Order, storeInfo: StoreInfo, isAutoPrint: boolean = false): Promise<string | null> => {
  if (!order) return null;

  // Emite aviso sonoro (chime / bip duplo de restaurante) pelo alto-falante do computador
  try {
    playPrintBeepSound();
  } catch (e) {}

  const isDelivery = 
    resolveOrderModality(order) === 'DELIVERY' ||
    order.type === 'delivery' || 
    order.deliveryType === 'delivery' ||
    Boolean(order.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
    Boolean((order as any).deliveryNeighborhood);

  // 1. Se o tipo de conexão estiver definido para Driver Windows / USB Local
  if (storeInfo?.printerConnectionType === 'windows' && !isAndroidDevice() && !isTabletOrAndroidEnvironment()) {
    return printNativeDialog(order, storeInfo);
  }

  // 2. Se a loja ou estação estiver configurada para Impressora de Rede por IP
  const netConfig = getNetworkPrinterConfig(storeInfo);
  const isNetworkPreferred = storeInfo?.printerConnectionType === 'network' || (!storeInfo?.printerConnectionType && !!netConfig.ip);

  if (isNetworkPreferred && netConfig.ip) {
    try {
      const netResult = await printViaNetworkIp(order, storeInfo);
      if (netResult && netResult.success) {
        return 'network-ip';
      }
    } catch (e) {
      console.warn('Tentativa via socket TCP de rede falhou, caindo para impressão via navegador:', e);
    }
  }

  // 3. Se estiver conectado via Web Serial (Cabo USB Direto), imprime instantaneamente
  if (hasActiveSerialConnection()) {
    const serialSuccess = await printViaWebSerial(order, storeInfo);
    if (serialSuccess) return 'webserial';
  }

  // 4. Aciona a impressão nativa/térmica no navegador/driver local
  // Se for Totem, evitamos o diálogo nativo para não travar a tela de vendas caso a impressão falhe ou demore
  const isKiosk = order.type === 'kiosk' || (order as any).channel === 'kiosk';
  if (isKiosk && isNetworkPreferred) {
    console.warn('[Totem] Impressão de rede preferida. Suprimindo diálogo nativo automático no Totem para manter fluxo.');
    return 'kiosk-silent-skip';
  }

  if (isAutoPrint && isDelivery) {
    return 'delivery-auto-silent';
  }

  return printNativeDialog(order, storeInfo);

};

/**
 * Fallback via janela pop-up caso o iframe seja restringido pelo navegador
 */
const fallbackToWindowPrint = (html: string) => {
  try {
    const printWindow = window.open('', '_blank', 'width=420,height=650,resizable=yes,scrollbars=yes');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn('Falha no print da janela:', e);
        }
      }, 350);
    }
  } catch (e) {
    console.error('Falha no fallback de janela:', e);
  }
};

/**
 * Cria um pedido fictício para testes rápidos de impressão no Windows
 */
export const createSampleOrder = (storeInfo: StoreInfo): Order => {
  return {
    id: 'TEST-0001',
    customerName: 'Cliente Teste (Balcão)',
    customerPhone: '(11) 99999-9999',
    type: 'kiosk',
    deliveryType: 'pickup',
    deliveryAddress: '',
    items: [
      {
        productId: 'sample_prod_1',
        name: 'Pão de Queijo Tradicional (5 un)',
        price: 12.50,
        quantity: 1,
        description: 'Quentinho do forno'
      },
      {
        productId: 'sample_prod_2',
        name: 'Café Espresso Especial',
        price: 6.00,
        quantity: 1,
        flavor: { productId: 'sample_flv_1', name: 'Sem Açúcar', price: 0 }
      }
    ],
    total: 18.50,
    status: 'completed',
    paymentMethod: 'Cartão de Débito / Balcão',
    createdAt: Date.now()
  };
};

/**
 * Cria um pedido fictício de Delivery para testes de impressão com taxa de entrega
 */
export const createSampleDeliveryOrder = (storeInfo: StoreInfo): Order => {
  return {
    id: 'TEST-0002',
    customerName: 'Cliente Teste (Delivery)',
    customerPhone: '(11) 98888-7777',
    type: 'delivery',
    deliveryType: 'delivery',
    deliveryAddress: 'Rua das Flores, 123 - Centro',
    deliveryNeighborhood: 'Centro',
    deliveryFee: 7.00,
    items: [
      {
        productId: 'sample_prod_1',
        name: 'Lanche X-Tudo Especial',
        price: 28.90,
        quantity: 1,
        description: 'Completo na chapa'
      },
      {
        productId: 'sample_prod_2',
        name: 'Suco Natural de Laranja 500ml',
        price: 9.50,
        quantity: 1
      }
    ],
    total: 45.40,
    status: 'pending',
    paymentMethod: 'PIX (Entrega)',
    createdAt: Date.now()
  };
};

/**
 * Envia comando universal de abertura de gaveta de dinheiro (pulso elétrico no conector RJ-11/RJ-12)
 * para a impressora térmica conectada.
 */
export const openCashDrawer = async (
  ip?: string,
  port: number = 9100
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/printer/open-drawer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Falha na comunicação ao tentar abrir a gaveta'
    };
  }
};

/**
 * Emite aviso sonoro agradável (bip duplo / chime de restaurante) pelo alto-falante do computador
 * sempre que um cupom for emitido.
 */
export const playPrintBeepSound = () => {
  try {
    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Tom 1: 987.77 Hz (B5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Tom 2: 1318.51 Hz (E6) - Tom alegre e claro de impressão concluída
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  } catch (e) {
    console.warn('[Printer Audio] Beep error:', e);
  }
};
