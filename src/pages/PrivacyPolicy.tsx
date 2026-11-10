import { ArrowLeft, Shield, Lock, Eye, Cookie, FileText, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function PrivacyPolicy() {
  const { storeInfo } = useStore();

  const storeName = storeInfo.name || 'DONAMARA - REVENDA';
  const storeAddress = storeInfo.address || 'Consulte nosso endereço no cardápio';
  const storePhone = storeInfo.whatsapp || 'Consulte nosso WhatsApp no cardápio';

  return (
    <div className="min-h-screen bg-[#f8f7f5] text-stone-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-stone-700 hover:text-stone-950 font-bold text-sm transition-colors py-1 px-2 rounded-lg hover:bg-stone-100"
          >
            <ArrowLeft className="w-4 h-4 text-orange-600" />
            <span>Voltar ao Cardápio</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>LGPD Compliant</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-stone-200">
          
          {/* Header Section */}
          <div className="border-b border-stone-200 pb-6 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-black uppercase tracking-wider mb-3">
              <Lock className="w-3.5 h-3.5" />
              Segurança & Transparência
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Política de Privacidade e Uso de Cookies
            </h1>
            <p className="text-stone-500 text-sm mt-2">
              Última atualização: {new Date().toLocaleDateString('pt-BR')} • Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
            </p>
          </div>

          <div className="space-y-8 text-stone-700 text-sm sm:text-base leading-relaxed">
            
            {/* 1. Introdução */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">1</span>
                Introdução
              </h2>
              <p>
                A <strong>{storeName}</strong>{storeInfo.address ? `, com sede em ${storeInfo.address},` : ''} valoriza a segurança, o sigilo e a privacidade de todos os seus clientes e usuários.
              </p>
              <p className="mt-2">
                Esta Política explica de forma clara como tratamos, coletamos e protegemos seus dados pessoais ao navegar em nosso Cardápio Digital, realizar pedidos no balcão, no autoatendimento (totem) ou pelo serviço de Delivery e Retirada.
              </p>
            </section>

            {/* 2. Dados Coletados */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">2</span>
                Quais Dados Coletamos e Por Quê
              </h2>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <h3 className="font-bold text-stone-900 mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    Identificação do Pedido (Nome e Telefone/WhatsApp)
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    <strong>Finalidade:</strong> Identificar quem fez o pedido, emitir a comanda de preparo na cozinha/balcão e enviar avisos de status ou comprovante pelo WhatsApp.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <h3 className="font-bold text-stone-900 mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    Endereço de Entrega (Para modalidade Delivery)
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    <strong>Finalidade:</strong> Permitir o cálculo da taxa de entrega e a realização correta do trajeto pelo entregador parceiro até sua residência ou empresa.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <h3 className="font-bold text-stone-900 mb-1 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-orange-600" />
                    Itens do Carrinho e Preferências
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    <strong>Finalidade:</strong> Manter seus itens selecionados salvos mesmo se você fechar e reabrir o aplicativo no mesmo aparelho.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. Política de Cookies */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">3</span>
                Uso de Cookies e Armazenamento Local (LocalStorage)
              </h2>
              <p>
                Nosso cardápio utiliza <strong>Cookies Essenciais</strong> e armazenamento seguro no navegador para:
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2 pl-2 text-stone-600">
                <li>Manter seu carrinho de compras ativo durante a navegação;</li>
                <li>Lembrar seu nome e telefone para você não precisar digitar tudo de novo a cada pedido;</li>
                <li>Permitir o funcionamento offline e instalação do Aplicativo Web (PWA);</li>
                <li>Garantir a segurança contra fraudes e requisições repetidas.</li>
              </ul>
              <p className="mt-2 text-xs text-stone-500 italic">
                * Não vendemos, não alugamos e não compartilhamos seus dados de navegação com redes terceiras de anúncios ou rastreadores externos.
              </p>
            </section>

            {/* 4. Compartilhamento de Dados */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">4</span>
                Compartilhamento com Terceiros
              </h2>
              <p>
                Os seus dados são acessados estritamente pela equipe da <strong>{storeName}</strong> para a execução do atendimento. Eles só podem ser compartilhados com:
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2 pl-2 text-stone-600">
                <li><strong>Entregadores e operadores logísticos:</strong> Apenas os dados estritamente necessários para a rota de entrega (nome, endereço e telefone para contato caso haja dificuldade no portão);</li>
                <li><strong>Provedores de infraestrutura de banco de dados e nuvem:</strong> Para armazenamento seguro sob criptografia;</li>
                <li><strong>Autoridades judiciais ou fiscais:</strong> Quando legalmente exigido por lei ou fiscalização tributária.</li>
              </ul>
            </section>

            {/* 5. Segurança dos Dados */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">5</span>
                Segurança e Retenção das Informações
              </h2>
              <p>
                Adotamos medidas técnicas e organizacionais de segurança, incluindo conexões criptografadas (HTTPS/SSL), regras de segurança de banco de dados e controle de acesso restrito a funcionários autorizados.
              </p>
            </section>

            {/* 6. Seus Direitos (LGPD) */}
            <section>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black">6</span>
                Seus Direitos como Titular dos Dados
              </h2>
              <p>
                Conforme o Artigo 18 da LGPD, você tem o direito de:
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2 pl-2 text-stone-600">
                <li>Confirmar a existência de tratamento dos seus dados;</li>
                <li>Acessar ou corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>Solicitar a exclusão definitiva de seus dados do nosso cadastro de clientes;</li>
                <li>Limpar a qualquer momento os dados salvos em seu navegador nas configurações do seu celular ou clicando em "Limpar Dados Salvos" no rodapé do nosso aplicativo.</li>
              </ul>
            </section>

            {/* 7. Contato e Encarregado */}
            <section className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mt-6">
              <h2 className="text-base sm:text-lg font-black text-stone-900 mb-2">
                Fale com Nosso Canal de Atendimento / Privacidade
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mb-4">
                Se tiver qualquer dúvida sobre o uso de seus dados ou desejar solicitar a exclusão do seu número de telefone e histórico, entre em contato direto conosco:
              </p>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-stone-800">
                  <Phone className="w-4 h-4 text-orange-600 shrink-0" />
                  <span><strong>WhatsApp / Telefone:</strong> {storePhone}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-800">
                  <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                  <span><strong>Endereço:</strong> {storeAddress}</span>
                </div>
              </div>
            </section>

          </div>

          {/* Action Back Button */}
          <div className="mt-10 pt-6 border-t border-stone-200 flex justify-center">
            <Link
              to="/"
              className="py-3 px-8 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-bold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Cardápio e Fazer Pedido</span>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
