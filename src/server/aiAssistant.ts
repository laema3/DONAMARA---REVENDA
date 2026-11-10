import { GoogleGenAI } from '@google/genai';
import { Request, Response } from 'express';
import { getStoreCurrentStatus, parseWeeklySchedule, formatWeeklyScheduleSummary } from '../utils/scheduleHelper';
import { isExcludedCategory, shouldExcludeProduct } from '../constants';

export function registerAiRoutes(app: any, getLiveDbState: () => { categories: any[]; products: any[]; storeInfo: any }) {
  // Main AI Virtual Agent Chat Endpoint
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userMessage } = req.body;
      const dbState = getLiveDbState();
      const storeInfo = dbState.storeInfo || {};
      const rawCategories = dbState.categories || [];
      const rawProducts = dbState.products || [];

      const currentStatus = getStoreCurrentStatus(
        storeInfo.weeklySchedule,
        storeInfo.isOpen !== false,
        !!storeInfo.autoOpenClose
      );

      const weeklySchedule = parseWeeklySchedule(storeInfo.weeklySchedule);
      const scheduleSummary = formatWeeklyScheduleSummary(weeklySchedule);

      // 1. Filter only active, visible, non-maintenance categories available for in-store consumption
      const activeCategories = rawCategories.filter((c: any) => 
        c && 
        c.id && 
        typeof c.name === 'string' && 
        c.isVisible !== false && 
        c.availableInStore !== false && 
        !isExcludedCategory(c.name)
      );

      const activeCategoryIds = new Set(activeCategories.map((c: any) => c.id));

      // 2. Filter active products that belong to active categories, available in store and not excluded
      const activeProducts = rawProducts.filter((p: any) => 
        p && 
        p.isActive !== false && 
        p.availableInStore !== false && 
        !p.isAddon && 
        !p.isFlavor && 
        !shouldExcludeProduct(p, rawCategories) &&
        activeCategoryIds.has(p.categoryId)
      );

      const availableAddons = rawProducts.filter((p: any) => 
        p && 
        p.isActive !== false && 
        p.availableInStore !== false && 
        p.isAddon && 
        !shouldExcludeProduct(p, rawCategories)
      );

      const availableFlavors = rawProducts.filter((p: any) => 
        p && 
        p.isActive !== false && 
        p.availableInStore !== false && 
        p.isFlavor && 
        !shouldExcludeProduct(p, rawCategories)
      );

      // 3. Keep only active categories that have at least one active in-store product
      const activeCategoriesWithProducts = activeCategories.filter((c: any) =>
        activeProducts.some((p: any) => p.categoryId === c.id)
      );
      
      // Build categorized product catalog for AI grounding (Strictly In-Store Active Only)
      const catalogByCategory: Record<string, any[]> = {};
      for (const cat of activeCategoriesWithProducts) {
        const prodsInCat = activeProducts.filter((p: any) => p.categoryId === cat.id);
        if (prodsInCat.length > 0) {
          catalogByCategory[cat.name] = prodsInCat;
        }
      }

      const catalogSummary = Object.entries(catalogByCategory).map(([catName, prods]) => {
        const items = prods.map((p: any) => 
          `  - ${p.name}: R$ ${Number(p.price).toFixed(2).replace('.', ',')}${p.description ? ` | Descrição: "${p.description}"` : ''}`
        ).join('\n');
        return `* Categoria: ${catName} (${prods.length} itens disponíveis para consumo na loja):\n${items}`;
      }).join('\n\n');

      const categoriesListSummary = activeCategoriesWithProducts.map(c => `• ${c.name}`).join('\n');

      const addonsSummary = availableAddons.length > 0
        ? availableAddons.map((a: any) => `  - ${a.name}: + R$ ${Number(a.price).toFixed(2).replace('.', ',')}`).join('\n')
        : 'Adicionais padrão da chapa (queijo, ovo, bacon, etc.) disponíveis.';

      const flavorsSummary = availableFlavors.length > 0
        ? availableFlavors.map((f: any) => `  - ${f.name}`).join('\n')
        : 'Sabores variados de sucos naturais e polpas (Laranja, Maracujá, Acerola, Abacaxi, Limão, Morango, Caju, etc.).';

      const agentName = storeInfo.aiAgentName || 'Dona Mara IA';
      const agentTone = storeInfo.aiAgentTone || 'amigavel';
      const customPrompt = storeInfo.aiAgentCustomPrompt || '';
      const knowledgeBase = storeInfo.aiAgentKnowledgeBase || '';
      const forbiddenPhrases = storeInfo.aiAgentForbiddenPhrases || '';
      const creativity = typeof storeInfo.aiAgentCreativity === 'number' ? storeInfo.aiAgentCreativity : 0.65;
      const antiRepeatStrict = storeInfo.aiAgentAntiRepeat !== false;
      const whatsappNumber = storeInfo.aiAgentWhatsAppPhone || storeInfo.whatsapp || '';

      // Parse training examples (few-shot dialogues)
      let parsedTrainingExamples: Array<{ question: string; answer: string; active?: boolean }> = [];
      try {
        if (typeof storeInfo.aiAgentTrainingExamples === 'string' && storeInfo.aiAgentTrainingExamples.trim()) {
          parsedTrainingExamples = JSON.parse(storeInfo.aiAgentTrainingExamples);
        } else if (Array.isArray(storeInfo.aiAgentTrainingExamples)) {
          parsedTrainingExamples = storeInfo.aiAgentTrainingExamples;
        }
      } catch (e) {
        parsedTrainingExamples = [];
      }

      const activeTrainingExamples = parsedTrainingExamples.filter(
        (ex) => ex && ex.active !== false && ex.question && ex.answer
      );

      const trainingExamplesSummary = activeTrainingExamples.length > 0
        ? activeTrainingExamples.map((ex, idx) => 
            `[EXEMPLO DE TREINAMENTO ${idx + 1}]\nPergunta do Cliente: "${ex.question}"\nSua Resposta Ideal: "${ex.answer}"`
          ).join('\n\n')
        : 'Nenhum diálogo personalizado cadastrado ainda. Siga o padrão de atendimento acolhedor e informativo da loja.';

      const toneDescription = agentTone === 'direto' 
        ? 'Seja direto, rápido e objetivo, priorizando respostas curtas e claras.'
        : agentTone === 'especialista'
        ? 'Seja um consultor gastronômico apaixonado por gastronomia e produtos selecionados, explicando detalhes dos ingredientes e harmonizações.'
        : 'Seja acolhedor, simpático, atencioso e prestativo, como o melhor atendente da DONAMARA - REVENDA.';

      const systemInstruction = `Você é "${agentName}", atendente virtual oficial e especialista no cardápio de "${storeInfo.name || 'DONAMARA - REVENDA'}".

SUA BASE DE CONHECIMENTO COMPLETA:
- Nome do Estabelecimento: ${storeInfo.name || 'DONAMARA - REVENDA'}
- Endereço Físico: ${storeInfo.address || 'Consulte o endereço na loja'}
- Telefone / WhatsApp Oficial: ${whatsappNumber || 'Consulte na loja'}

HORÁRIO DE ATENDIMENTO E FUNCIONAMENTO:
- Status Agora em Tempo Real: ${currentStatus.isOpenNow ? '🟢 ABERTO AGORA' : '🔴 FECHADO NO MOMENTO'} (${currentStatus.details})
- Horários da Semana:
${weeklySchedule.map(d => `  * ${d.dayName}: ${d.isOpen ? `${d.openTime} às ${d.closeTime}` : 'Fechado'}`).join('\n')}

FORMAS E CONDIÇÕES DE PAGAMENTO ACEITAS:
- PIX (instantâneo)
- Cartão de Crédito (todas as principais bandeiras)
- Cartão de Débito
- Dinheiro (com opção de troco para o valor informado pelo cliente)
- O pagamento pode ser feito na entrega (para delivery) ou na retirada no balcão da loja.

MODALIDADES DE PEDIDO E ATENDIMENTO:
1) **Delivery (Entrega em Domicílio)**: O cliente informa o endereço e recebe o pedido em casa quentinho.
2) **Consumo na Loja / Retirada no Balcão**: O cliente retira o pedido na loja física ou consome no local.
3) **Totem de Autoatendimento**: É um terminal exclusivo instalado na loja física para uso presencial no balcão.

CATEGORIAS ATIVAS DISPONÍVEIS EXCLUSIVAMENTE PARA CONSUMO NA LOJA (${activeCategoriesWithProducts.length} categorias ativas):
${categoriesListSummary || 'Categorias em atualização.'}

CARDÁPIO OFICIAL DE PRODUTOS E PREÇOS REAIS (APENAS ITENS E CATEGORIAS ATIVAS PARA CONSUMO NA LOJA):
${catalogSummary || 'Cardápio em atualização.'}

COMPLEMENTOS E ADICIONAIS DE LANCHES/CHAPA:
${addonsSummary}

SABORES DE SUCOS E BEBIDAS:
${flavorsSummary}

INFORMAÇÕES EXTRAS DO ESTABELECIMENTO:
${customPrompt || 'Salgados especiais fritos e assados na hora, kits para festa, revenda e atacado, lanches e bebidas geladas.'}

${knowledgeBase ? `CONTEÚDOS E POLÍTICAS DE ATENDIMENTO APRENDIDOS (BASE DE CONHECIMENTO CADASTRADA PELO GERENTE):\n${knowledgeBase}\n` : ''}
${forbiddenPhrases ? `RESTRIÇÕES IMPORTANTES (O QUE NUNCA DIZER OU PROMETER AO CLIENTE):\n${forbiddenPhrases}\n` : ''}

══════════════════════════════════════════════════════════════
EXEMPLOS REAIS DE TREINAMENTO (COMO VOCÊ DEVE RESPONDER / FEW-SHOT):
══════════════════════════════════════════════════════════════
Use os diálogos de exemplo abaixo como seu guia supremo de estilo, precisão e vocabulário:

${trainingExamplesSummary}

══════════════════════════════════════════════════════════════
REGRAS CRÍTICAS DE COMPORTAMENTO E DIRETRIZES ANTI-REPETIÇÃO:
══════════════════════════════════════════════════════════════
1. **PROIBIDO REPETIR RESPOSTAS OU SAUDAÇÕES PADRONIZADAS**:
   - ${antiRepeatStrict ? 'NUNCA repita "Olá! Sou Dona Mara IA...", "Olá!", "Como posso ajudar?" se a conversa já estiver em andamento.' : ''}
   - Se o cliente acabou de fazer uma nova pergunta ou continuar um pedido, responda DIRETO e CONCISE ao que foi perguntado.
   - NUNCA repita o mesmo parágrafo ou as mesmas frases ditas anteriormente no histórico da conversa.
   - Varie a forma de se expressar com naturalidade e simpatia humana, evitando respostas robóticas ou mecânicas.

2. **REGRA SUPREMA: APENAS CATEGORIAS E PRODUTOS ATIVOS PARA CONSUMO NA LOJA**:
   - Quando alguém pedir o cardápio, solicitar ver as opções, perguntar o que tem para comer/beber ou pedir sugestões/preços, você DEVE mostrar e sugerir APENAS E EXCLUSIVAMENTE as categorias e produtos ativos para consumo na loja listados na base de conhecimento acima.
   - NENHUMA categoria ou produto inativo, desativado, não disponível para consumo na loja ou externo deve ser citado, sugerido ou inventado.
   - Se o cliente pedir o cardápio, apresente de forma organizada e limpa as categorias ativas com seus respectivos produtos e valores exatos.
   - Se o cliente perguntar por algum item que não esteja na lista de consumo na loja, informe com simpatia que no momento não temos esse item disponível para consumo na loja e indique as opções ativas disponíveis.

3. **DOMÍNIO TOTAL DO CARDÁPIO, PREÇOS E DESCRIÇÕES**:
   - Sempre forneça o valor EXATO e o nome correto do produto conforme a tabela acima (ex: "O Pão de Queijo custa R$ X,XX").
   - Se o cliente perguntar o que tem em uma categoria (ex: "quais cafés vocês têm?", "quais salgados?"), liste os itens e preços daquela categoria com clareza.
   - Se o cliente perguntar ingredientes ou descrições, utilize as informações da base de conhecimento.

4. **HORÁRIOS E PAGAMENTOS**:
   - Ao ser questionado sobre horários, informe o horário de hoje ou da semana de forma precisa e indique se a loja está aberta agora.
   - Ao ser questionado sobre pagamentos, confirme claramente que aceita PIX, Cartão de Crédito, Débito e Dinheiro com troco.

5. **ELABORAÇÃO DE PEDIDOS E DIRECIONAMENTO AO CARRINHO (FLUXO COMPLETO)**:
   - Se o cliente solicitar itens, pedir sugestões ou montar um pedido na conversa:
     a) Resuma os itens escolhidos com quantidades, valores unitários e valor total.
     b) **Pergunte sempre se ele deseja algo mais** (ex: *"Deseja adicionar mais alguma bebida gelada ou sobremesa?"*).
     c) **Pergunte a modalidade de recebimento**: se ele prefere **Delivery (Entrega em Domicílio)** ou **Retirada no Balcão**.
     d) **Oriente sobre o cadastro e CEP**: Informe que caso seja a primeira vez ou ainda não tenha cadastro, o carrinho fará um breve cadastro e a verificação de CEP para o cálculo da taxa de entrega.
     e) **Informe prazos**: Diga o tempo estimado de preparo (média de 15 a 25 minutos) e o tempo de rota para entrega.
     f) **REGRA OBRIGATÓRIA DE FINALIZAÇÃO**: Oriente o cliente com muita clareza a **ir até o carrinho de compras** (clicando no ícone do carrinho) para revisar e **finalizar o pedido**, explicando que a conversa com o atendente virtual serve para montagem e sugestões, e o pedido só é enviado para a cozinha e painel de controle após ser concluído no carrinho.
     g) Adicione no final da sua mensagem a tag de estruturação se necessário:
        [[DRAFT_ORDER: item1:quantidade:precoUnitario, item2:quantidade:precoUnitario]]
        Exemplo: [[DRAFT_ORDER: Coxinha de Frango:2:7.50, Refrigerante Lata:1:6.00]]

TOM DE VOZ:
- ${toneDescription}
- Sempre em Português do Brasil com excelente pontuação, clareza e simpatia.
`;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Fallback intelligent conversation
        const fallback = generateConversationalFallback(
          userMessage || '',
          storeInfo,
          currentStatus,
          weeklySchedule,
          activeProducts,
          availableAddons,
          availableFlavors,
          activeCategoriesWithProducts,
          agentName,
          messages || []
        );
        return res.json(fallback);
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Sanitize and normalize conversation history for Gemini API:
      // 1. Must strictly start with 'user'
      // 2. Must alternate 'user' -> 'model' -> 'user'
      // 3. Must end with the latest 'user' prompt
      const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

      if (Array.isArray(messages)) {
        for (const msg of messages) {
          const role: 'user' | 'model' = (msg.role === 'assistant' || msg.role === 'model' || msg.sender === 'assistant') ? 'model' : 'user';
          const text = (msg.content || msg.text || '').trim();
          if (text) {
            rawTurns.push({ role, text });
          }
        }
      }

      if (userMessage && userMessage.trim()) {
        const lastTurn = rawTurns[rawTurns.length - 1];
        if (!lastTurn || lastTurn.role !== 'user' || lastTurn.text !== userMessage.trim()) {
          rawTurns.push({ role: 'user', text: userMessage.trim() });
        }
      }

      // Remove leading model turns (e.g. initial welcome message) so conversation starts with user turn
      while (rawTurns.length > 0 && rawTurns[0].role === 'model') {
        rawTurns.shift();
      }

      if (rawTurns.length === 0) {
        rawTurns.push({ role: 'user', text: userMessage?.trim() || 'Olá!' });
      }

      // Collapse adjacent same-role turns so they strictly alternate
      const alternatingTurns: Array<{ role: 'user' | 'model'; text: string }> = [];
      for (const turn of rawTurns) {
        if (alternatingTurns.length === 0) {
          alternatingTurns.push(turn);
        } else {
          const prev = alternatingTurns[alternatingTurns.length - 1];
          if (prev.role === turn.role) {
            prev.text += `\n${turn.text}`;
          } else {
            alternatingTurns.push(turn);
          }
        }
      }

      // Ensure last turn is user
      if (alternatingTurns.length > 0 && alternatingTurns[alternatingTurns.length - 1].role !== 'user') {
        alternatingTurns.push({ role: 'user', text: userMessage?.trim() || 'Pode me ajudar?' });
      }

      const formattedContents = alternatingTurns.map(t => ({
        role: t.role,
        parts: [{ text: t.text }],
      }));

      let responseText = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: creativity,
          },
        });
        responseText = response.text || '';
      } catch (modelErr: any) {
        console.warn('Primary model error, trying fallback model:', modelErr?.message);
        try {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: formattedContents,
            config: {
              systemInstruction,
              temperature: creativity,
            },
          });
          responseText = fallbackRes.text || '';
        } catch (e2: any) {
          console.warn('Secondary model failed, trying conversational fallback generator:', e2?.message);
          const fallback = generateConversationalFallback(
            req.body?.userMessage || '',
            storeInfo,
            currentStatus,
            weeklySchedule,
            activeProducts,
            availableAddons,
            availableFlavors,
            activeCategoriesWithProducts,
            agentName,
            req.body?.messages || []
          );
          return res.json(fallback);
        }
      }

      if (!responseText.trim()) {
        responseText = 'Como posso te ajudar com nosso cardápio hoje?';
      }

      // Parse Draft Order tag if present: [[DRAFT_ORDER: item1:qty:price, item2:qty:price]]
      const draftMatch = responseText.match(/\[\[(?:DRAFT_ORDER|PEDIDO_WHATSAPP|PEDIDO_ITENS):\s*([^\]]+)\]\]/i);
      let structuredOrder: { items: Array<{ name: string; quantity: number; price: number }>; total: number } | null = null;

      if (draftMatch && draftMatch[1]) {
        const rawItems = draftMatch[1].split(',');
        const parsedItems: Array<{ name: string; quantity: number; price: number }> = [];
        let total = 0;

        for (const raw of rawItems) {
          const parts = raw.trim().split(':');
          const name = parts[0]?.trim();
          const qty = parseInt(parts[1]?.trim() || '1', 10) || 1;
          const price = parseFloat(parts[2]?.trim() || '0') || 0;

          if (name) {
            parsedItems.push({ name, quantity: qty, price });
            total += price * qty;
          }
        }

        if (parsedItems.length > 0) {
          structuredOrder = { items: parsedItems, total };
        }

        responseText = responseText.replace(/\[\[(?:DRAFT_ORDER|PEDIDO_WHATSAPP|PEDIDO_ITENS):\s*[^\]]+\]\]/gi, '').trim();
      }

      // Generate direct WhatsApp link
      const cleanPhone = (whatsappNumber || '').replace(/\D/g, '');
      let whatsappLink = '';
      if (cleanPhone) {
        const defaultMsg = encodeURIComponent(`Olá! Estava conversando com ${agentName} no site da loja e gostaria de atendimento.`);
        whatsappLink = `https://wa.me/55${cleanPhone.replace(/^55/, '')}?text=${defaultMsg}`;
      }

      return res.json({
        reply: responseText,
        structuredOrder,
        whatsappLink,
        agentName,
      });

    } catch (error: any) {
      console.error('Error in /api/ai/chat (falling back to local conversational engine):', error?.message || error);
      
      try {
        const dbState: any = getLiveDbState() || {};
        const storeInfo = dbState.storeInfo || {};
        const currentStatus = getStoreCurrentStatus(storeInfo.weeklySchedule, storeInfo.isOpen !== false, !!storeInfo.autoOpenClose);
        const weeklySchedule = parseWeeklySchedule(storeInfo.weeklySchedule);
        const rawCategories = Array.isArray(dbState.categories) ? dbState.categories : [];
        const rawProducts = Array.isArray(dbState.products) ? dbState.products : [];

        const activeCategories = rawCategories.filter((c: any) => 
          c && 
          c.id && 
          typeof c.name === 'string' && 
          c.isVisible !== false && 
          c.availableInStore !== false && 
          !isExcludedCategory(c.name)
        );

        const activeCategoryIds = new Set(activeCategories.map((c: any) => c.id));

        const activeProducts = rawProducts.filter((p: any) => 
          p && 
          p.name &&
          p.isActive !== false && 
          p.availableInStore !== false && 
          !p.isAddon && 
          !p.isFlavor && 
          !shouldExcludeProduct(p, rawCategories) &&
          activeCategoryIds.has(p.categoryId)
        );

        const availableAddons = rawProducts.filter((p: any) => 
          p && 
          p.name &&
          p.isActive !== false && 
          p.availableInStore !== false && 
          p.isAddon && 
          !shouldExcludeProduct(p, rawCategories)
        );

        const availableFlavors = rawProducts.filter((p: any) => 
          p && 
          p.name &&
          p.isActive !== false && 
          p.availableInStore !== false && 
          p.isFlavor && 
          !shouldExcludeProduct(p, rawCategories)
        );

        const activeCategoriesWithProducts = activeCategories.filter((c: any) =>
          activeProducts.some((p: any) => p.categoryId === c.id)
        );

        const agentName = storeInfo.aiAgentName || 'Dona Mara IA';

        const fallback = generateConversationalFallback(
          req.body?.userMessage || '',
          storeInfo,
          currentStatus,
          weeklySchedule,
          activeProducts,
          availableAddons,
          availableFlavors,
          activeCategoriesWithProducts,
          agentName,
          req.body?.messages || []
        );
        return res.json(fallback);
      } catch (innerFallbackErr) {
        console.error('Inner error in fallback generator:', innerFallbackErr);
        return res.json({
          reply: `Olá! Sou Dona Mara IA, atendente virtual da DONAMARA. Posso te ajudar com nossos salgados fresquinhos, produtos do cardápio ou anotar seu pedido. O que você gostaria de pedir hoje? 🥟✨`,
          agentName: 'Dona Mara IA',
        });
      }
    }
  });

  // Direct endpoint to generate clean WhatsApp links with complete order details
  app.post('/api/ai/format-whatsapp-order', (req: Request, res: Response) => {
    try {
      const { items, customerName, customerPhone, deliveryType, deliveryAddress, paymentMethod, notes } = req.body;
      const dbState = getLiveDbState();
      const storeInfo = dbState.storeInfo || {};
      const agentName = storeInfo.aiAgentName || 'Dona Mara IA';
      const phone = (storeInfo.aiAgentWhatsAppPhone || storeInfo.whatsapp || '').replace(/\D/g, '');

      if (!phone) {
        return res.status(400).json({ error: 'Número de WhatsApp da loja não configurado.' });
      }

      let total = 0;
      const itemsText = (items || []).map((item: any) => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        total += itemTotal;
        return `• ${item.quantity}x *${item.name}* - R$ ${itemTotal.toFixed(2).replace('.', ',')}`;
      }).join('\n');

      const message = `🥟 *PEDIDO VIA ATENDENTE VIRTUAL (${agentName})* 🥟
*${storeInfo.name || 'DONAMARA - REVENDA'}*

📋 *Itens do Pedido:*
${itemsText || '• (Itens a combinar)'}

💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}

👤 *Cliente:* ${customerName || 'Não informado'}
📞 *Telefone:* ${customerPhone || 'Não informado'}
📍 *Modalidade:* ${deliveryType === 'delivery' ? `🛵 Entrega em: ${deliveryAddress || 'Endereço a combinar'}` : '🏬 Retirada no Balcão'}
💳 *Pagamento:* ${paymentMethod || 'A combinar'}
${notes ? `📝 *Observação:* ${notes}\n` : ''}
Gostaria de confirmar meu pedido! 😊`;

      const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      return res.json({
        success: true,
        whatsappUrl,
        formattedMessage: message,
        total,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}

function generateConversationalFallback(
  userQuery: string,
  storeInfo: any = {},
  currentStatus: any = {},
  weeklySchedule: any[] = [],
  products: any[] = [],
  availableAddons: any[] = [],
  availableFlavors: any[] = [],
  categories: any[] = [],
  agentName: string = 'Dona Mara IA',
  history: any[] = []
) {
  try {
    const query = (userQuery || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const phone = (storeInfo?.aiAgentWhatsAppPhone || storeInfo?.whatsapp || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Olá! Gostaria de fazer meu pedido.')}` : '';

    const safeProducts = Array.isArray(products) ? products.filter((p: any) => p && typeof p.name === 'string' && p.name.trim().length > 0) : [];
    const safeCategories = Array.isArray(categories) ? categories.filter((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0) : [];
    const safeSchedule = Array.isArray(weeklySchedule) ? weeklySchedule : [];

    // 0. Greetings ("bom dia", "boa tarde", "boa noite", "ola", "oi")
    if (
      query.includes('bom dia') ||
      query.includes('boa tarde') ||
      query.includes('boa noite') ||
      query.includes('ola') ||
      query === 'oi' ||
      query.includes('oi ') ||
      query.includes('tudo bem') ||
      query.includes('e ai')
    ) {
      const greeting = query.includes('bom dia') ? 'Bom dia!' : query.includes('boa tarde') ? 'Boa tarde!' : query.includes('boa noite') ? 'Boa noite!' : 'Olá!';
      return {
        reply: `${greeting} Sou **${agentName}**, atendente virtual da **${storeInfo?.name || 'DONAMARA - REVENDA'}**. 🥟✨\n\nComo posso te ajudar a montar seu pedido ou tirar dúvidas sobre o nosso cardápio hoje?`,
        whatsappLink,
        agentName,
      };
    }

    // Helper to find all products mentioned in query
    const findMatchedProducts = (q: string) => {
      const qNorm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
      const matched: Array<{ name: string; quantity: number; price: number; id: string }> = [];

      for (const p of safeProducts) {
        if (!p || !p.name) continue;
        const pNorm = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');

        // Check popular keywords and shortcuts
        const isXtudo = (qNorm.includes('xtudo') || qNorm.includes('x tudo')) && (pNorm.includes('xtudo') || pNorm.includes('x tudo'));
        const isMisto = qNorm.includes('misto') && pNorm.includes('misto');
        const isCaipira = qNorm.includes('caipira') && pNorm.includes('caipira');
        const isChurrasco = qNorm.includes('churrasco') && pNorm.includes('churrasco');
        const isMortadela = qNorm.includes('mortadela') && pNorm.includes('mortadela');
        const isPaoQueijo = (qNorm.includes('pao de queijo') || (qNorm.includes('pao') && qNorm.includes('queijo'))) && pNorm.includes('queijo') && pNorm.includes('pao');
        const isPaoFrances = (qNorm.includes('frances') || (qNorm.includes('pao') && !qNorm.includes('queijo') && !qNorm.includes('lanche'))) && pNorm.includes('frances');
        const isCoxinha = qNorm.includes('coxinha') && pNorm.includes('coxinha');
        const isCafe = (qNorm.includes('cafe') || qNorm.includes('expresso')) && (pNorm.includes('cafe') || pNorm.includes('expresso'));
        const isSuco = (qNorm.includes('suco') || qNorm.includes('laranja')) && (pNorm.includes('suco') || pNorm.includes('laranja'));
        const isBolo = qNorm.includes('bolo') && pNorm.includes('bolo');
        const isMacarrao = qNorm.includes('macarrao') && pNorm.includes('macarrao');

        let isMatch = isXtudo || isMisto || isCaipira || isChurrasco || isMortadela || isPaoQueijo || isPaoFrances || isCoxinha || isCafe || isSuco || isBolo || isMacarrao;

        if (!isMatch) {
          const pWords = pNorm.split(/\s+/).filter(w => w.length > 2 && w !== 'donamara' && w !== 'revenda' && w !== 'especial');
          if (pWords.length > 0 && pWords.every(w => qNorm.includes(w))) {
            isMatch = true;
          }
        }

        if (isMatch && !matched.some(m => m.id === p.id)) {
          matched.push({ id: p.id, name: p.name, quantity: 1, price: Number(p.price || 0) });
        }
      }
      return matched;
    };

    const orderedProducts = findMatchedProducts(query);
    const isOrdering = orderedProducts.length > 0 && (
      query.includes('quero') || 
      query.includes('pedir') || 
      query.includes('comprar') || 
      query.includes('pedido') || 
      query.includes('monte') || 
      query.includes('anote') || 
      query.includes('um ') || 
      query.includes('uma ') || 
      query.includes('dois ') || 
      query.includes('lanche') || 
      query.includes('manda') ||
      query.includes('me da') ||
      query.includes('me ve') ||
      query.includes('faz ')
    );

    if (orderedProducts.length > 0 && isOrdering) {
      const total = orderedProducts.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const itemsList = orderedProducts.map(m => `• ${m.quantity}x **${m.name}** – R$ ${(m.price * m.quantity).toFixed(2).replace('.', ',')}`).join('\n');
      return {
        reply: `Perfeito! Já adicionei ao seu pedido:\n\n${itemsList}\n\n💰 **Total: R$ ${total.toFixed(2).replace('.', ',')}**\n\n🛵 **Deseja entrega em domicílio (Delivery) ou retirada no balcão?**\nAceita adicionar alguma bebida gelada ou sobremesa para acompanhar?\n\n👉 Para conferir os itens e concluir a compra, basta clicar no botão abaixo para **Ver Carrinho e Finalizar**!`,
        structuredOrder: { items: orderedProducts, total },
        whatsappLink,
        agentName,
      };
    }

    // 1. Specific product query or price inquiry
    const matchedProduct = orderedProducts[0] || safeProducts.find((p: any) => {
      const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return pName && (query.includes(pName) || (pName.length > 4 && query.includes(pName.substring(0, 5))));
    });

    if (matchedProduct && (query.includes('quanto') || query.includes('preco') || query.includes('valor') || query.includes('tem') || query.includes('possui') || query.includes('qual o valor'))) {
      const formattedPrice = `R$ ${Number(matchedProduct.price || 0).toFixed(2).replace('.', ',')}`;
      const desc = matchedProduct.description ? ` (${matchedProduct.description})` : '';
      return {
        reply: `O **${matchedProduct.name}** está saindo por **${formattedPrice}**${desc}. Deseja que eu adicione ao seu carrinho de compras?`,
        structuredOrder: { items: [{ name: matchedProduct.name, quantity: 1, price: Number(matchedProduct.price || 0) }], total: Number(matchedProduct.price || 0) },
        whatsappLink,
        agentName,
      };
    }

    // 3. Category queries (e.g., "o que voces tem de doce?", "quais os paes?", "cardapio")
    const matchedCategory = safeCategories.find((c: any) => {
      const cName = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return query.includes(cName) || (cName.includes('pao') && query.includes('pao')) || (cName.includes('doce') && query.includes('doce')) || (cName.includes('salgado') && query.includes('salgado')) || (cName.includes('cafe') && query.includes('cafe'));
    });

    if (matchedCategory) {
      const prodsInCat = safeProducts.filter((p: any) => p.categoryId === matchedCategory.id);
      if (prodsInCat.length > 0) {
        const list = prodsInCat.slice(0, 8).map((p: any) => `• **${p.name}** - R$ ${Number(p.price || 0).toFixed(2).replace('.', ',')}${p.description ? ` (${p.description})` : ''}`).join('\n');
        return {
          reply: `Na categoria **${matchedCategory.name}**, temos:\n\n${list}\n\nQual deles você gostaria de experimentar ou adicionar ao pedido?`,
          whatsappLink,
          agentName,
        };
      }
    }

    if (query.includes('cardapio') || query.includes('menu') || query.includes('categorias') || query.includes('o que tem') || query.includes('o que voces tem') || query.includes('opcoes')) {
      const formattedCategories = safeCategories.map((c: any) => {
        const prods = safeProducts.filter((p: any) => p.categoryId === c.id);
        const items = prods.slice(0, 6).map((p: any) => `  • **${p.name}** - R$ ${Number(p.price || 0).toFixed(2).replace('.', ',')}`).join('\n');
        return `📌 **${c.name}** (${prods.length} itens):\n${items || '  • Itens disponíveis no balcão'}`;
      }).join('\n\n');

      return {
        reply: `Aqui está o nosso cardápio ativo para consumo na loja:\n\n${formattedCategories || 'Nosso cardápio está sendo atualizado.'}\n\nVocê pode me perguntar sobre qualquer item, solicitar preços detalhados ou me pedir para anotar seu pedido! 🥐☕`,
        whatsappLink,
        agentName,
      };
    }

    // 4. Payment Methods
    if (query.includes('pagamento') || query.includes('pix') || query.includes('cartao') || query.includes('dinheiro') || query.includes('pagar') || query.includes('forma de pagamento') || query.includes('troco')) {
      return {
        reply: `Aceitamos as seguintes formas de pagamento:\n\n💳 **Cartão de Crédito e Débito** (principais bandeiras)\n📱 **PIX** (rápido e prático)\n💵 **Dinheiro** (com troco facilitado)\n\nO pagamento pode ser feito tanto na entrega (Delivery) quanto na retirada no balcão!`,
        whatsappLink,
        agentName,
      };
    }

    // 5. Operating Hours
    if (query.includes('horario') || query.includes('hora') || query.includes('aberto') || query.includes('abre') || query.includes('fecha') || query.includes('domingo') || query.includes('segunda') || query.includes('sabado') || query.includes('funciona')) {
      const summary = safeSchedule.map((d: any) => `• **${d.dayName}**: ${d.isOpen ? `${d.openTime} às ${d.closeTime}` : 'Fechado'}`).join('\n');
      return {
        reply: `Nosso horário de funcionamento é:\n\n${summary || '• Segunda a Sábado: 05:30 às 20:00\n• Domingo: 06:00 às 13:00'}\n\n${currentStatus?.isOpenNow ? '🟢 **Estamos abertos agora!** Venha nos visitar ou faça seu pedido por aqui.' : '🔴 **No momento a loja física está fechada**, mas você pode consultar os itens e adiantar seu pedido.'}`,
        whatsappLink,
        agentName,
      };
    }

    // 6. Delivery and pickup
    if (query.includes('entrega') || query.includes('delivery') || query.includes('taxa') || query.includes('buscar') || query.includes('retirar') || query.includes('balcao') || query.includes('totem')) {
      return {
        reply: `Temos duas formas de atendimento:\n\n🛵 **Delivery**: Entregamos no conforto da sua casa ou trabalho.\n🏬 **Consumo / Retirada no Balcão**: Você pode consultar o cardápio e retirar diretamente na nossa loja física${storeInfo?.address ? ` (${storeInfo.address})` : ''}.\n\n*(Nota: O Totem é um terminal de autoatendimento presencial exclusivo para uso no balcão da loja).*`,
        whatsappLink,
        agentName,
      };
    }

    // 7. Suggestions / Recommendations
    if (query.includes('sugere') || query.includes('sugestao') || query.includes('recomenda') || query.includes('combina') || query.includes('o que tem de bom') || query.includes('especial') || query.includes('tarde') || query.includes('manha') || query.includes('lanche')) {
      const sampleProducts = safeProducts.slice(0, 4);
      const prodNames = sampleProducts.map((p: any) => `• **${p.name}** (R$ ${Number(p.price || 0).toFixed(2).replace('.', ',')})`).join('\n');
      
      return {
        reply: `Se você quer uma recomendação especial para seu pedido, que tal experimentar nossos destaques:\n\n${prodNames || '• Salgados Especiais Fritos e Assados\n• Kits de Salgados para Festa\n• Bebidas Geladas'}\n\nDeseja que eu monte um pedido ou adicione algum item ao seu carrinho?`,
        whatsappLink,
        agentName,
      };
    }

    // 8. Address / Location
    if (query.includes('onde') || query.includes('endereco') || query.includes('local') || query.includes('fica') || query.includes('cidade') || query.includes('bairro')) {
      return {
        reply: `📍 Nosso endereço é:\n\n**${storeInfo?.address || 'Consulte nosso endereço atualizado na loja'}**.\n\nVenha nos visitar! 🥟✨`,
        whatsappLink,
        agentName,
      };
    }

    // 9. General query or order attempt fallback - search for products matching user query keywords
    const matchedAnyProd = safeProducts.find((p: any) => {
      const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = query.split(' ').filter(w => w.length > 2);
      return words.some(w => pName.includes(w));
    });

    if (matchedAnyProd) {
      const priceFormatted = `R$ ${Number(matchedAnyProd.price || 0).toFixed(2).replace('.', ',')}`;
      return {
        reply: `Encontrei o produto **${matchedAnyProd.name}** (${priceFormatted}). Deseja que eu adicione ao seu pedido? Para finalizar, lembre-se de ir até o carrinho de compras para concluir a compra!`,
        whatsappLink,
        agentName,
      };
    }

    return {
      reply: `Com certeza! Posso te ajudar a montar seu pedido, informar preços, horários ou tirar dúvidas sobre o cardápio. O que você gostaria de pedir hoje?`,
      whatsappLink,
      agentName,
    };
  } catch (err: any) {
    console.error('generateConversationalFallback inner error:', err);
    return {
      reply: `Olá! Sou ${agentName || 'Dona Mara IA'}, atendente virtual da DONAMARA. Posso te sugerir deliciosas opções de salgados fresquinhos e produtos do nosso cardápio! O que você gostaria de pedir hoje? 🥟✨`,
      agentName: agentName || 'Dona Mara IA',
    };
  }
}
