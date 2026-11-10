import { jsPDF } from 'jspdf';

export function buildDocumentationPdf(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFillColor(234, 88, 12); // Orange #ea580c
    doc.rect(margin, currentY, contentWidth, 2, 'F');
    currentY += 6;
  };

  // --- CAPA / CABEÇALHO ---
  doc.setFillColor(30, 27, 25); // Stone 900
  doc.rect(margin, currentY, contentWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DONAMARA - REVENDA', margin + 6, currentY + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(253, 186, 116); // Orange 300
  doc.text('DOCUMENTAÇÃO TÉCNICA E MANUAL OPERACIONAL DO SISTEMA', margin + 6, currentY + 16);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(7.5);
  doc.text('Versão: 2.8.0 Production | Data: Nov/2026 | Ambiente: Web / Mobile / Totem / KDS', margin + 6, currentY + 21);

  currentY += 30;

  // --- ÍNDICE RÁPIDO ---
  doc.setFillColor(245, 245, 244);
  doc.rect(margin, currentY, contentWidth, 18, 'F');
  doc.setTextColor(68, 64, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SUMÁRIO EXECUTIVO DE MÓDULOS E FUNCIONALIDADES:', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('1. Visão Geral da Plataforma | 2. Modalidade Congelados vs. Prontos | 3. Acréscimo em Pedidos Existentes', margin + 4, currentY + 10);
  doc.text('4. Notificações Inteligentes & 3x/dia | 5. Totem Autoatendimento | 6. Smart TV | 7. Gestão KDS | 8. Backups', margin + 4, currentY + 14);

  currentY += 24;

  const printSectionHeader = (numberStr: string, title: string) => {
    checkPageBreak(16);
    doc.setFillColor(234, 88, 12);
    doc.rect(margin, currentY, 6, 6, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(numberStr, margin + 1.8, currentY + 4.2);

    doc.setTextColor(28, 25, 23);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 9, currentY + 4.8);

    currentY += 8;
    doc.setDrawColor(231, 229, 228);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 4;
  };

  const printParagraph = (text: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 45, 40);
    const lines = doc.splitTextToSize(text, contentWidth);
    const needed = lines.length * 4.2;
    checkPageBreak(needed + 2);
    doc.text(lines, margin, currentY);
    currentY += needed + 2;
  };

  const printBullet = (label: string, desc: string) => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(28, 25, 23);
    doc.text('• ' + label + ': ', margin + 2, currentY);

    const labelWidth = doc.getTextWidth('• ' + label + ': ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(68, 64, 60);
    const remainingWidth = contentWidth - labelWidth - 4;
    const lines = doc.splitTextToSize(desc, remainingWidth);
    
    if (lines.length > 0) {
      doc.text(lines[0], margin + 2 + labelWidth, currentY);
      currentY += 4.2;
      for (let i = 1; i < lines.length; i++) {
        checkPageBreak(4.2);
        doc.text(lines[i], margin + 6, currentY);
        currentY += 4.2;
      }
    } else {
      currentY += 4.2;
    }
  };

  const printAlertBox = (text: string) => {
    const lines = doc.splitTextToSize(text, contentWidth - 8);
    const boxHeight = lines.length * 4.2 + 6;
    checkPageBreak(boxHeight + 2);

    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(254, 202, 202); // Red 200
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28); // Red 700
    doc.text(lines, margin + 4, currentY + 4.5);

    currentY += boxHeight + 3;
  };

  // --- SEÇÃO 1: VISÃO GERAL ---
  printSectionHeader('1', 'Visão Geral da Plataforma DONAMARA');
  printParagraph('O Sistema DONAMARA - REVENDA foi desenvolvido com tecnologia de ponta (React SPA, Vite, Node.js Express, Tailwind CSS e banco sincronizado) para proporcionar agilidade extrema tanto no atendimento digital ao cliente quanto nos processos internos de balcão e produção.');
  printBullet('Cardápio Digital PWA', 'Interface moderna para smartphones e navegadores desktop com carregamento instantâneo, visualização detalhada de salgados, lanches na chapa e cálculo automático de totais.');
  printBullet('Totem de Autoatendimento (/totem)', 'Kiosk em tela cheia com interface de alta acessibilidade para totens verticais ou tablets no balcão da loja física.');
  printBullet('Painel Smart TV (/tv)', 'Exibição de senhas em tempo real com alertas sonoros de chamada e carrossel de vídeos promocionais.');
  printBullet('Painel Admin e KDS (/admin)', 'Gestão completa de pedidos com filtros de status, impressão de comandas térmicas e controle administrativo.');
  currentY += 3;

  // --- SEÇÃO 2: MODALIDADES ---
  printSectionHeader('2', 'Regras de Negócio: Congelados vs. Salgados Prontos');
  printParagraph('Para preservar a qualidade do serviço e evitar divergências de tempo de preparo, o sistema impõe bloqueio rigoroso entre modalidades distintas dentro do mesmo pedido:');
  printBullet('Salgados Prontos (Normais)', 'Destinados ao consumo imediato ou retirada rápida. Disponíveis nas opções Frito/Assado e Cru/Pré-Assado. Não podem ser misturados com itens congelados no mesmo pedido.');
  printBullet('Salgados Congelados', 'Destinados a estoque residencial, festas ou revenda. Possuem prazo de preparo de até 48 horas a partir do envio do pedido, com acréscimo automático de R$ 0,30 por unidade.');
  printAlertBox('Obs: Pedidos congelados com entrega em até 48 horas podem ser antecipados e você será avisado pelo aplicativo.');
  printBullet('Tratamento de Conflito no Carrinho', 'Se o cliente selecionar um salgado pronto com carrinho contendo congelados (ou vice-versa), o bloco correspondente bloqueia com aviso explicativo e botões para finalizar o pedido atual ou limpar o carrinho para começar novo pedido.');
  currentY += 3;

  // --- SEÇÃO 3: ACRÉSCIMO ---
  printSectionHeader('3', 'Funcionalidade de Acréscimo em Pedidos Existentes');
  printParagraph('Permite ao cliente adicionar itens extras a um pedido já enviado caso tenha esquecido algum item, sem gerar pedidos duplicados ou confusão na entrega:');
  printBullet('Critério 1 - Status Pendente', 'O pedido original deve estar exclusivamente em "Pendente". Quando a cozinha altera o status para "Preparando", a opção é desabilitada para evitar retrabalho na linha de produção.');
  printBullet('Critério 2 - Pagamento na Retirada', 'Habilitado especificamente para a condição de Pagamento na Retirada no balcão.');
  printBullet('Critério 3 - Mesma Modalidade', 'Se o pedido for de congelados, só permite acréscimo de congelados. Se for de produtos prontos, só aceita itens prontos.');
  printParagraph('Após a confirmação, o pedido é atualizado instantaneamente no banco de dados, recalculando o valor total e atualizando a visualização na cozinha.');
  currentY += 3;

  // --- SEÇÃO 4: NOTIFICAÇÕES ---
  printSectionHeader('4', 'Sistema de Notificações Inteligentes & Lembretes');
  printBullet('Notificações 3x ao Dia para Congelados', 'Para pedidos que possuem produtos congelados, o sistema dispara lembretes automáticos em horários estratégicos (ex: 09h, 14h e 18h) reforçando o prazo de 48h e a possibilidade de antecipação.');
  printBullet('Logomarca Oficial e Sem Cortes', 'Todas as notificações exibem o ícone oficial DONAMARA e corpo de texto diagramado sem cortes em navegadores Chrome e Windows.');
  printBullet('Aviso Sonoro no Balcão', 'O painel administrativo emite alerta sonoro instantâneo quando qualquer novo pedido entra no sistema.');
  currentY += 3;

  // --- SEÇÃO 5: MODO TOTEM ---
  printSectionHeader('5', 'Modo Totem / Autoatendimento Presencial (/totem)');
  printParagraph('O modo Totem foi construído para terminais verticais ou tablets instalados na loja:');
  printBullet('Escala Ampliada de Tipografia', 'Fontes e botões 30% maiores para garantir leitura clara a distância e facilidade de toque.');
  printBullet('Trava Administrativa de Categorias', 'O lojista define no Admin exatamente quais categorias aparecem no Totem, protegendo contra redefinições acidentais.');
  printBullet('Auto-Reset por Inatividade', 'O carrinho zera e a tela reinicia automaticamente se o terminal ficar ocioso por determinado tempo.');
  currentY += 3;

  // --- SEÇÃO 6: SMART TV ---
  printSectionHeader('6', 'Painel Smart TV & Chamada de Senhas (/tv)');
  printBullet('Chamada Audiovisual', 'Ao clicar em "Chamar TV" no Admin, o número do pedido surge em destaque com toque de campainha na televisão da loja.');
  printBullet('Mídia Dinâmica', 'Carrossel automático com fotos de salgados, letreiro com avisos e exibição de pedidos aguardando retirada.');
  currentY += 3;

  // --- SEÇÃO 7: PAINEL ADMIN & KDS ---
  printSectionHeader('7', 'Painel Administrativo, KDS e Operação (/admin)');
  printBullet('Fila KDS em Tempo Real', 'Controle da esteira de pedidos: Pendente -> Preparando -> Pronto p/ Retirada -> Finalizado.');
  printBullet('Impressão Térmica Direta', 'Emissão de comandas de produção e recibos de balcão formatados para bobinas de 80mm e 58mm.');
  printBullet('Gestão do Catálogo', 'Cadastro de produtos, categorias, sabores e controle de adicionais exclusivos para lanches na chapa.');
  printBullet('Integração BlueFocus ERP', 'Sincronização com o sistema ERP da loja, com suporte a reversão segura de atualizações.');
  currentY += 3;

  // --- SEÇÃO 8: BACKUPS ---
  printSectionHeader('8', 'Sistema de Backups e Restauração Instantânea');
  printBullet('Backups Horários Automáticos', 'Snapshots do banco gravados a cada hora no disco do servidor com restauração de 1 clique pelo Admin.');
  printBullet('Exportação e Importação JSON', 'Geração de arquivo completo para backup no computador do proprietário.');
  printBullet('Rollback de Versão no Railway', 'Histórico completo de versões publicado em produção, permitindo reverter código em segundos.');
  currentY += 3;

  // --- SEÇÃO 9: GUIA PASSO A PASSO ---
  printSectionHeader('9', 'Roteiro Operacional do Dia a Dia');
  printParagraph('Passo a passo simplificado para a equipe da loja:');
  printBullet('1. Abertura do Dia', 'Acesse o Admin (/admin), verifique se o aviso sonoro está "ON" e abra a Smart TV (/tv) na televisão do salão.');
  printBullet('2. Chegada de Pedidos', 'O alarme sonoro toca no caixa. Imprima a comanda térmica e altere o status para "Preparando".');
  printBullet('3. Conclusão da Produção', 'Mude o status para "Pronto p/ Retirada" e clique em "Chamar TV" para alertar o cliente.');
  printBullet('4. Entrega ao Cliente', 'Entregue os salgados e marque o pedido como "Finalizado".');

  // --- RODAPÉ COM NÚMERO DE PÁGINAS ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`DONAMARA - REVENDA • Documentação Oficial do Sistema • Página ${i} de ${totalPages}`, margin, pageHeight - 6);
  }

  return doc;
}
