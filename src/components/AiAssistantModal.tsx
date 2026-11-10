import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { 
  Bot, Send, X, MessageCircle, Sparkles, Clock, 
  RefreshCw, Check, ArrowRight, CreditCard, DollarSign, 
  QrCode, Bike, Store, ShoppingCart
} from 'lucide-react';
import { getStoreCurrentStatus } from '../utils/scheduleHelper';
import { cleanProductDescription } from '../constants';
import { generateClientFallbackAnswer } from '../utils/aiClientFallback';

interface StructuredOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  structuredOrder?: {
    items: StructuredOrderItem[];
    total: number;
  };
  whatsappLink?: string;
  timestamp: string;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: any) => void;
  onAddDirectToCart?: (product: any, quantity: number) => void;
  onOpenCart?: () => void;
}

export function AiAssistantModal({ isOpen, onClose, onAddToCart, onAddDirectToCart, onOpenCart }: AiAssistantModalProps) {
  const { storeInfo, placeOrder, products, categories } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cartSuccessNotice, setCartSuccessNotice] = useState<string | null>(null);

  // Active order modal state for structured WhatsApp orders
  const [activeOrderToSend, setActiveOrderToSend] = useState<{
    items: StructuredOrderItem[];
    total: number;
  } | null>(null);

  // Checkout form fields
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('donamara_customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('donamara_customer_phone') || '');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(() => localStorage.getItem('donamara_customer_address') || '');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [cashChange, setCashChange] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agentName = storeInfo.aiAgentName || 'Dona Mara IA';
  const whatsappNumber = storeInfo.aiAgentWhatsAppPhone || storeInfo.whatsapp || '';
  const currentStatus = getStoreCurrentStatus(storeInfo.weeklySchedule, storeInfo.isOpen !== false, !!storeInfo.autoOpenClose);

  // Initialize greeting on open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Olá! Sou **${agentName}**, atendente virtual da **${storeInfo.name || 'DONAMARA - REVENDA'}**. 🥟✨\n\nComo posso te ajudar hoje? Posso tirar dúvidas sobre nossos salgados e produtos, horários ou anotar seu pedido completo para enviar direto no WhatsApp!`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isOpen, messages.length, agentName, storeInfo.name]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '🥟 Cardápio de Hoje', prompt: 'O que vocês têm no cardápio de hoje?' },
    { label: '🛒 Fazer um Pedido', prompt: 'Quero fazer um pedido de salgados.' },
    { label: '✨ Sugestão', prompt: 'O que você me sugere para encomendar hoje?' },
    { label: '🕒 Horários', prompt: 'Qual o horário de funcionamento da loja?' },
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setIsLoading(true);

    const startTime = Date.now();
    let assistantMsg: ChatMessage | null = null;

    try {
      const chatHistory = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      // Abort controller with 10s timeout so user never waits indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: chatHistory,
          userMessage: textToSend,
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();

        assistantMsg = {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'Como posso te ajudar?',
          structuredOrder: data.structuredOrder || undefined,
          whatsappLink: data.whatsappLink,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.warn('[AI Assistant] Server request failed, activating client fallback engine:', err);
      const localAnswer = generateClientFallbackAnswer(
        textToSend,
        storeInfo,
        products,
        categories,
        messages
      );

      assistantMsg = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: localAnswer.reply,
        structuredOrder: localAnswer.structuredOrder || undefined,
        whatsappLink: localAnswer.whatsappLink,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
    } finally {
      // Garante exatamente no mínimo 3 segundos (3000ms) com o indicador de "digitando..." ativo
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 3000 - elapsed);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }

      if (assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg!]);

        // Auto-adiciona imediatamente os itens no carrinho do site em segundo plano
        if (assistantMsg.structuredOrder?.items && assistantMsg.structuredOrder.items.length > 0) {
          assistantMsg.structuredOrder.items.forEach((it) => {
            const match = products.find(p => p.name.toLowerCase() === it.name.toLowerCase()) || 
              products.find(p => p.name.toLowerCase().includes(it.name.toLowerCase()));
            if (match) {
              if (onAddDirectToCart) {
                onAddDirectToCart(match, it.quantity);
              } else if (onAddToCart) {
                for (let i = 0; i < it.quantity; i++) onAddToCart(match);
              }
            }
          });
          setCartSuccessNotice(`🛒 ${assistantMsg.structuredOrder.items.length === 1 ? 'Item adicionado' : 'Itens adicionados'} ao seu carrinho!`);
          setTimeout(() => setCartSuccessNotice(null), 3000);
        }
      }
      setIsLoading(false);
    }
  };

  const handleOpenOrderCheckout = (order: { items: StructuredOrderItem[]; total: number }) => {
    setActiveOrderToSend(order);
  };

  const handleAddAllToCart = (order: { items: StructuredOrderItem[]; total: number }, andOpenCart: boolean = false) => {
    if (!order || !order.items.length) return;
    
    order.items.forEach((it) => {
      const match = products.find(p => p.name.toLowerCase() === it.name.toLowerCase()) || 
        products.find(p => p.name.toLowerCase().includes(it.name.toLowerCase())) ||
        {
          id: `ai_${Date.now()}_${Math.random()}`,
          name: it.name,
          price: it.price,
          categoryId: 'all',
          isActive: true,
          trackStock: false,
          availableInStore: true,
        };
      if (onAddDirectToCart) {
        onAddDirectToCart(match, it.quantity);
      } else if (onAddToCart) {
        for (let i = 0; i < it.quantity; i++) {
          onAddToCart(match);
        }
      }
    });

    if (andOpenCart) {
      setCartSuccessNotice('Abrindo seu carrinho...');
      setTimeout(() => {
        setCartSuccessNotice(null);
        onClose();
        if (onOpenCart) {
          onOpenCart();
        }
      }, 300);
    } else {
      setCartSuccessNotice('Itens adicionados ao seu carrinho com sucesso!');
      setTimeout(() => {
        setCartSuccessNotice(null);
        onClose();
      }, 1000);
    }
  };

  const handleConfirmAndSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderToSend || isSubmittingOrder) return;

    if (!customerName.trim()) {
      alert('Por favor, informe seu nome.');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      alert('Por favor, informe o endereço para entrega.');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      localStorage.setItem('donamara_customer_name', customerName.trim());
      localStorage.setItem('donamara_customer_phone', customerPhone.trim());
      if (deliveryType === 'delivery') {
        localStorage.setItem('donamara_customer_address', deliveryAddress.trim());
      }

      const paymentLabels: Record<string, string> = {
        pix: 'PIX',
        card: 'Cartão de Crédito / Débito',
        cash: cashChange ? `Dinheiro (Troco para R$ ${cashChange})` : 'Dinheiro',
      };

      // Match products in store if available
      const orderItems = activeOrderToSend.items.map((item) => {
        const prod = products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
        const cleanDesc = cleanProductDescription(prod?.description, true);
        return {
          productId: prod?.id || `custom_${Date.now()}`,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          description: cleanDesc,
        };
      });

      // Place order in DB so it shows on Kitchen/Admin dashboard
      const placed = await placeOrder({
        items: orderItems,
        total: activeOrderToSend.total,
        type: deliveryType === 'delivery' ? 'delivery' : 'online',
        paymentMethod: paymentLabels[paymentMethod] || 'A combinar',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress.trim() : undefined,
      });

      // Format WhatsApp message
      const itemsText = activeOrderToSend.items
        .map((i) => `• ${i.quantity}x *${i.name}* - ${formatCurrency(i.price * i.quantity)}`)
        .join('\n');

      const waMessage = `🥟 *NOVO PEDIDO - ${storeInfo.name || 'DONAMARA - REVENDA'}* 🥟
_Atendimento via Atendente Virtual (${agentName})_
🔢 *Pedido:* #${placed?.id || Math.floor(Math.random() * 10000)}

📋 *Itens do Pedido:*
${itemsText}

💰 *Total:* ${formatCurrency(activeOrderToSend.total)}

👤 *Cliente:* ${customerName.trim()}
📞 *WhatsApp:* ${customerPhone.trim() || 'Não informado'}
📍 *Modalidade:* ${deliveryType === 'delivery' ? `🛵 Entrega em: ${deliveryAddress.trim()}` : '🏬 Retirada no Balcão'}
💳 *Pagamento:* ${paymentLabels[paymentMethod] || 'A combinar'}
${orderNotes.trim() ? `📝 *Observações:* ${orderNotes.trim()}\n` : ''}
Gostaria de confirmar e acompanhar meu pedido! 😊`;

      const cleanPhone = (whatsappNumber || '').replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(waMessage)}`;

      // Open WhatsApp
      window.open(waUrl, '_blank');

      // Add feedback to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `success_${Date.now()}`,
          sender: 'assistant',
          text: `🎉 **Pedido #${placed?.id || 'OK'} finalizado!**\n\nAbri a conversa no seu WhatsApp com a mensagem pronta para enviar à nossa equipe.\n\nMuito obrigado pela preferência! 🥖☕`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setActiveOrderToSend(null);
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      const cleanPhone = (whatsappNumber || '').replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent('Olá! Gostaria de fazer meu pedido.')}`, '_blank');
      setActiveOrderToSend(null);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-lg h-[92vh] sm:h-[680px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white p-4 sm:p-5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-md border-2 border-amber-300/40">
                <Bot className="w-5 h-5 text-stone-950" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-stone-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white">{agentName}</h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Atendente Virtual
                </span>
              </div>
              <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {currentStatus.isOpenNow ? 'Online • Loja Aberta' : 'Online • Loja Fechada'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {whatsappNumber && (
              <a
                href={`https://wa.me/55${whatsappNumber.replace(/\D/g, '').replace(/^55/, '')}?text=${encodeURIComponent('Olá! Gostaria de atendimento.')}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl transition-colors cursor-pointer"
                title="Chamar no WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {cartSuccessNotice && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-center gap-2 shadow-inner animate-fade-in shrink-0">
            <Check className="w-4 h-4" />
            <span>{cartSuccessNotice}</span>
          </div>
        )}

        {/* Operating status bar */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-stone-700 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{currentStatus.details}</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentStatus.isOpenNow ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-stone-200 text-stone-700'}`}>
            {currentStatus.statusBadge}
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/70">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}>
                <div
                  className={`max-w-[88%] sm:max-w-[84%] p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-amber-600 text-white rounded-br-xs shadow-sm font-medium'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-line break-words space-y-1.5">
                    {msg.text.split('\n').map((line, idx) => {
                      if (line.startsWith('• ') || line.startsWith('* ')) {
                        return (
                          <div key={idx} className="flex items-start gap-1.5 ml-1">
                            <span className={isUser ? 'text-amber-200' : 'text-amber-600 font-bold'}>•</span>
                            <span>{line.replace(/^[•*]\s*/, '')}</span>
                          </div>
                        );
                      }
                      return <p key={idx}>{line}</p>;
                    })}
                  </div>

                  <span
                    className={`block text-[10px] mt-2 font-medium ${
                      isUser ? 'text-amber-100 text-right' : 'text-stone-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {/* Structured Order Action Card (Only appears when an order is elaborated) */}
                {msg.structuredOrder && (
                  <div className="w-full max-w-[90%] sm:max-w-[85%] bg-amber-50 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                        📋 Pedido Elaborado
                      </span>
                      <span className="text-sm font-black text-emerald-800">
                        {formatCurrency(msg.structuredOrder.total)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-stone-700 bg-white/70 p-2.5 rounded-xl border border-amber-200/50">
                      {msg.structuredOrder.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="font-medium">{it.quantity}x {it.name}</span>
                          <span className="font-bold text-stone-900">{formatCurrency(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddAllToCart(msg.structuredOrder!, true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4 text-white" />
                        <span>Ver Carrinho e Finalizar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenOrderCheckout(msg.structuredOrder!)}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer shrink-0"
                        title="Enviar pelo WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-stone-700 text-xs bg-white p-3 px-4 rounded-2xl border border-amber-200/90 w-fit shadow-xs animate-fade-in">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <span className="font-semibold text-stone-600">{agentName} está digitando</span>
              <span className="flex items-center gap-1 pl-0.5">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce"></span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="bg-white border-t border-stone-100 p-2 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item.prompt)}
              disabled={isLoading}
              className="bg-stone-100 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300 text-stone-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-stone-200 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <div className="p-3 sm:p-4 bg-white border-t border-stone-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Digite sua mensagem ou pedido para ${agentName}...`}
              disabled={isLoading}
              className="flex-1 p-3 bg-stone-100 border border-stone-200 rounded-2xl text-sm text-stone-800 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white rounded-2xl transition-all shadow-md flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed"
              title="Enviar mensagem"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* 📝 ORDER CONFIRMATION & WHATSAPP MODAL SHEET */}
        {activeOrderToSend && (
          <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-xs z-30 flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-white w-full rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div>
                  <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                    Confirmar Pedido via WhatsApp
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Envie seu pedido diretamente para a loja no WhatsApp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveOrderToSend(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Summary */}
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between font-bold text-xs text-stone-800">
                  <span>Itens Selecionados:</span>
                  <span className="text-sm font-black text-amber-700">{formatCurrency(activeOrderToSend.total)}</span>
                </div>
                <div className="text-xs text-stone-600 space-y-1 max-h-24 overflow-y-auto">
                  {activeOrderToSend.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate pr-2">{item.quantity}x {item.name}</span>
                      <span className="font-bold shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleConfirmAndSendWhatsApp} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Seu Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Maria Souza"
                      className="w-full p-2.5 border border-stone-300 rounded-xl text-xs font-medium text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Seu WhatsApp / Telefone
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full p-2.5 border border-stone-300 rounded-xl text-xs font-medium text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* Delivery Type */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Como deseja receber?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        deliveryType === 'delivery'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Bike className="w-4 h-4" />
                      Entrega (Delivery)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        deliveryType === 'pickup'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                      Retirada no Balcão
                    </button>
                  </div>
                </div>

                {deliveryType === 'delivery' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Endereço de Entrega *
                    </label>
                    <input
                      type="text"
                      required={deliveryType === 'delivery'}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Rua, Número, Bairro, Complemento..."
                      className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Payment */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === 'pix'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      <span>PIX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>Cartão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span>Dinheiro</span>
                    </button>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={cashChange}
                        onChange={(e) => setCashChange(e.target.value)}
                        placeholder="Troco para quanto? (Ex: R$ 50,00)"
                        className="w-full p-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Observações (Opcional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ex: Pão bem quentinho, café sem açúcar..."
                    className="w-full p-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer text-xs uppercase tracking-wider"
                  >
                    {isSubmittingOrder ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    <span>Confirmar e Abrir no WhatsApp</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
