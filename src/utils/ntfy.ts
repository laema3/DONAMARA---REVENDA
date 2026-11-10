/**
 * Utility to send push notifications via NTFY (https://ntfy.sh)
 * Utiliza o backend Express (/api/ntfy/send) com JSON payload em UTF-8
 * para suportar emojis, acentos e máxima confiabilidade sem bloqueios.
 */

export interface NtfyOptions {
  topic?: string;
  title?: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5; // 1=min, 3=default, 4=high, 5=urgent/max
  tags?: string[];
  clickUrl?: string;
  enabled?: boolean;
}

export const sendNtfyNotification = async (options: NtfyOptions): Promise<boolean> => {
  if (options.enabled === false) {
    console.log('[NTFY] Notificações desativadas, ignorando envio.');
    return false;
  }
  const rawTopic = options.topic?.trim() || 'donamara_pedidos';
  // Sanitizar tópico para evitar espaços ou caracteres inválidos na URL
  const topic = rawTopic.replace(/[^a-zA-Z0-9_-]/g, '') || 'donamara_pedidos';
  
  if (!options.message) return false;

  const payload: Record<string, any> = {
    topic,
    title: options.title || undefined,
    message: options.message,
    priority: options.priority || 4,
    tags: options.tags || undefined,
    clickUrl: options.clickUrl || undefined
  };

  // 1. Tentar primeiro via Proxy do Backend Express (mais seguro e sem bloqueios)
  try {
    const backendRes = await fetch('/api/ntfy/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.success) {
        return true;
      }
    }
  } catch (backendErr) {
    console.warn('[NTFY] Backend proxy falhou, tentando envio direto via JSON...', backendErr);
  }

  // 2. Fallback direto para https://ntfy.sh via POST com JSON body
  try {
    const directPayload: Record<string, any> = {
      topic,
      message: options.message,
      priority: options.priority || 4
    };
    if (options.title) directPayload.title = options.title;
    if (options.tags && options.tags.length > 0) directPayload.tags = options.tags;
    if (options.clickUrl) directPayload.click = options.clickUrl;

    const response = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(directPayload)
    });

    return response.ok;
  } catch (error) {
    console.warn('[NTFY] Falha no fallback direto:', error);
    return false;
  }
};
