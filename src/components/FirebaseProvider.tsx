import React, { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store/useStore';
import { BakeryLoader } from './BakeryLoader';
import { safeStorage } from '../utils/storage';
import { formatAllDatesBR } from '../lib/utils';
import { startFirestoreRealtimeSync } from '../services/cloudFirestoreApi';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { fetchData, fetchOrdersOnly, setIsOnline, isOnline } = useStore();
  const [isReady, setIsReady] = useState(true);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);

  useEffect(() => {
    console.log('FirebaseProvider mounted');
    startFirestoreRealtimeSync();

    fetchData().catch((err) => {
      console.error('Initial data fetch error:', err);
    });

    // Setup Server-Sent Events (SSE) for instant real-time sync across desktop & mobile
    let eventSource: EventSource | null = null;
    let sseTimeout: ReturnType<typeof setTimeout> | null = null;

    // Disparo nativo do sistema para a barra de notificações do smartphone
    const triggerSystemNotification = (title: string, body: string, tag?: string) => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const notificationIcon = '/logo.png?v=3';
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body,
                icon: notificationIcon,
                badge: notificationIcon,
                vibrate: [250, 100, 250],
                tag: tag || 'donamara-status',
                renotify: true,
                requireInteraction: true
              } as any).catch(() => {
                try { new Notification(title, { body, icon: notificationIcon }); } catch {}
              });
            }).catch(() => {
              try { new Notification(title, { body, icon: notificationIcon }); } catch {}
            });
          } else {
            new Notification(title, { body, icon: notificationIcon });
          }
        }
      } catch {}
    };

    const getStatusDetails = (orderId: string | number, customerName: string, status: string) => {
      const shortId = String(orderId).slice(-4);
      const clientName = customerName || 'Cliente';
      
      const statusDetails: Record<string, { title: string; msg: string; type: 'success' | 'warning' | 'info'; badge: string }> = {
        'pending': {
          title: `Pedido #${shortId}`,
          msg: `Olá ${clientName}, seu pedido foi recebido e está na fila de atendimento!`,
          type: 'info',
          badge: 'Recebido'
        },
        'preparing': {
          title: `👨‍🍳 Pedido em Preparo #${shortId}`,
          msg: `Olá ${clientName}, seu pedido já está sendo preparado com todo carinho na nossa cozinha!`,
          type: 'info',
          badge: 'Em Preparo'
        },
        'ready': {
          title: `📦 Pedido Pronto #${shortId}`,
          msg: `Olá ${clientName}, seu pedido está pronto para retirada no balcão da loja!`,
          type: 'success',
          badge: 'Pronto no Balcão'
        },
        'ready_for_pickup': {
          title: `🛍️ Pronto para Retirada #${shortId}`,
          msg: `Olá ${clientName}, seu pedido está embalado e disponível para retirada!`,
          type: 'success',
          badge: 'Pronto'
        },
        'ready_for_delivery': {
          title: `📦 Pronto para Entrega #${shortId}`,
          msg: `Olá ${clientName}, seu pedido já foi embalado e aguarda saída do entregador!`,
          type: 'info',
          badge: 'Aguardando Motoboy'
        },
        'out_for_delivery': {
          title: `🛵 Pedido a Caminho #${shortId}`,
          msg: `Olá ${clientName}, seu pedido acabou de sair para entrega com o entregador! Fique atento(a).`,
          type: 'success',
          badge: 'Saiu para Entrega'
        },
        'completed': {
          title: `🎉 Pedido Finalizado #${shortId}`,
          msg: `Olá ${clientName}, seu pedido foi concluído com sucesso. Bom apetite e muito obrigado pela preferência!`,
          type: 'success',
          badge: 'Finalizado'
        },
        'cancelled': {
          title: `⚠️ Pedido Cancelado #${shortId}`,
          msg: `Olá ${clientName}, seu pedido foi cancelado pelo estabelecimento. Entre em contato conosco para suporte.`,
          type: 'warning',
          badge: 'Cancelado'
        }
      };

      return statusDetails[status] || {
        title: `Pedido #${shortId}`,
        msg: `Olá ${clientName}, seu pedido teve uma atualização no status: ${status}.`,
        type: 'info',
        badge: 'Status Atualizado'
      };
    };

    const isCustomerOrderOwner = (order: any, dataOrderId?: string | number, dataPhone?: string, dataName?: string) => {
      if (!order && !dataOrderId) return false;
      
      const targetId = String(order?.id || dataOrderId || '').trim();
      
      // 1. Identificador salvo no aparelho (último pedido ou pedido rastreado)
      const savedLastOrderId = (
        safeStorage.getItem('donamara_last_order_id') || 
        safeStorage.getItem('donamara_tracking_order_id') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_last_order_id') : null) || 
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('donamara_last_order_id') : null) || 
        ''
      ).trim();
      
      if (savedLastOrderId && targetId) {
        if (savedLastOrderId === targetId || targetId.endsWith(savedLastOrderId) || savedLastOrderId.endsWith(targetId)) {
          return true;
        }
      }

      // 2. Lista de múltiplos pedidos recentes salvos neste navegador/aparelho
      try {
        const rawRecent = safeStorage.getItem('donamara_recent_order_ids') || (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_recent_order_ids') : null);
        if (rawRecent) {
          const recentList = JSON.parse(rawRecent);
          if (Array.isArray(recentList) && recentList.some((rid: any) => {
            const sRid = String(rid).trim();
            return sRid === targetId || targetId.endsWith(sRid) || sRid.endsWith(targetId);
          })) {
            return true;
          }
        }
      } catch {}

      // 3. Cliente logado na conta
      let loggedCustomer: any = null;
      try {
        const loggedRaw = safeStorage.getItem('donamara_logged_customer') || (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_logged_customer') : null);
        if (loggedRaw) loggedCustomer = JSON.parse(loggedRaw);
      } catch {}

      if (loggedCustomer && loggedCustomer.id && order?.customerId && String(loggedCustomer.id) === String(order.customerId)) {
        return true;
      }

      // 4. Comparação ultra-flexível de telefone (ignora 55, DDD, zeros e formatação; compara últimos 8 dígitos)
      const savedPhone = (
        safeStorage.getItem('donamara_customer_phone') || 
        (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_customer_phone') : null) || 
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('donamara_customer_phone') : null) || 
        (loggedCustomer ? loggedCustomer.phone : '') ||
        ''
      );
      const rawOrderPhone = order?.customerPhone || dataPhone || '';
      const cleanSavedDigits = String(savedPhone || '').replace(/\D/g, '');
      const cleanOrderDigits = String(rawOrderPhone || '').replace(/\D/g, '');

      if (cleanSavedDigits.length >= 8 && cleanOrderDigits.length >= 8) {
        const sPhone = cleanSavedDigits.replace(/^55/, '').replace(/^0/, '');
        const oPhone = cleanOrderDigits.replace(/^55/, '').replace(/^0/, '');
        if (sPhone === oPhone || sPhone.slice(-8) === oPhone.slice(-8) || oPhone.endsWith(sPhone) || sPhone.endsWith(oPhone)) {
          return true;
        }
      }

      // 5. Comparação por nome do cliente (se não for genérico)
      const savedName = (
        safeStorage.getItem('donamara_customer_name') || 
        (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_customer_name') : null) || 
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('donamara_customer_name') : null) || 
        (loggedCustomer ? loggedCustomer.name : '') ||
        ''
      );
      const cleanSavedName = savedName ? String(savedName).trim().toLowerCase() : '';
      const orderName = (order?.customerName || dataName) ? String(order?.customerName || dataName).trim().toLowerCase() : '';
      if (cleanSavedName && cleanSavedName !== 'cliente' && cleanSavedName !== 'cliente totem' && orderName && cleanSavedName === orderName) {
        return true;
      }

      return false;
    };

    const showCustomerStatusAlert = (order: any, status: string, customMessage?: string, alertType?: string) => {
      const details = getStatusDetails(order.id, order.customerName, status);
      const notifId = `notif_${order.id}_${status}_${Date.now()}`;
      const finalTitle = alertType === 'reminder_90min' ? '⏰ Atenção: Faltam 90 Minutos!' : details.title;
      const finalMsg = customMessage || details.msg;
      const finalBadge = alertType === 'reminder_90min' ? 'Aviso 90 Minutos' : details.badge;
      const finalType = alertType === 'reminder_90min' ? 'warning' : details.type;

      useStore.getState().setCurrentNotification({
        id: notifId,
        title: finalTitle,
        message: finalMsg,
        type: finalType,
        orderId: order.id,
        badge: finalBadge
      });

      const lastNotifiedKey = `donamara_last_notified_status_${order.id}`;
      safeStorage.setItem(lastNotifiedKey, status);
      try { localStorage.setItem(lastNotifiedKey, status); } catch {}

      // Vibração no smartphone
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([250, 100, 250]);
        }
      } catch {}

      // Alerta sonoro
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}

      // Notificação nativa no smartphone mesmo com a tela bloqueada / app em segundo plano
      triggerSystemNotification(finalTitle, finalMsg, `order-${order.id}`);
    };

    // Verificação de atualizações pendentes:
    // Disparada quando o cliente desbloqueia a tela ou abre o aplicativo/site de volta
    const checkCustomerPendingOrderStatus = () => {
      try {
        const savedLastOrderId = (
          safeStorage.getItem('donamara_last_order_id') || 
          safeStorage.getItem('donamara_tracking_order_id') ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_last_order_id') : null) || 
          (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('donamara_last_order_id') : null) || 
          ''
        ).trim();
        const savedPhone = safeStorage.getItem('donamara_customer_phone') || (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_customer_phone') : null);
        const savedName = safeStorage.getItem('donamara_customer_name') || (typeof localStorage !== 'undefined' ? localStorage.getItem('donamara_customer_name') : null);

        if (!savedLastOrderId && !savedPhone && !savedName) return;

        const currentOrders = useStore.getState().orders || [];
        const customerOrder = currentOrders.find(o => isCustomerOrderOwner(o, savedLastOrderId || undefined));

        if (!customerOrder || !customerOrder.id) return;

        const currentStatus = customerOrder.status || 'pending';
        const lastNotifiedKey = `donamara_last_notified_status_${customerOrder.id}`;
        const lastNotified = safeStorage.getItem(lastNotifiedKey) || (typeof localStorage !== 'undefined' ? localStorage.getItem(lastNotifiedKey) : null);

        if (!lastNotified) {
          if (currentStatus === 'pending') {
            safeStorage.setItem(lastNotifiedKey, 'pending');
            try { localStorage.setItem(lastNotifiedKey, 'pending'); } catch {}
          } else {
            // O pedido avançou enquanto o aplicativo estava fechado! Dispara a notificação agora que ele abriu.
            showCustomerStatusAlert(customerOrder, currentStatus);
          }
        } else if (lastNotified !== currentStatus) {
          // O status mudou enquanto o app ou smartphone estavam fechados! Dispara agora.
          showCustomerStatusAlert(customerOrder, currentStatus);
        }
      } catch (err) {
        console.warn('[PendingOrderStatus Check Error]:', err);
      }
    };

    const connectSSE = () => {
      if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
        return;
      }
      if (consecutiveFailuresRef.current >= 2) {
        return;
      }
      if (eventSource) {
        eventSource.close();
      }
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'sync') {
              consecutiveFailuresRef.current = 0;
              setIsOnline(true);
              
              if (data.target === 'orders') {
                fetchOrdersOnly().then(() => {
                  const currentOrders = useStore.getState().orders;
                  const targetId = String(data.orderId || '').trim();
                  const updatedOrder = currentOrders.find(o => {
                    const sId = String(o.id).trim();
                    return sId === targetId || sId.endsWith(targetId) || targetId.endsWith(sId);
                  }) || (data.orderId ? {
                    id: data.orderId,
                    customerName: data.customerName || 'Cliente',
                    customerPhone: data.customerPhone || '',
                    status: data.status || 'pending'
                  } : null);

                  const isOwner = updatedOrder ? isCustomerOrderOwner(updatedOrder, data.orderId, data.customerPhone, data.customerName) : false;

                  if (isOwner && updatedOrder) {
                    if (data.alertType === 'reminder_90min') {
                      showCustomerStatusAlert(
                        updatedOrder, 
                        updatedOrder.status || 'preparing', 
                        data.message || `Faltam menos de 90 minutos para a entrega/retirada do seu Pedido #${String(updatedOrder.id).slice(-4)} agendado para às ${(updatedOrder as any).scheduledTime || '09:00'}. Nossa equipe já começou os preparativos!`, 
                        'reminder_90min'
                      );
                    } else if (data.status) {
                      showCustomerStatusAlert(updatedOrder, data.status);
                    } else {
                      checkCustomerPendingOrderStatus();
                    }
                  } else {
                    // Verificação genérica para caso haja pedido ativo do cliente
                    checkCustomerPendingOrderStatus();
                  }
                }).catch(() => {});
              } else if (data.target === 'sms_reminders') {
                if (data.action === 'reminder_alert' && data.orderId) {
                  const isOwner = isCustomerOrderOwner(null, data.orderId, data.customerPhone, data.customerName);

                  if (isOwner) {
                    const isFrozenAlert = data.alertType === 'frozen_48h' || String(data.message || '').toLowerCase().includes('congelad');
                    const rawMsg = data.message || (isFrozenAlert 
                      ? `Olá ${data.customerName || 'Cliente'}! Informamos que seu pedido #${String(data.orderId).slice(-4)} contém salgados congelados, que possuem um período de preparo de até 48 horas a partir do envio. Seu pedido pode ficar pronto antes e, caso isso aconteça, nossos atendentes entrarão em contato para avisar!`
                      : `Olá ${data.customerName || 'Cliente'}, temos um aviso sobre o seu pedido agendado!`);
                    const reminderMsg = formatAllDatesBR(rawMsg);
                    const notifTitle = isFrozenAlert 
                      ? `❄️ Aviso Congelados: Pedido #${String(data.orderId).slice(-4)}`
                      : `⏰ Lembrete do Pedido #${String(data.orderId).slice(-4)}`;

                    useStore.getState().setCurrentNotification({
                      id: `notif_reminder_${Date.now()}`,
                      title: notifTitle,
                      message: reminderMsg,
                      type: 'info',
                      orderId: data.orderId,
                      badge: isFrozenAlert ? '❄️ Congelados (Prazo até 48h)' : 'Lembrete Automático'
                    });

                    try {
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        navigator.vibrate([250, 100, 250]);
                      }
                    } catch {}
                    try {
                      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                      audio.volume = 0.5;
                      audio.play().catch(() => {});
                    } catch {}

                    const firstName = String(data.customerName || 'Cliente').trim().split(' ')[0];
                    const systemNotificationBody = isFrozenAlert
                      ? (data.shortMessage || `Olá ${firstName}! Prazo de até 48h, podendo adiantar. Se ficar pronto antes, avisaremos você!`)
                      : reminderMsg;

                    triggerSystemNotification(notifTitle, systemNotificationBody, `reminder-${data.orderId}`);
                  }
                }
              } else {
                fetchData().catch(() => {});
              }
            }
          } catch (e) {
            // ignore
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current < 2) {
            if (sseTimeout) clearTimeout(sseTimeout);
            sseTimeout = setTimeout(connectSSE, 5000);
          }
        };
      } catch (e) {
        console.warn('SSE not supported or failed:', e);
      }
    };
    connectSSE();

    // Verificação inicial após carregar pedidos
    fetchOrdersOnly().then(() => {
      checkCustomerPendingOrderStatus();
    }).catch(() => {});

    // Sincronização periódica e verificação de pedidos
    const ordersInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOrdersOnly().then(() => {
          checkCustomerPendingOrderStatus();
        }).catch(() => {});
      }
    }, 15000);

    const fullCatalogInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData().catch(() => {});
      }
    }, 10 * 60 * 1000);

    // QUANDO O CLIENTE DESBLOQUEIA A TELA OU VOLTA PARA A ABA:
    // Reconecta o SSE, atualiza os pedidos e verifica se o status mudou enquanto esteve fora!
    const handleSyncTrigger = () => {
      if (navigator.onLine) {
        connectSSE();
        fetchOrdersOnly().then(() => {
          checkCustomerPendingOrderStatus();
        }).catch(() => {});
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted || document.visibilityState === 'visible') {
        console.log('[PageShow] App reaberto pelo cliente, checando atualizações de status...');
        connectSSE();
        fetchData().catch(() => {});
        fetchOrdersOnly().then(() => {
          checkCustomerPendingOrderStatus();
        }).catch(() => {});
      }
    };

    window.addEventListener('focus', handleSyncTrigger);
    document.addEventListener('visibilitychange', handleSyncTrigger);
    window.addEventListener('online', handleSyncTrigger);
    window.addEventListener('pageshow', handlePageShow);

    // Auth state listener
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setIsOnline(true);
    });

    return () => {
      if (eventSource) eventSource.close();
      if (sseTimeout) clearTimeout(sseTimeout);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (ordersInterval) clearInterval(ordersInterval);
      clearInterval(fullCatalogInterval);
      window.removeEventListener('focus', handleSyncTrigger);
      document.removeEventListener('visibilitychange', handleSyncTrigger);
      window.removeEventListener('online', handleSyncTrigger);
      window.removeEventListener('pageshow', handlePageShow);
      unsubAuth();
    };
  }, [fetchData, fetchOrdersOnly, setIsOnline]);

  if (!isReady) {
    return <BakeryLoader isLoading={true} />;
  }

  return <>{children}</>;
}
