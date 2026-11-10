import { getStoreCurrentStatus, parseWeeklySchedule } from './scheduleHelper';

interface FallbackResult {
  reply: string;
  structuredOrder?: {
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
  } | null;
  whatsappLink?: string;
  agentName: string;
}

export function generateClientFallbackAnswer(
  userQuery: string,
  storeInfo: any,
  products: any[] = [],
  categories: any[] = [],
  history: any[] = []
): FallbackResult {
  const agentName = storeInfo?.aiAgentName || 'Dona Mara IA';
  const query = (userQuery || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const phone = (storeInfo?.aiAgentWhatsAppPhone || storeInfo?.whatsapp || '').replace(/\D/g, '');
  const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const defaultMsg = encodeURIComponent(`Olá! Estava conversando com ${agentName} no cardápio digital e gostaria de fazer meu pedido.`);
  const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${defaultMsg}` : '';

  const currentStatus = getStoreCurrentStatus(
    storeInfo?.weeklySchedule,
    storeInfo?.isOpen !== false,
    !!storeInfo?.autoOpenClose
  );
  const weeklySchedule = parseWeeklySchedule(storeInfo?.weeklySchedule);

  // 1. Inquiries about opening hours, currently open / closed, "hoje não funciona mais? só amanhã?"
  if (
    query.includes('hoje') ||
    query.includes('funciona') ||
    query.includes('horario') ||
    query.includes('hora') ||
    query.includes('aberto') ||
    query.includes('abre') ||
    query.includes('fecha') ||
    query.includes('fechada') ||
    query.includes('amanha') ||
    query.includes('domingo') ||
    query.includes('segunda') ||
    query.includes('sabado')
  ) {
    const scheduleLines = weeklySchedule.map(
      (d) => `• **${d.dayName}**: ${d.isOpen ? `${d.openTime} às ${d.closeTime}` : 'Fechado'}`
    ).join('\n');

    if (query.includes('so amanha') || query.includes('nao funciona mais') || query.includes('fechou') || query.includes('fechado')) {
      if (!currentStatus.isOpenNow) {
        return {
          reply: `Isso mesmo! No momento nossa loja física já está **fechada**. Reabriremos amanhã cedinho com fornadas fresquinhas de pão e café quentinho esperando por você! 🥖☕\n\nConfira nosso horário semanal:\n${scheduleLines}`,
          whatsappLink,
          agentName,
        };
      } else {
        return {
          reply: `Estamos **abertos agora**! 🟢 Nosso atendimento hoje segue até às **${currentStatus.todaySchedule?.closeTime || '20:00'}**. Venha nos visitar ou faça seu pedido por aqui!`,
          whatsappLink,
          agentName,
        };
      }
    }

    return {
      reply: `Nosso horário de funcionamento é:\n\n${scheduleLines}\n\n${
        currentStatus.isOpenNow
          ? '🟢 **Estamos abertos agora!** Venha nos visitar ou faça seu pedido por aqui.'
          : '🔴 **No momento a loja física está fechada**, mas você pode consultar o cardápio e adiantar seu pedido.'
      }`,
      whatsappLink,
      agentName,
    };
  }

  // 2. Suggestions / Recommendations ("o que você me sugere para o café da tarde?")
  if (
    query.includes('sugere') ||
    query.includes('sugestao') ||
    query.includes('recomenda') ||
    query.includes('combina') ||
    query.includes('cafe da tarde') ||
    query.includes('cafe da manha') ||
    query.includes('lanche') ||
    query.includes('especial')
  ) {
    const activeProducts = products.filter(
      (p) => p && p.name && p.isActive !== false && p.availableInStore !== false && !p.isAddon && !p.isFlavor
    );
    const sample = activeProducts.slice(0, 5);
    const list = sample
      .map((p) => `• **${p.name}** – R$ ${Number(p.price || 0).toFixed(2).replace('.', ',')}`)
      .join('\n');

    return {
      reply: `Para um café especial ou lanche, aqui vão nossas combinações mais pedidas e deliciosas:\n\n${
        list ||
        '• **Salgados Fresquinhos**\n• **Encomendas para Festas e Revenda**'
      }\n\nDeseja que eu anote seu pedido ou adicione ao carrinho?`,
      whatsappLink,
      agentName,
    };
  }

  // 3. Price or Product Specific Inquiry ("quanto custa o bolo", "qual o valor do pao")
  const matchedProd = products.find((p) => {
    if (!p || !p.name) return false;
    const pName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return pName.length > 2 && (query.includes(pName) || (pName.length > 5 && query.includes(pName.substring(0, 5))));
  });

  if (
    matchedProd &&
    (query.includes('quanto') ||
      query.includes('preco') ||
      query.includes('valor') ||
      query.includes('tem') ||
      query.includes('possui') ||
      query.includes('qual'))
  ) {
    const priceFormatted = `R$ ${Number(matchedProd.price || 0).toFixed(2).replace('.', ',')}`;
    const desc = matchedProd.description ? ` (${matchedProd.description})` : '';
    return {
      reply: `O **${matchedProd.name}** está saindo por **${priceFormatted}**${desc}. Posso adicionar ao seu pedido?`,
      whatsappLink,
      agentName,
    };
  }

  // 4. Order Intent ("quero 2 pães de queijo e 1 café")
  if (
    query.includes('quero') ||
    query.includes('pedir') ||
    query.includes('comprar') ||
    query.includes('pedido') ||
    query.includes('monte') ||
    query.includes('anote') ||
    query.includes('adicionar')
  ) {
    const matchedItems: Array<{ name: string; quantity: number; price: number }> = [];
    let total = 0;

    for (const p of products) {
      if (!p || !p.name || p.isActive === false) continue;
      const pName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (pName.length > 2 && query.includes(pName)) {
        // Simple quantity detection (e.g. "2 pao de queijo")
        const regex = new RegExp(`(\\d+)\\s*(?:x|de)?\\s*${pName.substring(0, Math.min(pName.length, 6))}`, 'i');
        const match = query.match(regex);
        const qty = match && match[1] ? parseInt(match[1], 10) : 1;
        const price = Number(p.price || 0);

        matchedItems.push({ name: p.name, quantity: qty, price });
        total += price * qty;
      }
    }

    if (matchedItems.length > 0) {
      const itemsList = matchedItems
        .map((m) => `• ${m.quantity}x **${m.name}** – R$ ${(m.price * m.quantity).toFixed(2).replace('.', ',')}`)
        .join('\n');

      return {
        reply: `Perfeito! Preparei seu pedido:\n\n${itemsList}\n\n💰 **Total: R$ ${total.toFixed(2).replace('.', ',')}**\n\nEscolha abaixo se deseja **Adicionar ao Carrinho** para continuar comprando ou **Pedir no WhatsApp**!`,
        structuredOrder: { items: matchedItems, total },
        whatsappLink,
        agentName,
      };
    }
  }

  // 5. Payment Methods
  if (
    query.includes('pagamento') ||
    query.includes('pix') ||
    query.includes('cartao') ||
    query.includes('dinheiro') ||
    query.includes('pagar') ||
    query.includes('troco')
  ) {
    return {
      reply: `Aceitamos as seguintes formas de pagamento:\n\n💳 **Cartão de Crédito e Débito** (principais bandeiras)\n📱 **PIX Instantâneo** (rápido e seguro)\n💵 **Dinheiro** (com troco facilitado para entrega ou balcão)\n\nVocê escolhe como pagar na finalização!`,
      whatsappLink,
      agentName,
    };
  }

  // 6. Delivery and Location
  if (query.includes('entrega') || query.includes('delivery') || query.includes('taxa') || query.includes('onde fica') || query.includes('endereco')) {
    return {
      reply: `📍 **Endereço:** ${storeInfo?.address || 'Consulte nosso endereço no topo do cardápio'}.\n\n🛵 **Delivery:** Fazemos entregas em diversos bairros da região com taxa calculada no checkout!\n🏬 **Retirada no Balcão:** Você também pode adiantar seu pedido pelo cardápio e retirar sem filas.`,
      whatsappLink,
      agentName,
    };
  }

  // 7. Menu / Categories
  if (query.includes('cardapio') || query.includes('menu') || query.includes('opcoes') || query.includes('o que tem')) {
    const activeCats = categories.filter((c) => c && c.isVisible !== false);
    const catList = activeCats.slice(0, 6).map((c) => `• **${c.name}**`).join('\n');
    return {
      reply: `Temos diversas delícias preparadas diariamente!\n\n${catList || '• Pães & Folhados\n• Cafés & Bebidas\n• Lanches & Salgados\n• Doces & Bolos'}\n\nVocê pode me perguntar sobre qualquer produto ou me dizer o que deseja pedir! 🥖☕`,
      whatsappLink,
      agentName,
    };
  }

  // 8. General conversational response
  return {
    reply: `Com certeza! Posso te ajudar com preços, horários de funcionamento, opções de café e lanche ou montar seu pedido. O que você gostaria de saber? 😊`,
    whatsappLink,
    agentName,
  };
}
