import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, RefreshCw, CheckCircle2, Phone, Calendar, User, BellRing } from 'lucide-react';
import { formatDateBR, formatAllDatesBR } from '../lib/utils';

export const SmsRemindersTab: React.FC = () => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('(34) 99999-9999');
  const [testName, setTestName] = useState('Cliente Exemplo');
  const [testOrderId, setTestOrderId] = useState('0001');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    webhookTested?: boolean;
    webhookResponseStatus?: number | null;
    webhookResponseBody?: string;
    webhookError?: string | null;
  } | null>(null);

  const [isTriggeringNow, setIsTriggeringNow] = useState(false);
  const [time1, setTime1] = useState('09:00');
  const [time2, setTime2] = useState('12:00');
  const [time3, setTime3] = useState('15:00');
  const [advanceMinutes, setAdvanceMinutes] = useState(90);
  const [isSavingTimes, setIsSavingTimes] = useState(false);
  const [timesSaveResult, setTimesSaveResult] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookSaveResult, setWebhookSaveResult] = useState<string | null>(null);

  const fetchStoreSettings = async () => {
    try {
      const res = await fetch('/api/db/store-info');
      if (res.ok) {
        const info = await res.json();
        if (info.smsReminderTime1) setTime1(info.smsReminderTime1);
        if (info.smsReminderTime2) setTime2(info.smsReminderTime2);
        if (info.smsReminderTime3) setTime3(info.smsReminderTime3);
        if (info.schedulePrepTimeFrozenMinutes) setAdvanceMinutes(Number(info.schedulePrepTimeFrozenMinutes) || 90);
        if (info.autoSmsWebhookUrl) setWebhookUrl(info.autoSmsWebhookUrl);
        if (info.autoSmsApiKey) setApiKey(info.autoSmsApiKey);
      }
    } catch {}
  };

  const handleTriggerNow = async () => {
    if (isTriggeringNow) return;
    setIsTriggeringNow(true);
    try {
      const res = await fetch('/api/db/sms-reminders/trigger-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      if (res.ok) {
        await fetchReminders();
        alert('Lembretes SMS e avisos de congelados disparados e verificados com sucesso!');
      } else {
        alert('Erro ao disparar lembretes SMS.');
      }
    } catch (err) {
      console.error('Erro ao acionar lembretes SMS:', err);
      alert('Erro de conexão.');
    } finally {
      setIsTriggeringNow(false);
    }
  };

  const handleSaveTimes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTimes(true);
    setTimesSaveResult(null);
    try {
      const res = await fetch('/api/db/store-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smsReminderTime1: time1,
          smsReminderTime2: time2,
          smsReminderTime3: time3,
          schedulePrepTimeFrozenMinutes: Number(advanceMinutes) || 90
        })
      });
      if (res.ok) {
        setTimesSaveResult('Horários e tempo de antecedência salvos com sucesso!');
        setTimeout(() => setTimesSaveResult(null), 3000);
      } else {
        setTimesSaveResult('Erro ao salvar horários.');
      }
    } catch (err) {
      setTimesSaveResult('Erro de conexão ao salvar.');
    } finally {
      setIsSavingTimes(false);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWebhook(true);
    setWebhookSaveResult(null);
    try {
      const res = await fetch('/api/db/store-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSmsWebhookUrl: webhookUrl.trim(),
          autoSmsApiKey: apiKey.trim()
        })
      });
      if (res.ok) {
        setWebhookSaveResult('Webhook de automação salvo com sucesso!');
        setTimeout(() => setWebhookSaveResult(null), 3000);
      } else {
        setWebhookSaveResult('Erro ao salvar webhook.');
      }
    } catch (err) {
      setWebhookSaveResult('Erro de conexão ao salvar.');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const fetchReminders = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/db/sms-reminders?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setReminders(Array.isArray(data) ? data : []);
      } else {
        setLoadError('Erro ao carregar histórico de lembretes.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar histórico de SMS:', err);
      setLoadError(err?.message || 'Erro de conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
    fetchStoreSettings();
    const interval = setInterval(fetchReminders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingTest) return;
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/db/sms-reminders/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone.trim(),
          name: testName.trim(),
          orderId: testOrderId.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Mensagem de teste gerada e disparada com sucesso!',
          webhookTested: data.webhookTested,
          webhookResponseStatus: data.webhookResponseStatus,
          webhookResponseBody: data.webhookResponseBody,
          webhookError: data.webhookError
        });
        await fetchReminders();
      } else {
        setTestResult({
          success: false,
          message: 'Erro ao disparar teste de SMS.'
        });
      }
    } catch (err: any) {
      console.error('Erro ao testar SMS:', err);
      setTestResult({
        success: false,
        message: 'Erro de conexão ao enviar SMS: ' + (err?.message || '')
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-orange-600" />
            Automação de Lembretes SMS (3x ao Dia)
          </h2>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
            O sistema dispara automaticamente lembretes 3 vezes ao dia (Manhã ~09h, Almoço ~12h, Tarde ~15h) para pedidos agendados e também para <strong>pedidos de salgados congelados</strong> (notificando durante o período de até 48 horas a partir do envio, avisando que pode ficar pronto antes e que os atendentes entrarão em contato).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTriggerNow}
            disabled={isTriggeringNow}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-600/30"
          >
            <Send className={`w-4 h-4 ${isTriggeringNow ? 'animate-spin' : ''}`} />
            <span>{isTriggeringNow ? 'Disparando...' : 'Disparar Lembretes SMS Agora 🚀'}</span>
          </button>
          <button
            type="button"
            onClick={fetchReminders}
            disabled={isLoading}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer w-fit"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Histórico</span>
          </button>
        </div>
      </div>

      {/* Banner de Automação via NTFY (Sem Depender de Funcionário) */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl font-black text-lg shrink-0 shadow-sm">
            🔔
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-stone-900 text-sm">
                Alerta Push Automático no NTFY (Ativo no Celular da Loja)
              </h3>
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                100% Automático
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
              O servidor dispara alertas automáticos no seu NTFY nos 3 horários do dia e <strong>ao faltar 90 minutos para a entrega</strong>. O celular toca sozinho com som de alarme e o resumo do pedido, sem depender de memória de funcionário!
            </p>
          </div>
        </div>
        <a
          href="https://ntfy.sh/donamara_pedidos"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-stone-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <span>📱 Abrir Canal NTFY</span>
        </a>
      </div>

      {/* Caixa de Teste de Envio & Diagnóstico de Webhook */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-2xl border border-orange-200 shadow-xs">
        <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Send className="w-4 h-4 text-orange-600" />
          Disparar Teste Manual de SMS &amp; Diagnóstico Webhook
        </h3>
        <p className="text-xs text-stone-600 mb-3">
          Ao enviar um teste abaixo, o sistema executa um POST HTTP real para o seu Webhook configurado e exibe o código de status retornado pelo servidor para ajudar a identificar por que a mensagem pode não estar chegando.
        </p>
        <form onSubmit={handleSendTestSms} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Nome do Cliente</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              required
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-800"
              placeholder="Ex: Maria Silva"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Telefone / WhatsApp</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              required
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-800 font-mono"
              placeholder="(34) 99999-9999"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Nº do Pedido</label>
            <input
              type="text"
              value={testOrderId}
              onChange={(e) => setTestOrderId(e.target.value)}
              required
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-800 font-mono"
              placeholder="0001"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSendingTest}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTest ? 'Enviando...' : 'Testar Envio & Webhook 🔍'}</span>
            </button>
          </div>
        </form>
        {testResult && (
          <div className={`mt-3 p-3.5 rounded-xl text-xs space-y-2 border ${
            testResult.success 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult.message}</span>
            </div>
            {testResult.webhookTested && (
              <div className="pt-2 border-t border-emerald-200/60 font-mono text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700">Status HTTP do Webhook:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    testResult.webhookResponseStatus && testResult.webhookResponseStatus >= 200 && testResult.webhookResponseStatus < 300
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-amber-200 text-amber-900'
                  }`}>
                    {testResult.webhookResponseStatus ? `HTTP ${testResult.webhookResponseStatus}` : 'Sem resposta (Timeout ou Erro de DNS)'}
                  </span>
                </div>
                {testResult.webhookError && (
                  <p className="text-red-700 font-bold">Erro de Conexão Webhook: {testResult.webhookError}</p>
                )}
                {testResult.webhookResponseBody && (
                  <div>
                    <span className="text-stone-500 block mb-0.5 font-bold">Resposta do Gateway / Servidor:</span>
                    <pre className="p-2 bg-white rounded border border-stone-200 text-[10px] overflow-x-auto max-h-24">
                      {testResult.webhookResponseBody}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {!testResult.webhookTested && (
              <p className="text-[11px] text-stone-600 italic">
                💡 Dica: Nenhum Webhook URL foi configurado abaixo. O lembrete foi gerado no painel, mas para envio automático externo configure a URL do seu gateway abaixo.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Configuração dos Horários de Disparo e Antecedência */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <span>⏰</span> Configurar Horários dos Lembretes e Alerta de Preparo
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Defina os horários em que o sistema deve disparar os lembretes (via Webhook/SMS, NTFY e a janela fixa no celular do cliente), além da antecedência de preparo.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            ● 100% Personalizável
          </span>
        </div>

        <form onSubmit={handleSaveTimes} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">1º Horário (Manhã)</label>
            <input
              type="time"
              value={time1}
              onChange={(e) => setTime1(e.target.value)}
              required
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">2º Horário (Almoço)</label>
            <input
              type="time"
              value={time2}
              onChange={(e) => setTime2(e.target.value)}
              required
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">3º Horário (Tarde)</label>
            <input
              type="time"
              value={time3}
              onChange={(e) => setTime3(e.target.value)}
              required
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              Antecedência p/ Alerta & Impressão
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                max="300"
                step="5"
                value={advanceMinutes}
                onChange={(e) => setAdvanceMinutes(Number(e.target.value) || 90)}
                required
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-800 pr-12"
              />
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-stone-400">min</span>
            </div>
          </div>

          <div className="sm:col-span-4 bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
            💡 <strong>Como funciona na nova versão:</strong> Nos 3 horários acima (ex: {time1}, {time2} e {time3}) e quando faltar {advanceMinutes} minutos para a entrega/retirada, o sistema dispara automaticamente o aviso. A mensagem salta diretamente na tela do smartphone do cliente e <strong>permanece aberta e travada até ele tocar no botão para fechar</strong>, garantindo que ele não perca a informação!
          </div>

          <div className="sm:col-span-4 flex items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={isSavingTimes}
              className="py-2.5 px-6 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              {isSavingTimes ? 'Salvando...' : 'Salvar Horários e Antecedência 💾'}
            </button>
            {timesSaveResult && (
              <span className="text-xs font-bold text-emerald-600 animate-in fade-in">{timesSaveResult}</span>
            )}
          </div>
        </form>
      </div>

      {/* Instruções Detalhadas em Português para Configuração */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
          <span>📖</span> Instruções Passo a Passo para Envio Automático (SMS e WhatsApp)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-700 leading-relaxed">
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-2">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-black text-[11px]">1</span>
              Como Funciona o Envio Automático (Webhook / Gateway)
            </h4>
            <p>
              O sistema não cobra taxa por mensagem porque permite conectar <strong>qualquer gateway ou provedor que você já utilize</strong> (exemplo: Evolution API, Z-API, Twilio, SMS Dev, Make ou Zapier).
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600 text-[11px]">
              <li>Nos horários configurados (ex: 09h, 12h e 15h), o sistema busca pedidos agendados.</li>
              <li>Ele envia uma chamada <strong>POST</strong> para a URL do Webhook com os dados do cliente, telefone e mensagem formatada.</li>
              <li>A API externa que você contratou realiza a entrega no celular do cliente.</li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-2">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[11px]">2</span>
              Por que a mensagem pode não ter chegado?
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-stone-600 text-[11px]">
              <li>
                <strong>Nenhum Webhook preenchido:</strong> Sem uma URL de API contratada preenchida no campo abaixo, o sistema apenas registra a mensagem no painel (não há como disparar para a rede celular sem uma operadora).
              </li>
              <li>
                <strong>URL ou Token incorreto:</strong> Se a URL do gateway exigir autenticação por token ou chave de API e ela não for informada, o provedor rejeitará o envio.
              </li>
              <li>
                <strong>Alternativa 100% Gratuita e Imediata:</strong> Você pode usar o botão verde <strong>"💬 WhatsApp"</strong> ao lado de cada lembrete na tabela abaixo. Ele abre a conversa no WhatsApp diretamente com o cliente e a mensagem pronta para enviar com 1 toque!
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <span className="text-base shrink-0">💡</span>
          <div>
            <strong>Dica de Teste:</strong> Utilize o botão <strong>"Testar Envio &amp; Webhook"</strong> acima com o seu próprio número de celular. A caixa de diagnóstico exibirá exatamente a resposta do seu servidor para saber se ele aceitou ou rejeitou a conexão.
          </div>
        </div>
      </div>

      {/* Configuração de Webhook para Automação Real 100% */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
          <span>⚡</span> Webhook / API de Envio Automático (WhatsApp / SMS Gateway)
        </h3>
        <p className="text-xs text-stone-500">
          Para que o envio seja <strong>100% automatizado</strong> sem intervenção sua, cole abaixo a URL do seu Webhook (ex: Evolution API, Z-API, Twilio, Make, Zapier). O sistema enviará um POST HTTP automático com o telefone e a mensagem assim que a janela de horário for atingida.
        </p>
        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-stone-700 mb-1">URL do Webhook / Endpoint API</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.sualoja.com/send-whatsapp"
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Chave API / Token de Acesso (Opcional)</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Token de Acesso"
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-800"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              disabled={isSavingWebhook}
              className="py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all"
            >
              {isSavingWebhook ? 'Salvando...' : 'Salvar Webhook Automático 🔗'}
            </button>
            {webhookSaveResult && (
              <span className="text-xs font-bold text-emerald-600 animate-in fade-in">{webhookSaveResult}</span>
            )}
          </div>
        </form>
      </div>

      {/* Histórico de Lembretes Disparados */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-orange-600" />
            Log de Lembretes SMS Enviados ({reminders.length})
          </h3>
          <span className="text-xs text-stone-500 font-medium">
            Atualização automática a cada 15s
          </span>
        </div>

        {reminders.length === 0 ? (
          <div className="p-12 text-center text-stone-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum SMS disparado ainda.</p>
            <p className="text-xs text-stone-400 mt-1">
              Os lembretes automáticos aparecerão aqui conforme os pedidos agendados entrarem nas janelas horárias.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/70 text-stone-500 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Data / Hora Envio</th>
                  <th className="p-3">Cliente / Telefone</th>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Agendamento</th>
                  <th className="p-3">Janela / Slot</th>
                  <th className="p-3">Mensagem SMS Disparada</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {reminders.map((r: any) => (
                  <tr key={r.id} className="hover:bg-stone-50/80">
                    <td className="p-3 font-mono text-stone-600 whitespace-nowrap">
                      {new Date(r.sentAt || Date.now()).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 font-medium text-stone-900">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-stone-400" /> {r.customerName}</span>
                        <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3 text-stone-400" /> {r.customerPhone}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-orange-600 whitespace-nowrap">
                      #{String(r.orderId).slice(-4)}
                    </td>
                    <td className="p-3 text-stone-700 whitespace-nowrap">
                      {r.type === 'frozen_48h' || String(r.message || '').toLowerCase().includes('congelad') ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-bold text-[11px]">
                          <span>❄️</span>
                          <span>Congelados (Prazo 48h)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDateBR(r.scheduledDate)} às {r.scheduledTime}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        r.type === 'frozen_48h' 
                          ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {r.slot === 'slot_1_09h' ? 'Manhã (09h)' : r.slot === 'slot_2_12h' ? 'Almoço (12h)' : 'Tarde (15h)'}
                      </span>
                    </td>
                    <td className="p-3 text-stone-700 min-w-[280px] max-w-md whitespace-normal break-words leading-relaxed">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 text-stone-800 text-xs font-medium">
                        {formatAllDatesBR(r.message)}
                      </div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Gerado</span>
                        </span>
                        {r.customerPhone && (
                          <a
                            href={`https://wa.me/55${r.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(formatAllDatesBR(r.message))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase shadow-sm transition-all cursor-pointer"
                            title="Enviar esta mensagem diretamente para o WhatsApp do cliente"
                          >
                            <span>💬 WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
