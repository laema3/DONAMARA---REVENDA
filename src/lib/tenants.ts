
export const getTenantId = () => {
  const hostname = window.location.hostname;
  console.log('[Tenant] Hostname atual:', hostname);

  // Se for o subdomínio específico
  if (hostname.includes('cardapio-digital')) {
    console.log('[Tenant] Identificado tenant: cardapio-digital');
    return 'cardapio-digital';
  }
  
  // URLs de desenvolvimento do AI Studio (permitir testar via query param)
  if (hostname.includes('ais-dev') || hostname.includes('ais-pre') || hostname.includes('localhost')) {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = urlParams.get('tenant');
    if (tenantParam) {
      console.log('[Tenant] Identificado tenant via param:', tenantParam);
      return tenantParam;
    }
  }

  // Padrão (Produção ou fallback)
  console.log('[Tenant] Identificado tenant padrão: main');
  return 'main';
};

/**
 * Retorna o caminho da coleção considerando o isolamento por loja.
 * Para a loja 'main', manteremos as coleções raiz para não perder os dados existentes.
 * Para outras lojas, usaremos o caminho tenants/{tenantId}/{collection}
 */
export const getCollectionPath = (basePath: string) => {
  const tenantId = getTenantId();
  if (tenantId === 'main') {
    return basePath;
  }
  return `tenants/${tenantId}/${basePath}`;
};

export const getDocPath = (basePath: string, docId: string) => {
  const tenantId = getTenantId();
  if (tenantId === 'main') {
    return `${basePath}/${docId}`;
  }
  return `tenants/${tenantId}/${basePath}/${docId}`;
};
