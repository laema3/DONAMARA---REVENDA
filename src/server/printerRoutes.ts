import { Express, Request, Response } from 'express';
import net from 'net';

/**
 * Envia um buffer de comandos ESC/POS diretamente para uma impressora térmica de rede
 * via socket TCP (padrão porta 9100 - Raw / JetDirect).
 */
export function sendRawToNetworkPrinter(
  ip: string,
  port: number = 9100,
  rawBuffer: Buffer,
  timeoutMs: number = 3500
): Promise<{ success: boolean; message: string; code?: string }> {
  return new Promise((resolve) => {
    const trimmedIp = (ip || '').trim();
    const targetPort = Number(port) || 9100;

    if (!trimmedIp) {
      return resolve({
        success: false,
        code: 'INVALID_IP',
        message: 'Endereço IP da impressora não informado.'
      });
    }

    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      try {
        if (!socket.destroyed) {
          socket.destroy();
        }
      } catch (e) {}
    };

    const isPrivateIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmedIp);
    const effectiveTimeout = isPrivateIp ? 1000 : timeoutMs;
    socket.setTimeout(effectiveTimeout);

    socket.on('connect', () => {
      socket.write(rawBuffer, (err) => {
        if (err) {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({
              success: false,
              code: 'WRITE_ERROR',
              message: `Erro ao enviar dados para a impressora (${trimmedIp}:${targetPort}): ${err.message}`
            });
          }
        } else {
          // Breve delay para garantir o descarregamento do buffer na controladora da impressora
          setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve({
                success: true,
                message: `Comando enviado com sucesso para a impressora de rede (${trimmedIp}:${targetPort})!`
              });
            }
          }, 250);
        }
      });
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        const isPrivateIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmedIp);
        const explanation = isPrivateIp
          ? ` Como ${trimmedIp} é um IP da sua rede Wi-Fi/cabo local e o servidor roda na nuvem, mude para a aba "Driver Windows / USB Local" para que seu computador no caixa envie o cupom diretamente para a impressora.`
          : ' Verifique se a impressora está ligada ao cabo de rede e com este IP configurado.';
        resolve({
          success: false,
          code: 'TIMEOUT',
          message: `Tempo limite esgotado (${timeoutMs}ms) ao tentar conectar em ${trimmedIp}:${targetPort}.${explanation}`
        });
      }
    });

    socket.on('error', (err: any) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          code: err.code || 'CONNECT_ERROR',
          message: `Falha na conexão com ${trimmedIp}:${targetPort}: ${err.message || 'Host inalcançável'}`
        });
      }
    });

    try {
      socket.connect(targetPort, trimmedIp);
    } catch (err: any) {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          code: 'EXCEPTION',
          message: `Exceção ao conectar com ${trimmedIp}:${targetPort}: ${err.message}`
        });
      }
    }
  });
}

/**
 * Cria comandos ESC/POS básicos para cupom de teste de conexão de rede
 */
function buildTestEscPosBuffer(ip: string, port: number): Buffer {
  const lines: Buffer[] = [];

  // Reset
  lines.push(Buffer.from('\x1B\x40', 'ascii'));
  // Alinhamento centralizado
  lines.push(Buffer.from('\x1B\x61\x01', 'ascii'));
  // Negrito e altura dupla
  lines.push(Buffer.from('\x1B\x45\x01\x1D\x21\x11', 'ascii'));
  lines.push(Buffer.from('DONAMARA\n', 'latin1'));
  // Tamanho normal
  lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00', 'ascii'));
  lines.push(Buffer.from('*** TESTE DE IMPRESSORA DE REDE ***\n', 'latin1'));
  lines.push(Buffer.from('--------------------------------\n', 'ascii'));
  lines.push(Buffer.from(`IP DA IMPRESSORA: ${ip}\n`, 'latin1'));
  lines.push(Buffer.from(`PORTA RAW TCP: ${port}\n`, 'latin1'));
  lines.push(Buffer.from(`DATA/HORA: ${new Date().toLocaleString('pt-BR')}\n`, 'latin1'));
  lines.push(Buffer.from('STATUS: CONEXAO ESTABELECIDA COM SUCESSO!\n', 'latin1'));
  lines.push(Buffer.from('--------------------------------\n', 'ascii'));
  lines.push(Buffer.from('Esta impressora foi definida como padrao\npara emissao dos pedidos do site.\n', 'latin1'));
  lines.push(Buffer.from('\n\n\n', 'ascii'));
  // Corte parcial / total (GS V 66 0)
  lines.push(Buffer.from('\x1D\x56\x42\x00', 'ascii'));

  return Buffer.concat(lines);
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r]/g, ' ');
}

export function buildOrderEscPosBuffer(order: any, storeInfo: any): Buffer {
  const lines: Buffer[] = [];
  const storeName = normalizeText(storeInfo?.name || 'DONAMARA').toUpperCase();
  const orderNumber = order?.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';
  const customerName = order?.customerName ? normalizeText(String(order.customerName).trim().toUpperCase()) : '';
  const orderDate = order?.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const items = Array.isArray(order?.items) ? order.items : [];
  // Regra mandatória: Esse cupom quando for sair, tem que ser impresso em duas vias (1ª Via Cliente + 2ª Via Balcão).
  const isSingleCopy = false;

  const formatCurrency = (val: number) => 'R$ ' + (Number(val) || 0).toFixed(2).replace('.', ',');

  const buildVia = (isClient: boolean) => {
    const rawItems = Array.isArray(order?.items)
      ? order.items
      : (typeof order?.items === 'string' ? JSON.parse(order.items || '[]') : []);

    const itemsSubtotal = rawItems.reduce((sum: number, it: any) => {
      const itPrice = (Number(it.price) || 0) + (Number(it.flavor?.price) || 0) + (it.addons?.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0) || 0);
      return sum + (itPrice * (Number(it.quantity) || 1));
    }, 0);

    const orderTotal = Number(order?.total) || 0;
    const differenceFee = Math.max(0, orderTotal - itemsSubtotal);

    const isDeliveryOrder = order?.deliveryType === 'delivery' || 
      order?.type === 'delivery' || 
      Boolean(order?.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
      Boolean(order?.deliveryNeighborhood) ||
      (order?.deliveryFee !== undefined && order?.deliveryFee !== null && Number(order.deliveryFee) > 0) ||
      (differenceFee > 0.05 && !order?.tableNumber && order?.type !== 'kiosk');

    let deliveryFeeAmount = 0;
    if (order?.deliveryFee !== undefined && order?.deliveryFee !== null && Number(order.deliveryFee) > 0) {
      deliveryFeeAmount = Number(order.deliveryFee);
    } else if (differenceFee > 0.05) {
      deliveryFeeAmount = differenceFee;
    }

    // Determinar Modalidade (DELIVERY, RETIRADA, CONSUMO NA LOJA, TOTEM)
    let modalityText = 'RETIRADA';
    const typeStr = String(order?.type || '').toLowerCase();
    const deliveryTypeStr = String(order?.deliveryType || '').toLowerCase();
    const modeStr = String(order?.mode || '').toLowerCase();
    const custNameStr = String(order?.customerName || '').toLowerCase();

    if (typeStr === 'kiosk' || modeStr === 'kiosk' || custNameStr.includes('totem')) {
      modalityText = 'TOTEM';
    } else if (order?.tableNumber || typeStr === 'dine_in' || deliveryTypeStr === 'dine_in') {
      modalityText = 'CONSUMO NA LOJA';
    } else if (
      deliveryTypeStr === 'delivery' || 
      typeStr === 'delivery' || 
      (order?.deliveryAddress && String(order.deliveryAddress).trim().length > 0) ||
      Boolean(order?.deliveryNeighborhood)
    ) {
      modalityText = 'DELIVERY';
    } else {
      modalityText = 'RETIRADA';
    }

    // Reset
    lines.push(Buffer.from('\x1B\x40', 'ascii'));
    // Alinhamento centralizado
    lines.push(Buffer.from('\x1B\x61\x01', 'ascii'));
    
    // 1. PRIMEIRA INFORMAÇÃO NO TOPO DO CUPOM: MODALIDADE (DELIVERY, RETIRADA, CONSUMO NA LOJA, TOTEM)
    lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11', 'ascii'));
    lines.push(Buffer.from(`  *** ${modalityText} ***  \n`, 'latin1'));
    lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00', 'ascii'));
    lines.push(Buffer.from('\n', 'ascii'));

    // TÍTULO DA LOJA EM DESTAQUE (FUNDO PRETO / TEXTO BRANCO)
    lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x01', 'ascii'));
    lines.push(Buffer.from(`  ${storeName}  \n`, 'latin1'));
    lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00', 'ascii'));

    // Tag da Via
    if (isSingleCopy) {
      lines.push(Buffer.from('\x1B\x45\x01*** VIA UNICA ***\x1B\x45\x00\n', 'latin1'));
    } else if (isClient) {
      lines.push(Buffer.from('\x1B\x45\x01*** 1a VIA - CLIENTE ***\x1B\x45\x00\n', 'latin1'));
    } else {
      lines.push(Buffer.from('\x1B\x45\x01*** 2a VIA - BALCAO (ATENDENTE) ***\x1B\x45\x00\n', 'latin1'));
    }

    lines.push(Buffer.from('--------------------------------\n', 'ascii'));
    
    // NÚMERO DO PEDIDO COM DESTAQUE MÁXIMO (FUNDO PRETO / TEXTO BRANCO)
    lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11', 'ascii'));
    lines.push(Buffer.from(`  PEDIDO #${orderNumber}  \n`, 'latin1'));
    lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00', 'ascii'));

    // NOME DO CLIENTE COM DESTAQUE (FUNDO PRETO / TEXTO BRANCO) EM TODOS OS CANAIS (TOTEM, BALCÃO, MESA, DELIVERY)
    let escPosCustomerText = 'CLIENTE: BALCAO';
    if (customerName && customerName !== 'CLIENTE' && customerName !== 'CLIENTE TOTEM') {
      escPosCustomerText = `CLIENTE: ${customerName}`;
    } else if (order?.type === 'kiosk') {
      escPosCustomerText = 'CLIENTE: TOTEM / AUTOATENDIMENTO';
    } else if (order?.tableNumber) {
      escPosCustomerText = `CLIENTE: MESA ${order.tableNumber}`;
    } else if (isDeliveryOrder) {
      escPosCustomerText = 'CLIENTE: ENTREGA / DELIVERY';
    } else {
      escPosCustomerText = 'CLIENTE: RETIRADA BALCAO';
    }

    lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x01', 'ascii'));
    lines.push(Buffer.from(`  ${escPosCustomerText}  \n`, 'latin1'));
    lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00', 'ascii'));

    // Mesa (se houver)
    if (order?.tableNumber) {
      lines.push(Buffer.from('\x1B\x45\x01\x1D\x21\x01', 'ascii'));
      lines.push(Buffer.from(`MESA: ${order.tableNumber}\n`, 'latin1'));
      lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00', 'ascii'));
    }

    if (order?.customerPhone) {
      lines.push(Buffer.from(`Tel: ${order.customerPhone}\n`, 'latin1'));
    }
    if (order?.deliveryAddress) {
      lines.push(Buffer.from(`End: ${normalizeText(order.deliveryAddress)}\n`, 'latin1'));
    }

    const scheduledTime = order?.scheduledTime || order?.scheduled_time || order?.scheduleTime;
    const rawScheduledDay = order?.scheduledDay || order?.scheduled_day || order?.scheduledDate || order?.scheduled_date;
    const scheduledDay = rawScheduledDay ? String(rawScheduledDay).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1') : '';
    if (scheduledTime) {
      lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01\x1D\x21\x11', 'ascii'));
      lines.push(Buffer.from(`*** HORARIO RETIRADA ***\n`, 'latin1'));
      if (scheduledDay) {
        lines.push(Buffer.from(`     ${normalizeText(scheduledDay)}     \n`, 'latin1'));
      }
      lines.push(Buffer.from(`       ${scheduledTime}       \n`, 'latin1'));
      lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00\x1D\x42\x00', 'ascii'));
    }

    lines.push(Buffer.from(`${orderDate}\n`, 'latin1'));
    const canalText = order?.type === 'kiosk'
      ? 'Canal: Totem Autoatendimento'
      : (order?.tableNumber 
          ? `Canal: Celular (Mesa ${order.tableNumber})` 
          : (order?.deliveryType === 'delivery' ? 'Canal: Delivery' : 'Canal: Celular (QR Code Balcao)'));
    lines.push(Buffer.from(`${canalText}\n`, 'latin1'));
    lines.push(Buffer.from('--------------------------------\n', 'ascii'));

    // Alinhamento à esquerda para itens
    lines.push(Buffer.from('\x1B\x61\x00', 'ascii'));

    items.forEach((item: any) => {
      const itemTotal = ((Number(item.price) || 0) + (Number(item.flavor?.price) || 0) + (item.addons?.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0) || 0)) * (Number(item.quantity) || 1);
      const itemName = normalizeText(item.name || '');
      const code = normalizeText(item.code || item.itemCode || item.externalId || '');
      const checkbox = !isClient ? '[ ] ' : '';
      
      lines.push(Buffer.from(`\x1B\x45\x01${checkbox}${item.quantity || 1}x ${itemName}\x1B\x45\x00\n`, 'latin1'));
      if (code) {
        // CÓDIGO DO PRODUTO EM DESTAQUE COM FUNDO PRETO E ESCRITO DE BRANCO
        lines.push(Buffer.from(`   \x1D\x42\x01 COD: ${code} \x1D\x42\x00\n`, 'latin1'));
      }
      lines.push(Buffer.from(`   Subtotal: ${formatCurrency(itemTotal)}\n`, 'latin1'));
      if (item.flavor) {
        const fCode = normalizeText(item.flavor.code || item.flavor.itemCode || item.flavor.externalId || '');
        if (fCode) {
          lines.push(Buffer.from(`   * Sabor: ${normalizeText(item.flavor.name || '')} \x1D\x42\x01 COD: ${fCode} \x1D\x42\x00\n`, 'latin1'));
        } else {
          lines.push(Buffer.from(`   * Sabor: ${normalizeText(item.flavor.name || '')}\n`, 'latin1'));
        }
      }
      if (Array.isArray(item.addons)) {
        item.addons.forEach((a: any) => {
          const aCode = normalizeText(a.code || a.itemCode || a.externalId || '');
          if (aCode) {
            lines.push(Buffer.from(`   * + ${normalizeText(a.name || '')} \x1D\x42\x01 COD: ${aCode} \x1D\x42\x00\n`, 'latin1'));
          } else {
            lines.push(Buffer.from(`   * + ${normalizeText(a.name || '')}\n`, 'latin1'));
          }
        });
      }
    });

    lines.push(Buffer.from('--------------------------------\n', 'ascii'));

    // BLOCO DA TAXA DE ENTREGA (DESTACADO POR ESCRITO)
    if (isDeliveryOrder) {
      lines.push(Buffer.from('\x1B\x61\x00', 'ascii'));
      lines.push(Buffer.from(`Subtotal Itens: ${formatCurrency(itemsSubtotal)}\n`, 'latin1'));
      lines.push(Buffer.from('\x1D\x42\x01\x1B\x45\x01', 'ascii'));
      lines.push(Buffer.from(` TAXA DE ENTREGA: ${deliveryFeeAmount > 0 ? formatCurrency(deliveryFeeAmount) : 'GRATIS'} \n`, 'latin1'));
      lines.push(Buffer.from('\x1B\x45\x00\x1D\x42\x00', 'ascii'));
      lines.push(Buffer.from('--------------------------------\n', 'ascii'));
    }

    // Alinhamento à direita para Total
    lines.push(Buffer.from('\x1B\x61\x02', 'ascii'));
    lines.push(Buffer.from('\x1B\x45\x01\x1D\x21\x01', 'ascii'));
    lines.push(Buffer.from(`TOTAL: ${formatCurrency(order?.total || 0)}\n`, 'latin1'));
    lines.push(Buffer.from('\x1D\x21\x00\x1B\x45\x00', 'ascii'));

    // Alinhamento centralizado
    lines.push(Buffer.from('\x1B\x61\x01', 'ascii'));
    lines.push(Buffer.from(`Pagamento: ${normalizeText(order?.paymentMethod || 'Balcao')}\n`, 'latin1'));
    lines.push(Buffer.from('--------------------------------\n', 'ascii'));

    if (isClient) {
      lines.push(Buffer.from('*** OBRIGADO PELA PREFERENCIA ***\n', 'latin1'));
    } else {
      lines.push(Buffer.from('Conferido: _____________________\n', 'latin1'));
      lines.push(Buffer.from('*** CONTROLE INTERNO / BALCAO ***\n', 'latin1'));
    }

    // Bloco "OUTROS PRODUTOS" com avanço compacto (~2.5 cm) para anotações manuais
    lines.push(Buffer.from('--------------------------------\n', 'ascii'));
    lines.push(Buffer.from('\x1B\x45\x01OUTROS PRODUTOS:\x1B\x45\x00\n', 'latin1'));
    lines.push(Buffer.from('\n\n\n\n\n\n', 'ascii'));

    // Corte parcial/picote universal (GS V 66 0 e GS V 1)
    lines.push(Buffer.from('\x1D\x56\x42\x00\x1D\x56\x01', 'ascii'));
  };

  if (isSingleCopy) {
    buildVia(true);
  } else {
    // 1ª Via Cliente
    buildVia(true);
    // Espaçamento entre vias
    lines.push(Buffer.from('\n\n', 'ascii'));
    // 2ª Via Balcão
    buildVia(false);
  }

  // Comando de Alerta Sonoro / Buzzer ESC/POS (ESC B 5 2 e BEL)
  // Caso a impressora possua o acessório OT-BZ20 conectado ou suporte a beep de firmware
  lines.push(Buffer.from([0x1B, 0x42, 0x05, 0x02, 0x07]));

  // Disparo de pulso de abertura de gaveta (caso pagamento seja em Dinheiro ou gaveta ativa)
  const isCashOrder = /dinheiro|especie|cash/i.test(String(order?.paymentMethod || ''));
  if (isCashOrder || storeInfo?.cashDrawerEnabled || storeInfo?.openDrawerOnAllOrders) {
    lines.push(buildOpenDrawerEscPosBuffer());
  }

  return Buffer.concat(lines);
}

export async function printOrderToNetworkPrinter(
  order: any,
  storeInfo: any
): Promise<{ success: boolean; message: string }> {
  const rawIp = (storeInfo?.networkPrinterIp || '').trim();
  const targetIp = (rawIp === '192.168.1.200' || !rawIp) ? '192.168.0.90' : rawIp;
  const targetPort = Number(storeInfo?.networkPrinterPort) || 9100;

  if (!targetIp) {
    return { success: false, message: 'IP da impressora de rede não configurado.' };
  }

  try {
    const escPosBuffer = buildOrderEscPosBuffer(order, storeInfo);
    console.log(`[Printer Network] Enviando pedido #${order?.id} (${escPosBuffer.length} bytes) para ${targetIp}:${targetPort}...`);
    return await sendRawToNetworkPrinter(targetIp, targetPort, escPosBuffer, 4000);
  } catch (err: any) {
    console.error(`[Printer Network] Erro ao imprimir pedido #${order?.id}:`, err);
    return { success: false, message: err?.message || 'Erro ao gerar ou enviar cupom' };
  }
}

export function setupPrinterRoutes(app: Express) {
  // Testar conexão direta com IP da impressora
  app.post('/api/printer/test-ip', async (req: Request, res: Response) => {
    try {
      const { ip, port } = req.body || {};
      const targetIp = (ip || '').trim();
      const targetPort = Number(port) || 9100;

      if (!targetIp) {
        return res.status(400).json({
          success: false,
          message: 'Por favor, informe o endereço IP da impressora de rede.'
        });
      }

      console.log(`[Printer Network] Testando conexão com ${targetIp}:${targetPort}...`);
      const testBuffer = buildTestEscPosBuffer(targetIp, targetPort);
      const result = await sendRawToNetworkPrinter(targetIp, targetPort, testBuffer, 4000);

      return res.json(result);
    } catch (err: any) {
      console.error('[Printer Network] Erro no teste de IP:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Erro interno ao tentar conectar na impressora'
      });
    }
  });

  // Imprimir pedido via Socket TCP na impressora de rede
  app.post('/api/printer/network-print', async (req: Request, res: Response) => {
    try {
      const { ip, port, escPosBase64 } = req.body || {};
      const targetIp = (ip || '').trim();
      const targetPort = Number(port) || 9100;

      if (!targetIp) {
        return res.status(400).json({
          success: false,
          message: 'Endereço IP da impressora de rede não fornecido.'
        });
      }

      if (!escPosBase64) {
        return res.status(400).json({
          success: false,
          message: 'Conteúdo ESC/POS em base64 não fornecido.'
        });
      }

      const buffer = Buffer.from(escPosBase64, 'base64');
      console.log(`[Printer Network] Enviando cupom (${buffer.length} bytes) para ${targetIp}:${targetPort}...`);
      const result = await sendRawToNetworkPrinter(targetIp, targetPort, buffer, 4000);

      return res.json(result);
    } catch (err: any) {
      console.error('[Printer Network] Erro ao imprimir via rede:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Erro ao comunicar com a impressora de rede'
      });
    }
  });

  // Disparo de abertura da gaveta de dinheiro (Conector RJ-11 / RJ-12 atrás da impressora)
  app.post('/api/printer/open-drawer', async (req: Request, res: Response) => {
    try {
      const { ip, port } = req.body || {};
      const targetIp = (ip || '192.168.0.90').trim();
      const targetPort = Number(port) || 9100;

      console.log(`[Printer Network] Disparando pulso de abertura de gaveta (RJ-11) para ${targetIp}:${targetPort}...`);
      const drawerBuffer = buildOpenDrawerEscPosBuffer();
      const result = await sendRawToNetworkPrinter(targetIp, targetPort, drawerBuffer, 3000);

      return res.json(result);
    } catch (err: any) {
      console.error('[Printer Network] Erro ao abrir gaveta de dinheiro:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Erro ao enviar comando de abertura para a gaveta'
      });
    }
  });
}

/**
 * Cria buffer ESC/POS com comando universal de abertura de gaveta (Cash Drawer Kick)
 * Gera pulso elétrico no pino 2 e pino 5 do conector RJ-11/RJ-12 da impressora
 */
export function buildOpenDrawerEscPosBuffer(): Buffer {
  return Buffer.from([
    // Inicialização
    0x1B, 0x40,
    // ESC p 0 25 250 (Pino 2: 50ms ON / 500ms OFF)
    0x1B, 0x70, 0x00, 0x19, 0xFA,
    // ESC p 1 25 250 (Pino 5: 50ms ON / 500ms OFF)
    0x1B, 0x70, 0x01, 0x19, 0xFA,
    // BEL (Comando alternativo compatível com Bematech/Daruma/Elgin)
    0x07
  ]);
}
