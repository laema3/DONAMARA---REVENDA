import React, { useState } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  Clock, 
  ShoppingBag, 
  Layers, 
  ShieldCheck, 
  Bell, 
  Tv, 
  HardDrive, 
  Sparkles,
  FileText,
  AlertTriangle,
  Flame,
  Snowflake,
  PlusCircle,
  HelpCircle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildDocumentationPdf } from '../utils/generateDocumentationPdf';

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState<string>('intro');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      // Geração local via jsPDF para download imediato sem depender de requisições de rede
      const doc = buildDocumentationPdf();
      doc.save('Manual_Sistema_DONAMARA.pdf');
    } catch (err) {
      console.warn('Erro na geração client-side de PDF, acionando download pelo servidor:', err);
      // Fallback via endpoint do servidor
      window.location.href = '/api/documentation/pdf';
    } finally {
      setTimeout(() => setIsGeneratingPdf(false), 1200);
    }
  };

  const handlePrint = () => {
    try {
      // Se estiver em iframe ou com popups bloqueados, window.print pode falhar
      window.print();
    } catch (err) {
      console.warn('window.print() bloqueado pelo navegador/iframe. Baixando PDF diretamente...', err);
      handleDownloadPdf();
    }
  };

  const handleCopyText = () => {
    const textContent = `
SISTEMA DONAMARA - REVENDA
DOCUMENTAÇÃO OFICIAL & MANUAL OPERACIONAL
Versão: 2.8.0 Production | Data: Novembro/2026

1. VISÃO GERAL DA PLATAFORMA
Plataforma completa de revenda e consumo de salgados especiais, contendo:
- Cardápio Digital PWA (/ e /cardapio)
- Totem de Autoatendimento Presencial (/totem)
- Painel Smart TV com Chamada Audiovisual de Senhas (/tv)
- Painel Administrativo e KDS de Produção (/admin)

2. REGRAS DE MODALIDADE (CONGELADOS VS. PRONTOS)
- Salgados Prontos: Preparo rápido para consumo imediato. Opções Frito/Assado e Cru/Pré-Assado. Não podem ser misturados com congelados no mesmo pedido.
- Salgados Congelados: Prazo de entrega de até 48 horas a partir do envio. Opções Congelado Cru e Congelado Frito (+R$ 0,30/un taxa de congelamento).
Aviso Oficial: "Obs: Pedidos congelados com entrega em até 48 horas podem ser antecipados e você será avisado pelo aplicativo."
- Bloqueio Inteligente: Caso tente misturar modalidades, o sistema bloqueia e orienta o cliente a finalizar o pedido atual ou limpar o carrinho para começar novo pedido.

3. FUNCIONALIDADE DE ACRÉSCIMO EM PEDIDOS EXISTENTES
Permite adicionar itens extras a um pedido já enviado caso tenha esquecido algum item:
- Status do Pedido: Deve estar exclusivamente em "Pendente".
- Condição de Pagamento: Disponível para Pagamento na Retirada.
- Mesma Modalidade: Pedido congelado só aceita congelados; pedido pronto só aceita prontos.

4. NOTIFICAÇÕES INTELIGENTES & LEMBRETES PERIÓDICOS
- Disparo automático de lembretes 3x ao dia para clientes com pedidos congelados em andamento (avisando do prazo de 48h e antecipação).
- Logomarca oficial DONAMARA em todas as notificações sem corte de caracteres.
- Alarme sonoro em tempo real no painel admin para alertar o balcão.

5. MODO TOTEM (/totem)
- Interface de autoatendimento touch-screen com tipografia e botões 30% maiores.
- Trava de categorias aprovadas para exibição no totem.
- Auto-reset por inatividade.

6. PAINEL SMART TV (/tv)
- Chamada de senhas com campainha sonora ao clicar em "Chamar TV" no Admin.
- Carrossel de fotos e letreiro de novidades da loja.

7. GESTÃO KDS E COZINHA (/admin)
- Esteira de produção: Pendente -> Preparando -> Pronto p/ Retirada -> Finalizado.
- Impressão térmica de comandas de cozinha (80mm e 58mm).
- Gestão de catálogo, sabores e adicionais (restritos a lanches na chapa).
- Sincronização com o ERP BlueFocus.

8. SISTEMA DE BACKUPS
- Backups automáticos de hora em hora salvos no disco com restauração de 1 clique.
- Exportação e importação de arquivo JSON completo.
- Rollback de versões de código no Railway.
    `.trim();

    navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 print:bg-white print:text-black font-sans selection:bg-orange-200">
      {/* Barra de Ações Superior (Oculta na Impressão/PDF) */}
      <header className="sticky top-0 z-50 bg-stone-900 text-white border-b border-stone-800 shadow-lg print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link 
              to="/admin" 
              className="p-2 hover:bg-stone-800 rounded-xl text-stone-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Voltar ao Painel Administrativo"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Painel Admin</span>
            </Link>
            <span className="text-stone-700">|</span>
            <Link 
              to="/" 
              className="text-xs font-bold text-stone-300 hover:text-white transition-colors"
            >
              Ver Cardápio
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Principal: Download Direto do Arquivo PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              title="Baixa o documento oficial formatado em arquivo PDF (.pdf) para o seu computador ou celular"
            >
              <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
              <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar Arquivo PDF (.pdf)'}</span>
            </button>

            {/* Botão Secundário: Imprimir / Janela Nativa */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 rounded-xl text-xs font-bold border border-stone-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Abre a caixa de diálogo de impressão do navegador"
            >
              <Printer className="w-4 h-4 text-stone-300" />
              <span>Imprimir</span>
            </button>

            {/* Botão de Copiar Texto Completo */}
            <button
              type="button"
              onClick={handleCopyText}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                copied 
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50' 
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
              }`}
              title="Copia todo o texto da documentação para colar no Word, WhatsApp ou e-mail"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal do Documento */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 print:p-0 print:max-w-none">
        
        {/* Capa / Cabeçalho Oficial do Documento */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-stone-200">
            <div className="flex items-center gap-4">
              <img 
                src="/logo.png" 
                alt="Logo DONAMARA" 
                className="w-20 h-20 object-contain rounded-2xl bg-white p-1 border border-stone-200 shadow-xs print:w-16 print:h-16"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-md border border-orange-200 inline-block mb-1">
                  Documentação Oficial &amp; Manual do Usuário
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                  Sistema DONAMARA - REVENDA
                </h1>
                <p className="text-xs sm:text-sm text-stone-600 font-medium">
                  Roteiro Completo de Funcionalidades, Regras de Negócio e Operação da Plataforma
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right shrink-0 text-xs text-stone-500 space-y-1 bg-stone-50 p-3 rounded-2xl border border-stone-200 print:bg-transparent print:p-0 print:border-none">
              <div><strong>Versão:</strong> 2.8.0 Production</div>
              <div><strong>Emissão:</strong> Novembro / 2026</div>
              <div><strong>Ambiente:</strong> Web / Mobile / Totem / KDS</div>
              <div><strong>Status:</strong> Homologado &amp; Ativo</div>
            </div>
          </div>

          {/* Card de Download Rápido do Arquivo */}
          <div className="mt-6 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-black uppercase text-orange-950 flex items-center justify-center sm:justify-start gap-1.5">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>Arquivo Pronto para Download Direto (PDF &amp; HTML)</span>
              </span>
              <p className="text-xs text-orange-900/80 max-w-lg">
                Se a janela de impressão não abrir no seu navegador, clique no botão para salvar o arquivo PDF formatado direto na sua pasta de Downloads.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
                <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF (.pdf)'}</span>
              </button>
              <a
                href="/documentacao_sistema_donamara.html"
                download="Manual_Sistema_DONAMARA.html"
                className="px-3.5 py-2.5 bg-white hover:bg-stone-100 text-stone-800 border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-stone-600" />
                <span>Baixar HTML</span>
              </a>
            </div>
          </div>

          {/* Sumário Rápido */}
          <div className="mt-6 pt-2 print:hidden">
            <h2 className="text-xs font-black uppercase tracking-wider text-stone-400 mb-3">
              Índice de Navegação Rápida
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'visao-geral', label: '1. Visão Geral' },
                { id: 'modalidades', label: '2. Congelados vs. Prontos' },
                { id: 'acrescimo', label: '3. Acréscimo em Pedidos' },
                { id: 'notificacoes', label: '4. Notificações & Lembretes' },
                { id: 'totem', label: '5. Modo Totem (Autoatendimento)' },
                { id: 'tv', label: '6. Painel Smart TV' },
                { id: 'admin', label: '7. Gestão & KDS Admin' },
                { id: 'backups', label: '8. Backups & Restauração' },
                { id: 'passo-a-passo', label: '9. Guia Operacional' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className="text-left px-3 py-2 bg-stone-50 hover:bg-orange-50 hover:text-orange-700 rounded-xl font-bold text-stone-700 transition-colors border border-stone-200 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 1. VISÃO GERAL */}
        <section id="visao-geral" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Visão Geral da Plataforma DONAMARA
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Arquitetura central, canais de atendimento e objetivos
              </p>
            </div>
          </div>

          <div className="prose prose-stone max-w-none text-sm text-stone-700 leading-relaxed space-y-3">
            <p>
              O <strong>Sistema DONAMARA - REVENDA</strong> é uma solução completa desenvolvida para automatizar, controlar e simplificar toda a cadeia de pedidos, produção e entrega de salgados especiais e tradicionais.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2 font-black text-stone-900 text-sm mb-1">
                  <ShoppingBag className="w-4 h-4 text-orange-600" />
                  <span>Cardápio Digital PWA</span>
                </div>
                <p className="text-xs text-stone-600">
                  Acessível pelo navegador em smartphones ou computadores, permitindo pedidos com agilidade sem exigir instalação pesada nas lojas de aplicativos.
                </p>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2 font-black text-stone-900 text-sm mb-1">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Totem Autoatendimento</span>
                </div>
                <p className="text-xs text-stone-600">
                  Modo de tela cheia com interface de alta acessibilidade para totens verticais ou tablets no balcão da loja, sem filas.
                </p>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2 font-black text-stone-900 text-sm mb-1">
                  <Tv className="w-4 h-4 text-purple-600" />
                  <span>Painel TV &amp; KDS</span>
                </div>
                <p className="text-xs text-stone-600">
                  Exibição em tempo real de senhas e pedidos prontos na Smart TV da loja, sincronizado ao painel de cozinha (KDS).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. REGRAS DE MODALIDADE: CONGELADOS VS. PRONTOS */}
        <section id="modalidades" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Regras de Modalidade: Congelados vs. Salgados Prontos
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Diferenciação operacional, prazos e proteção contra misturas
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
            <p>
              Para assegurar a pontualidade operacional e evitar gargalos no balcão, o sistema possui <strong>bloqueio estrito de modalidades</strong> no mesmo pedido.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-amber-300 bg-amber-50/50 p-4 rounded-2xl">
                <div className="flex items-center gap-2 font-black text-amber-950 text-base mb-1">
                  <Flame className="w-5 h-5 text-amber-600" />
                  <span>Salgados Prontos (Normais)</span>
                </div>
                <ul className="text-xs text-amber-900 space-y-1.5 list-disc list-inside mt-2">
                  <li>Preparo imediato para consumo na hora ou retirada rápida.</li>
                  <li>Disponíveis nas versões <strong>Frito/Assado</strong> e <strong>Cru/Pré-Assado</strong>.</li>
                  <li>Podem ser combinados com lanches, bebidas e acompanhamentos.</li>
                  <li><strong>Não podem ser misturados com itens congelados no mesmo pedido.</strong></li>
                </ul>
              </div>

              <div className="border-2 border-blue-300 bg-blue-50/50 p-4 rounded-2xl">
                <div className="flex items-center gap-2 font-black text-blue-950 text-base mb-1">
                  <Snowflake className="w-5 h-5 text-blue-600" />
                  <span>Salgados Congelados</span>
                </div>
                <ul className="text-xs text-blue-900 space-y-1.5 list-disc list-inside mt-2">
                  <li>Destinados a estoque residencial, festas ou revenda.</li>
                  <li><strong>Prazo de entrega/retirada de até 48 horas</strong> a partir do envio.</li>
                  <li>Disponíveis em <strong>Congelado Cru</strong> e <strong>Congelado Frito/Assado</strong>.</li>
                  <li>Acréscimo automático do valor de congelamento (+R$ 0,30 por unidade).</li>
                  <li>Alerta explícito: <em>"Pedidos congelados com entrega em até 48 horas podem ser antecipados e você será avisado pelo aplicativo."</em></li>
                </ul>
              </div>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Como o Sistema Reage em Caso de Conflito de Modalidade
              </h4>
              <p className="text-xs text-stone-600">
                Se o cliente já adicionou itens congelados ao carrinho e tenta escolher um salgado pronto (ou vice-versa), o bloco correspondente é travado com aviso explicativo e o cliente tem duas escolhas simples:
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                <span className="bg-white px-3 py-1 rounded-lg border border-stone-300 text-stone-800">
                  1. Finalizar o pedido atual da modalidade escolhida
                </span>
                <span className="bg-white px-3 py-1 rounded-lg border border-stone-300 text-stone-800">
                  2. Limpar o carrinho com 1 clique para iniciar um novo pedido na outra modalidade
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. ACRÉSCIMO EM PEDIDOS EXISTENTES */}
        <section id="acrescimo" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Funcionalidade de Acréscimo em Pedidos Existentes
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Flexibilidade controlada para o cliente adicionar itens após enviar o pedido
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-stone-700 leading-relaxed">
            <p>
              O cliente pode adicionar itens extras a um pedido já enviado sem precisar criar um novo frete ou cobrança separada, desde que cumpra rigorosamente os seguintes critérios de segurança:
            </p>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
              <h4 className="font-black text-stone-900 text-xs uppercase tracking-wider mb-2">
                Critérios Obrigatórios para Habilitação do Botão de Acréscimo:
              </h4>
              <ol className="text-xs space-y-2 list-decimal list-inside text-stone-700 font-medium">
                <li>
                  <strong>Status do Pedido:</strong> Deve estar exclusivamente em <strong>"Pendente"</strong>. Se a cozinha já alterou para <em>"Preparando"</em>, <em>"Pronto"</em> ou <em>"Finalizado"</em>, a opção é bloqueada automaticamente para não desorganizar a linha de produção.
                </li>
                <li>
                  <strong>Condição de Pagamento:</strong> Disponível para a modalidade de <strong>Pagamento na Retirada</strong> (Balcão).
                </li>
                <li>
                  <strong>Mesma Modalidade Obrigatória:</strong> Se o pedido original for de <strong>Congelados</strong>, o cliente só pode acrescentar congelados. Se o pedido for de <strong>Prontos</strong>, só itens prontos são permitidos.
                </li>
              </ol>
            </div>

            <p className="text-xs text-stone-600">
              Ao concluir o acréscimo, o sistema recalcula o valor total do pedido, atualiza a quantidade de itens e dispara a nova comanda consolidada para o painel de atendimento e impressoras térmicas da loja.
            </p>
          </div>
        </section>

        {/* 4. NOTIFICAÇÕES & LEMBRETES */}
        <section id="notificacoes" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Sistema de Notificações Inteligentes &amp; Lembretes
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Comunicação com o cliente via Web Push, avisos in-app e sons de cozinha
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-stone-200 p-4 rounded-2xl bg-stone-50">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm mb-1">
                  <Bell className="w-4 h-4 text-orange-600" />
                  <span>Notificações 3x ao Dia para Congelados</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Para clientes com pedidos pendentes de produtos congelados, o sistema dispara lembretes periódicos nos horários configurados (ex: 09:00, 14:00 e 18:00), reforçando o prazo de até 48 horas e informando que eles serão comunicados caso o pedido fique pronto antes.
                </p>
              </div>

              <div className="border border-stone-200 p-4 rounded-2xl bg-stone-50">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Logomarca Oficial &amp; Mensagens Claras</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Todas as notificações do Chrome/Windows e do aplicativo exibem a <strong>logomarca oficial DONAMARA</strong> e textos otimizados para evitar qualquer corte de caracteres em telas pequenas ou na central de notificações.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
              <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Alarme Sonoro no Balcão de Pedidos
              </div>
              <p className="text-xs text-emerald-900">
                O painel administrativo possui alarme sonoro em tempo real. Sempre que um cliente finaliza um pedido, a equipe do balcão ouve o toque de aviso sonoro instantaneamente, agilizando a preparação.
              </p>
            </div>
          </div>
        </section>

        {/* 5. MODO TOTEM */}
        <section id="totem" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
              5
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Modo Totem / Autoatendimento Presencial (/totem)
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Interface kiosk para terminais touch-screen na loja física
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-stone-700 leading-relaxed">
            <p>
              O endereço <code>/totem</code> inicializa a plataforma em <strong>Modo Kiosk</strong>:
            </p>
            <ul className="text-xs space-y-2 list-disc list-inside text-stone-700">
              <li><strong>Tipografia e Botões Ampliados:</strong> Escala de fonte +30% para leitura fácil a distância e toques sem erro.</li>
              <li><strong>Trava de Categorias:</strong> O lojista pode selecionar no Admin quais categorias exatas devem aparecer no Totem e travar essa seleção contra alterações acidentais.</li>
              <li><strong>Auto-Reset por Inatividade:</strong> Após período sem uso, o totem zera o carrinho automaticamente e volta à tela inicial.</li>
              <li><strong>Teclado Virtual Integrado:</strong> Campo de identificação e número de WhatsApp com teclado adaptado a toque.</li>
            </ul>
          </div>
        </section>

        {/* 6. PAINEL SMART TV */}
        <section id="tv" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">
              6
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Painel Smart TV &amp; Chamada de Senhas (/tv)
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Exibição de mídia e senhas em televisores no salão
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-stone-700 leading-relaxed">
            <p>
              Acesso direto pelo navegador de qualquer Smart TV ou Android TV no endereço <code>/tv</code>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <strong>Chamada Audiovisual:</strong> Quando o atendente clica em <em>"Chamar TV"</em> no Admin, o número do pedido pisca na tela com sinal sonoro de campainha.
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <strong>Carrossel de Produtos &amp; Letreiro:</strong> Espaço dinâmico para fotos de salgados, preços promocionais e letreiro de novidades da DONAMARA.
              </div>
            </div>
          </div>
        </section>

        {/* 7. PAINEL ADMINISTRATIVO & KDS */}
        <section id="admin" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-stone-800 text-white flex items-center justify-center font-bold text-lg">
              7
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Painel Administrativo, KDS e Operação (/admin)
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Gestão centralizada de pedidos, cardápio e controle financeiro
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
            <p>
              O painel administrativo reúne todas as ferramentas necessárias para os operadores e gerentes da loja:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">KDS / Gestão de Pedidos</strong>
                Visualização em tempo real de pedidos em produção, tempo decorrido, itens detalhados e status rápido (Pendente → Preparando → Pronto → Finalizado).
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">Impressão Térmica</strong>
                Impressão direta de comprovantes e comandas de cozinha formatadas para bobinas de 80mm ou 58mm.
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">Cardápio &amp; Adicionais</strong>
                Cadastro de produtos, preços, categorias, sabores e controle de adicionais exclusivos para lanches na chapa.
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">Clientes &amp; CRM</strong>
                Lista completa de clientes com histórico de compras, ticket médio, telefones e endereços.
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">Integração BlueFocus ERP</strong>
                Sincronização de produtos, estoque e códigos cadastrados no ERP externo com suporte a reversão segura.
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <strong className="block text-stone-900 text-sm mb-1">Controle de Perfis</strong>
                Níveis de acesso diferenciados para Gerente Master, Administrador e Operador de Caixa.
              </div>
            </div>
          </div>
        </section>

        {/* 8. BACKUPS & RESTAURAÇÃO */}
        <section id="backups" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-lg">
              8
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Segurança, Backups e Restauração Instantânea
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Proteção contínua contra perdas de dados e falhas operacionais
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-stone-700 leading-relaxed">
            <p>
              O sistema possui camadas redundantes de segurança para garantir integridade contínua:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="font-bold text-stone-900 text-sm mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  <span>Backups Horários Automáticos</span>
                </div>
                Salvos automaticamente a cada hora no disco do servidor com carimbo de data/hora, prontos para restauração em 1 clique.
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="font-bold text-stone-900 text-sm mb-1 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Exportação Manual em JSON</span>
                </div>
                O lojista pode baixar o arquivo completo do banco de dados para o próprio computador a qualquer instante.
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="font-bold text-stone-900 text-sm mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Rollback no Servidor Railway</span>
                </div>
                O histórico de deploys permite reverter a versão do código instantaneamente para qualquer dia anterior caso necessário.
              </div>
            </div>
          </div>
        </section>

        {/* 9. GUIA OPERACIONAL PASSO A PASSO */}
        <section id="passo-a-passo" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-stone-200 mb-8 print:shadow-none print:border-none print:p-0 print:mb-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
              9
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Guia Rápido de Operação no Dia a Dia
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Passo a passo prático para clientes e operadores
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50">
              <h3 className="font-black text-stone-900 text-sm mb-2 text-orange-600 uppercase tracking-wide">
                Fluxo do Cliente (Pelo Celular ou Totem):
              </h3>
              <ol className="text-xs space-y-1.5 list-decimal list-inside text-stone-700">
                <li>Acessa o cardápio e seleciona os produtos desejados.</li>
                <li>Ao escolher salgados, define o tipo de preparo (Pronto ou Congelado).</li>
                <li>Se for Congelado, visualiza o aviso do prazo de 48 horas e possibilidade de antecipação.</li>
                <li>Informa seu nome e WhatsApp para identificação e acompanhamento.</li>
                <li>Finaliza selecionando a forma de pagamento (Retirada no Balcão).</li>
                <li>Acompanha na tela o status do pedido e recebe as notificações de preparo.</li>
              </ol>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50">
              <h3 className="font-black text-stone-900 text-sm mb-2 text-stone-900 uppercase tracking-wide">
                Fluxo da Equipe da Loja (Balcão &amp; Cozinha):
              </h3>
              <ol className="text-xs space-y-1.5 list-decimal list-inside text-stone-700">
                <li>Ouve o aviso sonoro e visualiza o novo pedido em destaque vermelho/amarelo no Admin.</li>
                <li>Imprime a comanda de cozinha térmica com 1 clique (ou envia para a fila de produção).</li>
                <li>Altera o status para <strong>"Preparando"</strong> quando a cozinha inicia a montagem/fritura.</li>
                <li>Quando estiver pronto, muda o status para <strong>"Pronto p/ Retirada"</strong> e clica em <strong>"Chamar TV"</strong> para emitir o som e exibir a senha no salão.</li>
                <li>Entrega ao cliente no balcão e marca como <strong>"Finalizado"</strong>.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Rodapé do Relatório */}
        <footer className="text-center py-6 border-t border-stone-200 text-xs text-stone-500 space-y-2 print:border-stone-300">
          <p className="font-bold text-stone-700">
            DONAMARA - REVENDA • Salgados Especiais e Tradicionais
          </p>
          <p>
            Documentação gerada para apresentação e homologação junto ao cliente final.
          </p>
          <div className="print:hidden pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-600/30 inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            >
              <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
              <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar Arquivo PDF (.pdf)'}</span>
            </button>

            <a
              href="/documentacao_sistema_donamara.html"
              download="manual_sistema_donamara.html"
              className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
              title="Baixar versão HTML para abrir sem internet em qualquer navegador"
            >
              <FileText className="w-4 h-4 text-stone-600" />
              <span>Baixar Versão HTML</span>
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
}
