import React, { useMemo, useState } from 'react';
import { Order, StoreInfo } from '../store/useStore';
import { getFullReceiptHTML, printReceipt, getActiveOrderPrinter, resolveItemCode, resolveAddonCode, resolveOrderModality } from '../utils/printer';
import { Printer, X, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';

interface ReceiptModalProps {
  order: Order | null;
  storeInfo: StoreInfo;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, storeInfo, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!order) return null;

  const activePrinter = getActiveOrderPrinter(storeInfo);
  const modalityText = resolveOrderModality(order);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const customerNameStr = order.customerName ? order.customerName.trim().toUpperCase() : 'CLIENTE';
  const orderNumber = order.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const storeName = (storeInfo?.name || 'DONAMARA - REVENDA').toUpperCase();
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order.items) ? order.items : [];

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
  } else if (order.type === 'kiosk') {
    customerDisplayText = 'CLIENTE: TOTEM / AUTOATENDIMENTO';
  } else if (order.tableNumber) {
    customerDisplayText = `CLIENTE: MESA ${order.tableNumber}`;
  } else if (isDeliveryOrder) {
    customerDisplayText = 'CLIENTE: ENTREGA / DELIVERY';
  } else {
    customerDisplayText = 'CLIENTE: BALCÃO / RETIRADA';
  }

  const scheduledTime = (order.scheduledTime || (order as any).scheduled_time || (order as any).scheduleTime || '').toString().trim();
  const scheduledDay = (order.scheduledDay || (order as any).scheduled_day || order.scheduledDate || (order as any).scheduled_date || '').toString().trim();

  const receiptBlobUrl = useMemo(() => {
    const html = getFullReceiptHTML(order, storeInfo, true);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [order, storeInfo]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printReceipt(order, storeInfo);
    } catch (e) {
      console.warn('Erro ao disparar impressão:', e);
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
    }
  };

  const handleCopyText = () => {
    const text = `
*${storeName}*
------------------------------
*${customerDisplayText}*
*PEDIDO #${orderNumber}*
${scheduledTime ? `*HORÁRIO AGENDADO: 📅 ${scheduledDay ? scheduledDay + ' ' : ''}⏰ ${scheduledTime}*\n` : ''}${order.customerPhone ? `Tel: ${order.customerPhone}` : ''}
${order.deliveryAddress ? `End: ${order.deliveryAddress}` : ''}
Data: ${orderDate}
Tipo: ${order.type === 'kiosk' ? 'Totem Autoatendimento' : (isDeliveryOrder ? 'Entrega em Domicílio' : (order.tableNumber ? `Consumo Loja (Mesa ${order.tableNumber})` : 'Retirada no Balcão'))}${scheduledTime ? ` (Agendado: ${scheduledDay ? scheduledDay + ' ' : ''}às ${scheduledTime})` : ''}
------------------------------
${items.map(item => {
  const itemCode = resolveItemCode(item);
  const codeStr = itemCode ? ` [CÓD: ${itemCode}]` : '';
  const descStr = item.description ? `\n   ${item.description}` : '';
  const flavorCode = resolveAddonCode(item.flavor);
  const flavorStr = item.flavor ? `\n   • Sabor: ${item.flavor.name}${flavorCode ? ` [CÓD: ${flavorCode}]` : ''}` : '';
  const addonsStr = item.addons && item.addons.length > 0 
    ? '\n   ' + item.addons.map(a => {
        const aCode = resolveAddonCode(a);
        return `+ ${a.name}${aCode ? ` [CÓD: ${aCode}]` : ''}`;
      }).join('\n   ')
    : '';
  return `${item.quantity || 1}x ${item.name}${codeStr} - ${formatCurrency(((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1))}${descStr}${flavorStr}${addonsStr}`;
}).join('\n')}
------------------------------
${isDeliveryOrder ? `Subtotal Itens: ${formatCurrency(itemsSubtotal)}\n*TAXA DE ENTREGA:* ${deliveryFeeAmount > 0 ? formatCurrency(deliveryFeeAmount) : 'GRÁTIS'}\n------------------------------\n` : ''}*TOTAL : ${formatCurrency(order.total || 0)}*
Pagamento: ${order.paymentMethod || 'Não informado'}
------------------------------
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header do Modal */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <Printer className="w-5 h-5 text-orange-400" />
            <span>Cupom do Pedido #{orderNumber}</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Indicador de Impressora Configurada no Sistema */}
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Printer className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="text-stone-700 font-medium truncate">
              Impressora: <strong className="text-stone-900 font-bold">{activePrinter.name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
              Térmica / EscPos
            </span>
          </div>
        </div>

        {/* Visualização de Uma Via Exata e Limpa */}
        <div className="p-4 overflow-y-auto bg-stone-100 flex justify-center">
          <div className="bg-white p-4 shadow-sm border border-stone-200 w-full max-w-[280px] font-mono text-xs text-stone-900 leading-relaxed rounded-sm">
            {/* 1. PRIMEIRA INFORMAÇÃO NO TOPO DO CUPOM: MODALIDADE */}
            <div className="bg-black text-white p-2 text-center rounded font-black text-sm tracking-widest uppercase mb-2">
              *** {modalityText} ***
            </div>

            {/* TÍTULO DA LOJA EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO) */}
            <div className="bg-black text-white p-2 text-center rounded font-black text-sm tracking-wider uppercase mb-2">
              {storeName}
            </div>
            
            {/* PEDIDO E CLIENTE EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO) */}
            <div className="bg-black text-white p-2.5 my-2 text-center rounded space-y-1">
              <div className="font-black text-sm tracking-wider">
                PEDIDO #{orderNumber}
              </div>
              <div className="font-black text-xs uppercase tracking-wide break-words border-t border-stone-700 pt-1">
                {customerDisplayText}
              </div>
              {order.tableNumber && (
                <div className="font-black text-xs uppercase tracking-wider text-amber-300">
                  🍽️ MESA {order.tableNumber}
                </div>
              )}
            </div>

            {/* HORÁRIO AGENDADO RETIRADA EM DESTAQUE MÁXIMO (FUNDO PRETO / TEXTO BRANCO E AMARELO) */}
            {scheduledTime ? (
              <div className="bg-black text-white p-2.5 my-2 text-center rounded space-y-0.5 border-2 border-stone-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  *** HORÁRIO AGENDADO RETIRADA ***
                </div>
                {scheduledDay && (
                  <div className="text-xs font-bold text-stone-200 uppercase tracking-wide">
                    📅 {scheduledDay}
                  </div>
                )}
                <div className="text-xl font-black tracking-widest text-white mt-0.5">
                  ⏰ {scheduledTime}
                </div>
              </div>
            ) : null}

            {order.customerPhone && <div className="text-center text-[11px]">Tel: {order.customerPhone}</div>}
            {order.deliveryAddress && <div className="text-center text-[11px] break-words">End: {order.deliveryAddress}</div>}
            
            <div className="text-center text-[11px] mt-1">{orderDate}</div>
            <div className="text-center text-[11px] font-bold mt-0.5">
              {order.type === 'kiosk' ? 'Tipo: Retirada no Balcão (Totem)' : (isDeliveryOrder ? 'Tipo: Entrega em Domicílio' : (order.tableNumber ? `Tipo: Consumo no Local (Mesa ${order.tableNumber})` : 'Tipo: Retirada no Balcão'))}
              {scheduledTime ? ` (${scheduledDay ? scheduledDay + ' ' : ''}às ${scheduledTime})` : ''}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="space-y-1.5">
              {items.map((item, idx) => {
                const itemCode = resolveItemCode(item);
                return (
                <div key={idx}>
                  <div className="flex justify-between items-start font-bold">
                    <span className="break-words pr-2">{item.quantity || 1}x {item.name}</span>
                    <span className="whitespace-nowrap">{formatCurrency(((item.price || 0) + (item.flavor?.price || 0) + (item.addons?.reduce((s, a) => s + (a.price || 0), 0) || 0)) * (item.quantity || 1))}</span>
                  </div>
                  {itemCode && (
                    <div className="text-[11px] pl-2 my-1">
                      <span className="bg-black text-white px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                        CÓD: {itemCode}
                      </span>
                    </div>
                  )}
                  {item.description && (
                    <div className="text-[10px] pl-2 text-stone-600 font-light italic leading-tight mt-0.5">
                      {item.description}
                    </div>
                  )}
                  {item.flavor && (
                    <div className="text-[10px] pl-2 text-stone-700">
                      • Sabor: <span className="font-semibold">{item.flavor.name}</span>
                      {resolveAddonCode(item.flavor) && (
                        <span className="font-mono font-bold text-white bg-black px-1 py-0.5 rounded text-[9px] ml-1">
                          CÓD: {resolveAddonCode(item.flavor)}
                        </span>
                      )}
                    </div>
                  )}
                  {item.addons && item.addons.length > 0 && (
                    <div className="text-[10px] pl-2 text-stone-700 space-y-0.5 mt-0.5">
                      {item.addons.map((a, aIdx) => {
                        const aCode = resolveAddonCode(a);
                        return (
                          <div key={aIdx}>
                            + <span>{a.name}</span>
                            {aCode && (
                              <span className="font-mono font-bold text-white bg-black px-1 py-0.5 rounded text-[9px] ml-1">
                                CÓD: {aCode}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* BLOCO DA TAXA DE ENTREGA DESTACADO POR ESCRITO */}
            {isDeliveryOrder && (
              <div className="space-y-1.5 my-2 text-xs">
                <div className="flex justify-between items-center text-stone-700 font-bold">
                  <span>Subtotal dos Itens:</span>
                  <span>{formatCurrency(itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center font-black text-xs bg-black text-white p-2 rounded tracking-wide">
                  <span>🛵 TAXA DE ENTREGA:</span>
                  <span>{deliveryFeeAmount > 0 ? formatCurrency(deliveryFeeAmount) : 'GRÁTIS'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center font-bold text-sm">
              <span>TOTAL :</span>
              <span>{formatCurrency(order.total || 0)}</span>
            </div>

            <div className="text-center text-[11px] font-bold mt-1">
              Pagamento: {order.paymentMethod || 'Não informado'}
            </div>

            <div className="border-t-2 border-black my-2"></div>
            <div className="text-center font-bold text-[10px]">*** OBRIGADO PELA PREFERÊNCIA ***</div>
            
            <div className="mt-3 pt-2 border-t border-dashed border-black text-left">
              <div className="font-bold text-[11px] tracking-wide uppercase">OUTROS PRODUTOS</div>
              <div className="h-[5cm] min-h-[5cm]"></div>
            </div>

            <div className="text-center font-bold text-xs mt-1 text-stone-500">
              ✂ - - - - - - - - - - - - ✂
            </div>
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="p-3 bg-white border-t border-stone-200 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="bg-stone-100 text-stone-700 hover:bg-stone-200 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Copiar texto do pedido para colar no WhatsApp"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
          


          <a
            href={receiptBlobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-stone-100 hover:bg-stone-200 text-stone-600 p-2.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            title="Abrir em Nova Aba"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
