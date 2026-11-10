// Mapeamento de abreviações comuns de produtos de padaria, mercearia e restaurante
const ABBREVIATION_MAP: Record<string, string> = {
  // Conectores e preposições
  'c/': 'com',
  'c': 'com',
  's/': 'sem',
  's': 'sem',
  'p/': 'para',
  'p': 'para',
  'q/': 'que',

  // Unidades e medidas
  'cx': 'Caixa',
  'cx.': 'Caixa',
  'pct': 'Pacote',
  'pct.': 'Pacote',
  'pcte': 'Pacote',
  'pte': 'Pacote',
  'un': 'Unidade',
  'und': 'Unidade',
  'und.': 'Unidade',
  'unid': 'Unidade',
  'unid.': 'Unidade',
  'kg': 'Kg',
  'kg.': 'Kg',
  'kilo': 'Kg',
  'gr': 'g',
  'gr.': 'g',
  'g.': 'g',
  'lt': 'Lata',
  'lt.': 'Lata',
  'lta': 'Lata',
  'garf': 'Garrafa',
  'garf.': 'Garrafa',
  'garraf': 'Garrafa',
  'pet': 'PET',
  'ml': 'ml',
  'ml.': 'ml',

  // Categorias de alimentos e ingredientes
  'bisc': 'Biscoito',
  'bisc.': 'Biscoito',
  'biscoit': 'Biscoito',
  'pres': 'Presunto',
  'pres.': 'Presunto',
  'presunt': 'Presunto',
  'qjo': 'Queijo',
  'qjo.': 'Queijo',
  'queij': 'Queijo',
  'queij.': 'Queijo',
  'qjo/pres': 'Queijo e Presunto',
  'choco': 'Chocolate',
  'choc': 'Chocolate',
  'choc.': 'Chocolate',
  'frang': 'Frango',
  'frang.': 'Frango',
  'refrig': 'Refrigerante',
  'refrig.': 'Refrigerante',
  'refri': 'Refrigerante',
  'integ': 'Integral',
  'integ.': 'Integral',
  'integr': 'Integral',
  'trad': 'Tradicional',
  'trad.': 'Tradicional',
  'tradic': 'Tradicional',
  'esp': 'Especial',
  'esp.': 'Especial',
  'espec': 'Especial',
  'extr': 'Extra',
  'extr.': 'Extra',
  'cond': 'Condensado',
  'cond.': 'Condensado',
  'mist': 'Misto',
  'mist.': 'Misto',
  'emp': 'Empada',
  'emp.': 'Empada',
  'empad': 'Empada',
  'doc': 'Doce',
  'doc.': 'Doce',
  'doces': 'Doces',
  'salg': 'Salgado',
  'salg.': 'Salgados',
  'mam': 'Mamão',
  'mam.': 'Mamão',
  'leit': 'Leite',
  'leit.': 'Leite',
  'goiab': 'Goiabada',
  'goiab.': 'Goiabada',
  'samp': 'Sampa',
  'samp.': 'Sampa',
  'rech': 'Recheado',
  'rech.': 'Recheado',
  'rechead': 'Recheado',
  'calab': 'Calabresa',
  'calab.': 'Calabresa',
  'calabr': 'Calabresa',
  'fat': 'Fatiado',
  'fat.': 'Fatiado',
  'fatia': 'Fatiado',
  'fatiad': 'Fatiado',
  'moid': 'Moído',
  'moid.': 'Moído',
  'moido': 'Moído',
  'pass': 'Passas',
  'pass.': 'Passas',
  'baun': 'Baunilha',
  'baun.': 'Baunilha',
  'baunilh': 'Baunilha',
  'morang': 'Morango',
  'morang.': 'Morango',
  'cenour': 'Cenoura',
  'cenour.': 'Cenoura',
  'açuc': 'Açúcar',
  'acuc': 'Açúcar',
  'canel': 'Canela',
  'canel.': 'Canela',
  'manteig': 'Manteiga',
  'mant': 'Manteiga',
  'suc': 'Suco',
  'suc.': 'Suco',
  'guar': 'Guaraná',
  'guar.': 'Guaraná',
  'guaran': 'Guaraná',
  'sab': 'Sabor',
  'sab.': 'Sabor',
  'sort': 'Sortido',
  'sort.': 'Sortido',
  'artes': 'Artesanal',
  'artes.': 'Artesanal',
  'nat': 'Natural',
  'nat.': 'Natural',
  'natur': 'Natural',
  'crem': 'Creme',
  'crem.': 'Creme',
  'pao': 'Pão',
  'torr': 'Torrada',
  'torr.': 'Torrada',
  'hamb': 'Hambúrguer',
  'hamb.': 'Hambúrguer',
  'cost': 'Costela',
  'cost.': 'Costela',
  'bol': 'Bolo',
  'bol.': 'Bolo',
  'tort': 'Torta',
  'tort.': 'Torta',
  'pizz': 'Pizza',
  'pizz.': 'Pizza',
  'min': 'Mini',
  'min.': 'Mini',
  'grd': 'Grande',
  'grd.': 'Grande',
  'med': 'Médio',
  'med.': 'Médio',
  'peq': 'Pequeno',
  'peq.': 'Pequeno',
  'soluv': 'Solúvel',
  'soluv.': 'Solúvel',
  'coca-cola': 'Coca-Cola',
  'coca': 'Coca-Cola',
  'polv': 'Polvilho',
  'polv.': 'Polvilho',
  'croiss': 'Croissant',
  'croiss.': 'Croissant',
  'requeij': 'Requeijão',
  'req': 'Requeijão',
  'req.': 'Requeijão'
};

/**
 * Expande abreviações comuns no texto mantendo maiúsculas e minúsculas elegantes.
 */
export function expandAbbreviations(text?: string | null): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Separa o texto em palavras preservando espaços
  const words = trimmed.split(/(\s+)/);

  const expandedWords = words.map(word => {
    if (!word || /^\s+$/.test(word)) return word;

    const lower = word.toLowerCase().trim();
    
    // Verifica se há correspondência exata no dicionário
    if (ABBREVIATION_MAP[lower]) {
      return ABBREVIATION_MAP[lower];
    }

    // Tratamento especial para abreviações com pontuação ou barra (ex: "c/queijo" ou "p/1kg")
    if (lower.startsWith('c/') && lower.length > 2) {
      const rest = lower.slice(2);
      const expandedRest = ABBREVIATION_MAP[rest] || rest;
      return `com ${expandedRest}`;
    }
    if (lower.startsWith('s/') && lower.length > 2) {
      const rest = lower.slice(2);
      const expandedRest = ABBREVIATION_MAP[rest] || rest;
      return `sem ${expandedRest}`;
    }
    if (lower.startsWith('p/') && lower.length > 2) {
      const rest = lower.slice(2);
      const expandedRest = ABBREVIATION_MAP[rest] || rest;
      return `para ${expandedRest}`;
    }

    return word;
  });

  return expandedWords.join('');
}

/**
 * Formata um texto expandindo abreviações e deixando a primeira letra maiúscula
 */
export function formatProductTitle(text?: string | null): string {
  if (!text) return '';
  const expanded = expandAbbreviations(text);
  if (!expanded) return '';

  // Palavras que devem ficar em minúsculo quando no meio do texto
  const lowercaseWords = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'para', 'e', 'em', 'a', 'o', 'por']);

  const words = expanded.split(/\s+/);
  const formatted = words.map((word, index) => {
    if (!word) return '';

    // Se for número + unidade (ex: 500g, 1kg, 2l, 350ml) mantém o formato padrão
    if (/^\d+(g|kg|ml|l|un|cx|pct)$/i.test(word)) {
      return word.toLowerCase();
    }

    const lower = word.toLowerCase();
    if (index > 0 && lowercaseWords.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return formatted.join(' ');
}
