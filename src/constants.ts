export const EXCLUDED_CATEGORIES = [
  'SERVICOS',
  'SERVIÇOS',
  'SERVICO',
  'SERVIÇO',
  'PRESTACAO DE SERVICO',
  'PRESTAÇÃO DE SERVIÇO',
  'MATERIA PRIMA',
  'MATÉRIA PRIMA',
  'MATERIAS PRIMAS',
  'MATÉRIAS PRIMAS',
  'MATERIA-PRIMA',
  'MATÉRIA-PRIMA',
  'MATERIAS-PRIMAS',
  'MATÉRIAS-PRIMAS',
  'UNIFORMES',
  'UNIFORME',
  'VALILHAME',
  'VALILHAMES',
  'VASILHAME',
  'VASILHAMES',
  'MANUTENCAO',
  'MANUTENÇÃO',
  'MANUTENCOES',
  'MANUTENÇÕES',
  'MANUTENCAO PREDIAL',
  'MANUTENÇÃO PREDIAL',
  'MANUTENCAO GERAL',
  'MANUTENÇÃO GERAL',
  'ITEM DE MANUTENCAO',
  'ITEM DE MANUTENÇÃO',
  'ITENS DE MANUTENCAO',
  'ITENS DE MANUTENÇÃO',
  'EQUIPAMENTO',
  'EQUIPAMENTOS',
  'DESPESA',
  'DESPESAS',
  'INSUMO',
  'INSUMOS',
  'USO E CONSUMO',
  'USO INTERNO',
  'MATERIAL DE LIMPEZA',
  'PRODUTO DE LIMPEZA',
  'PRODUTOS DE LIMPEZA',
  'LIMPEZA',
  'PATRIMONIO',
  'PATRIMÔNIO',
  'IMOBILIZADO',
  'DESCARTAVEIS',
  'DESCARTÁVEIS',
  'EMBALAGEM INTERNA',
  'EMBALAGENS INTERNAS',
  'TAXA',
  'TAXAS',
  'TESTE',
  'TESTES'
];

export const normalizeText = (str: string) => 
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Pre-computed normalized sets for ultra-fast O(1) lookups without repeating normalization
const NORMALIZED_EXCLUDED_SET = new Set(EXCLUDED_CATEGORIES.map(normalizeText));
const NORMALIZED_EXCLUDED_ARRAY = Array.from(NORMALIZED_EXCLUDED_SET);

export const shouldExcludeProduct = (product: any, categories: any[]) => {
  if (!product) return true;
  const normalizedName = normalizeText(product.name || "");
  if (!normalizedName) return true;

  // 1. Direct or substring keyword match
  if (NORMALIZED_EXCLUDED_SET.has(normalizedName)) return true;
  for (let i = 0; i < NORMALIZED_EXCLUDED_ARRAY.length; i++) {
    if (normalizedName.includes(NORMALIZED_EXCLUDED_ARRAY[i])) return true;
  }

  // 2. Category exclusion check
  if (categories && product.categoryId) {
    const category = categories.find(c => c && c.id === product.categoryId);
    if (category) {
      const normalizedCat = normalizeText(category.name || "");
      if (NORMALIZED_EXCLUDED_SET.has(normalizedCat)) return true;
      for (let i = 0; i < NORMALIZED_EXCLUDED_ARRAY.length; i++) {
        if (normalizedCat.includes(NORMALIZED_EXCLUDED_ARRAY[i])) return true;
      }
    }
  }

  return false;
};

export const isExcludedCategory = (name: string) => {
  if (!name) return false;
  const normalizedName = normalizeText(name);
  if (NORMALIZED_EXCLUDED_SET.has(normalizedName)) return true;
  for (let i = 0; i < NORMALIZED_EXCLUDED_ARRAY.length; i++) {
    if (normalizedName.includes(NORMALIZED_EXCLUDED_ARRAY[i])) return true;
  }
  return false;
};

export const isAddonCategory = (name: string) => {
  const norm = normalizeText(name || "");
  return (
    norm === 'adicionais' ||
    norm === 'adicional' ||
    norm === 'opcionais' ||
    norm === 'opcional' ||
    norm === 'complementos' ||
    norm === 'complemento' ||
    norm.includes('adicionais') ||
    norm.includes('adicional') ||
    norm.includes('opcionais') ||
    norm.includes('opcional')
  );
};

export const isAddonItem = (product: any, categories?: any[]) => {
  if (!product) return false;
  if (product.isAddon === true) return true;
  if (product.categoryId === 'fly938s') return true;

  const normName = normalizeText(product.name || "");
  if (
    normName.startsWith('adicional ') ||
    normName.startsWith('adicionais ') ||
    normName.startsWith('adc ') ||
    normName.startsWith('adic ') ||
    normName.startsWith('opcional ') ||
    normName.startsWith('opcionais ') ||
    normName === 'adicional' ||
    normName === 'adicionais' ||
    normName === 'opcional' ||
    normName === 'opcionais'
  ) {
    return true;
  }

  if (categories && Array.isArray(categories)) {
    const category = categories.find(c => c && c.id === product.categoryId);
    if (category && isAddonCategory(category.name)) {
      return true;
    }
  }

  return false;
};

export const isStoreOnlyCategory = (_name: string) => {
  return false;
};

export const MASTER_ADMIN_EMAILS = [
  'camillasites@gmail.com'
];

export const isAuthorizedAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.includes(cleanEmail)) {
    return true;
  }
  return false;
};

export const cleanProductDescription = (desc?: string | null, removeChannels: boolean = true): string => {
  if (!desc || typeof desc !== 'string') return '';
  let result = desc;
  
  if (removeChannels) {
    result = result.replace(/\[channels:.*?\]/gi, '');
  }

  // Preserve codes and standardize [EAN: 123] or (Barcode: 123) into readable Cód: 123
  return result
    .replace(/\[\s*(?:EAN|EAN-?13|BARCODE|C[ÓO]D\.?\s*(?:DE\s*)?BARRAS?|C[ÓO]DIGO\s+(?:DE\s+)?BARRAS?)\s*:?\s*([^\]]+)\]/gi, 'Cód: $1')
    .replace(/\(\s*(?:EAN|EAN-?13|BARCODE|C[ÓO]D\.?\s*(?:DE\s*)?BARRAS?|C[ÓO]DIGO\s+(?:DE\s+)?BARRAS?)\s*:?\s*([^)]+)\)/gi, 'Cód: $1')
    .replace(/(?:EAN|EAN-?13|BARCODE|C[ÓO]D\.?\s*(?:DE\s*)?BARRAS?|C[ÓO]DIGO\s+(?:DE\s+)?BARRAS?)\s*:?\s*(\d+)/gi, 'Cód: $1')
    // Clean up double spaces and dangling separators
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-–—|:,;]\s*/, '')
    .replace(/\s*[-–—|:,;]\s*$/, '')
    .trim();
};

/**
 * Retorna a descrição do produto garantindo a presença do código do produto.
 * Se o produto tiver código (externalId/code) e ele ainda não constar na descrição,
 * ele é incluído de forma limpa e destacada.
 */
export const formatProductDescriptionWithCode = (desc?: string | null, code?: string | null): string => {
  const cleanDesc = cleanProductDescription(desc, true);
  const cleanCode = (code || '').toString().trim();
  if (!cleanCode) return cleanDesc;

  // Se a descrição já contém o código (ex: "Cód: 1001" ou "1001"), retorna a descrição limpa
  if (cleanDesc.toLowerCase().includes(cleanCode.toLowerCase())) {
    return cleanDesc;
  }

  if (!cleanDesc) {
    return `Cód: ${cleanCode}`;
  }

  return `Cód: ${cleanCode} • ${cleanDesc}`;
};

export const getEnrichedProductDescription = (name: string, externalId?: string, currentDesc?: string): string => {
  const normName = (name || '').toLowerCase();
  const extId = (externalId || '').toString().trim();

  const cleanCurrent = cleanProductDescription(currentDesc, true);

  // Se for caldo, sopa, bebida, café ou doce, NUNCA aplica descrição de lanche de chapa!
  if (
    normName.includes('caldo') || 
    normName.includes('sopa') || 
    normName.includes('suco') || 
    normName.includes('cafe') || 
    normName.includes('refrigerante') || 
    normName.includes('cerveja') || 
    normName.includes('agua') || 
    normName.includes('bolo') || 
    normName.includes('pudim') || 
    normName.includes('sorvete') || 
    normName.includes('vitamina') ||
    normName.includes('salgado') ||
    normName.includes('coxinha') ||
    normName.includes('pao de queijo')
  ) {
    return cleanCurrent;
  }

  const isGeneric = !cleanCurrent || cleanCurrent.length < 25 || cleanCurrent.toLowerCase() === normName;
  if (!isGeneric && cleanCurrent) {
    return cleanCurrent;
  }

  if (extId === '1645' || normName.includes('xtudo') || normName.includes('x-tudo')) {
    return 'Hambúrguer artesanal suculento, queijo prato derretido, presunto, ovo frito, bacon crocante, alface americana fresca, tomate em rodelas, batata palha e maionese especial da casa.';
  }
  if (extId === '1649' || extId === '6574' || normName.includes('ligth') || normName.includes('fit')) {
    return 'Pão integral fatiado macio, peito de frango desfiado temperado, queijo minas frescal light, alface fresca e tomate rodelas.';
  }
  if (extId === '5284' || normName.includes('caipira')) {
    return 'Pão francês crocante, frango desfiado cremoso com requeijão catupiry original, milho verde selecionado e batata palha.';
  }
  if (extId === '5549' || (normName.includes('file de frango') || (normName.includes('frango') && normName.includes('lanche')))) {
    return 'Pão francês ou hambúrguer, filé de frango grelhado na chapa, queijo prato derretido, alface americana e tomate fresco.';
  }
  if (extId === '5550' || normName.includes('churrasco') || normName.includes('gran churrasco')) {
    return 'Pão especial macio, tiras de carne bovina grelhadas na chapa com cebola caramelizada e queijo prato derretido.';
  }
  if (extId === '5553' || normName.includes('requeijao')) {
    return 'Pão francês fresquinho chapeado com generosa camada de requeijão cremoso derretido.';
  }
  if (extId === '5554' || normName.includes('matinal')) {
    return 'Pão francês quentinho na chapa com manteiga extra e fatia de queijo prato derretido.';
  }
  if (extId === '2427' || normName.includes('mortadela')) {
    return 'Pão francês crocante, finas fatias de mortadela defumada chapeada e queijo prato derretido.';
  }
  if (extId === '5551' || normName.includes('misto')) {
    return 'Pão francês ou de forma com presunto gordo fatiado e queijo prato derretido na chapa.';
  }
  if (extId === '2423' || normName.includes('hamburguer especial')) {
    return 'Pão de hambúrguer macio, carne artesanal grelhada na chapa, queijo derretido, alface americana e tomate.';
  }
  if (extId === '3137' || extId === '1262' || normName.includes('macarrao na chapa')) {
    return 'Macarrão espaguete chapeado com presunto, queijo, milho verde, ervilha e molho especial da casa.';
  }
  if (normName.includes('lanche') || normName.includes('chapa')) {
    return 'Pão quentinho na chapa com recheio caprichado, ingredientes selecionados e muito sabor.';
  }

  return cleanCurrent || '';
};

export const isSalgadoProduct = (product: any, categories: any[] = []) => {
  if (!product) return false;
  if (product.allowFrozen === false) return false;
  if (product.allowFrozen === true) return true;
  const category = categories.find(c => c && c.id === product.categoryId);
  const catName = normalizeText(category?.name || '');
  const prodName = normalizeText(product?.name || '');
  
  const isExcluded = 
    prodName.includes('bebida') || prodName.includes('suco') || prodName.includes('refrigerante') || 
    prodName.includes('cerveja') || prodName.includes('agua') || prodName.includes('cafe') || 
    prodName.includes('caldo') || prodName.includes('sopa') || prodName.includes('doce') || 
    prodName.includes('bolo') || prodName.includes('pudim') || prodName.includes('sorvete') ||
    prodName.includes('maionese') || prodName.includes('frete') ||
    catName.includes('bebida') || catName.includes('caldo') || catName.includes('sopa') || 
    catName.includes('doce') || catName.includes('confeitaria');
  
  if (isExcluded) return false;

  // Se a categoria for de salgados / revenda / festa / tipo 2, é salgado
  const isSalgadoCat = 
    catName.includes('salgado') || catName.includes('salgados') ||
    catName.includes('revenda') || catName.includes('festa') ||
    catName.includes('tipo') || catName.includes('rev');

  if (isSalgadoCat) return true;

  // Checagem de palavras-chave e abreviações no nome do produto
  const isSalgadoName = 
    prodName.includes('salgado') || prodName.includes('coxinha') || prodName.includes('cox') ||
    prodName.includes('esfirra') || prodName.includes('esfiha') || prodName.includes('esf') ||
    prodName.includes('pastel') || prodName.includes('kibe') || prodName.includes('quibe') ||
    prodName.includes('empada') || prodName.includes('emp') || prodName.includes('risole') ||
    prodName.includes('risolis') || prodName.includes('croquete') || prodName.includes('croq') ||
    prodName.includes('pao de queijo') || prodName.includes('bolinho') || prodName.includes('bol') ||
    prodName.includes('espetinho') || prodName.includes('enroladinho') || prodName.includes('quiche') ||
    prodName.includes('cachorro') || prodName.includes('mandioca') || prodName.includes('bacalhau') ||
    prodName.includes('pizza') || prodName.includes('kafta') || prodName.includes('hamburguer') ||
    prodName.includes('festa') || prodName.includes('revenda') || prodName.includes('tipo');
  
  return isSalgadoName;
};



