import React, { useState, useMemo, useEffect } from 'react';
import { useStore, Customer, Order } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { 
  Users, 
  Search, 
  Plus, 
  RefreshCw, 
  Download, 
  MessageCircle, 
  Phone, 
  Mail, 
  MapPin, 
  ShoppingBag, 
  DollarSign, 
  Tag, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Sparkles, 
  Send,
  X,
  UserCheck,
  Award,
  Clock,
  ArrowUpDown,
  TrendingUp,
  Flame,
  Gift,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info
} from 'lucide-react';

interface ProductConsumptionItem {
  productId: string;
  name: string;
  quantity: number;
  totalSpent: number;
  imageUrl?: string;
  categoryId?: string;
}

export interface CustomersTabProps {
  onSyncBlueFocusCustomers?: (overrideConfig?: any) => void;
  isSyncingERP?: boolean;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  onSyncBlueFocusCustomers,
  isSyncingERP = false
}) => {
  const { 
    customers, 
    orders,
    products,
    categories,
    saveCustomer, 
    updateCustomer, 
    deleteCustomer, 
    syncCustomersFromOrders, 
    fetchCustomers,
    storeInfo
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'spent' | 'orders' | 'name'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pending, approved, rejected customers counts
  const pendingCount = useMemo(() => customers.filter(c => c.status === 'pending').length, [customers]);
  const approvedCount = useMemo(() => customers.filter(c => c.status === 'approved' || !c.status).length, [customers]);
  const rejectedCount = useMemo(() => customers.filter(c => c.status === 'rejected').length, [customers]);

  const handleApproveCustomer = async (customer: Customer) => {
    try {
      await updateCustomer(customer.id, { status: 'approved' });
    } catch (err) {
      console.error('Erro ao aprovar cliente:', err);
    }
  };

  const handleRejectCustomer = async (customer: Customer) => {
    if (window.confirm(`Deseja realmente REPROVAR o cadastro do cliente "${customer.name}"?`)) {
      try {
        await updateCustomer(customer.id, { status: 'rejected' });
      } catch (err) {
        console.error('Erro ao reprovar cliente:', err);
      }
    }
  };

  // Reset to page 1 whenever filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag, selectedSource, statusFilter, sortBy]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedNumbers, setCopiedNumbers] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [promoMessageTemplate, setPromoMessageTemplate] = useState('ola_cliente');
  const [customPromoText, setCustomPromoText] = useState(
    `Olá {nome}! 🥟\nPassando para avisar que o cardápio da ${storeInfo.name || 'DONAMARA - REVENDA'} está cheio de delícias fresquinhas esperando por você hoje!\n\nConfira e faça seu pedido direto pelo link:\n${window.location.origin}`
  );

  // Consumption Profile State
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<Customer | null>(null);
  const [customOfferText, setCustomOfferText] = useState('');
  const [copiedOfferText, setCopiedOfferText] = useState(false);
  const [selectedOfferTemplate, setSelectedOfferTemplate] = useState<'favorito' | 'categoria' | 'saudades'>('favorito');

  // Form states
  const [formName, setFormName] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSource, setFormSource] = useState('manual');
  const [formStatus, setFormStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [formMonthlyGoal, setFormMonthlyGoal] = useState<string>('');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Helper to extract phone digits
  const cleanDigits = (phone?: string) => (phone || '').replace(/\D/g, '');

  // Calculate customer consumption profile
  const getCustomerConsumption = (customer: Customer) => {
    const cDigits = cleanDigits(customer.phone);
    const cCpfDigits = cleanDigits(customer.cpf);
    const cNameNorm = (customer.name || '').trim().toLowerCase();

    // Match orders (non-cancelled)
    const matchedOrders = orders.filter(o => {
      if (o.status === 'cancelled' || (o as any).status === 'canceled') return false;
      if (customer.id && o.customerId && String(customer.id) === String(o.customerId)) {
        return true;
      }
      const oCpfDigits = cleanDigits(o.customerCpf);
      if (cCpfDigits.length >= 11 && oCpfDigits.length >= 11 && cCpfDigits === oCpfDigits) {
        return true;
      }
      const oDigits = cleanDigits(o.customerPhone);
      if (cDigits && oDigits && (cDigits === oDigits || cDigits.endsWith(oDigits) || oDigits.endsWith(cDigits))) {
        return true;
      }
      if (cNameNorm && o.customerName && o.customerName.trim().toLowerCase() === cNameNorm) {
        return true;
      }
      return false;
    });

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const currentMonthSpent = matchedOrders.reduce((sum, o) => {
      const oDate = new Date(Number(o.createdAt) || 0);
      if (oDate.getMonth() === curMonth && oDate.getFullYear() === curYear) {
        return sum + (Number(o.total) || 0);
      }
      return sum;
    }, 0);

    // Aggregate products
    const productMap = new Map<string, ProductConsumptionItem>();
    let totalItemsOrdered = 0;

    matchedOrders.forEach(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((it: any) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const name = it.name || 'Produto';
        const pId = it.productId || it.id || name;
        totalItemsOrdered += qty;

        const existing = productMap.get(pId) || {
          productId: pId,
          name,
          quantity: 0,
          totalSpent: 0,
          imageUrl: it.imageUrl,
          categoryId: it.categoryId
        };

        existing.quantity += qty;
        existing.totalSpent += price * qty;
        if (it.imageUrl && !existing.imageUrl) existing.imageUrl = it.imageUrl;
        productMap.set(pId, existing);
      });
    });

    const topProducts = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
    const favoriteProduct = topProducts[0] || null;

    // Determine favorite category
    let favoriteCategoryName = '';
    if (favoriteProduct) {
      const matchedProduct = products.find(p => p.id === favoriteProduct.productId || p.name.toLowerCase() === favoriteProduct.name.toLowerCase());
      if (matchedProduct) {
        const cat = categories.find(c => c.id === matchedProduct.categoryId);
        if (cat) favoriteCategoryName = cat.name;
      }
    }

    // Recommended products (active products from same category or popular products not yet ordered)
    const orderedProductIds = new Set(topProducts.map(tp => tp.productId));
    const recommendedProducts = products
      .filter(p => p.isActive && !orderedProductIds.has(p.id))
      .slice(0, 3);

    return {
      matchedOrders,
      totalOrders: matchedOrders.length || customer.totalOrders || 0,
      totalSpent: matchedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || customer.totalSpent || 0,
      currentMonthSpent,
      totalItemsOrdered,
      topProducts,
      favoriteProduct,
      favoriteCategoryName,
      recommendedProducts,
      lastOrder: matchedOrders[0] || null
    };
  };

  // Open Consumption Profile Modal & build initial personalized message
  const handleOpenConsumptionProfile = (customer: Customer) => {
    setSelectedProfileCustomer(customer);
    const profile = getCustomerConsumption(customer);
    const firstName = (customer.name || 'Cliente').split(' ')[0];
    const topProd = profile.favoriteProduct?.name || 'nossas delícias';
    const storeTitle = storeInfo.name || 'DONAMARA - REVENDA';
    const siteUrl = window.location.origin;

    const initialText = `Olá ${firstName}! 🥟\nPassando para avisar que acabou de sair uma fornada fresquinha de *${topProd}* aqui na ${storeTitle}!\n\nQue tal garantir o seu hoje com a qualidade de sempre?\nPeça direto pelo link:\n${siteUrl}`;
    setCustomOfferText(initialText);
    setSelectedOfferTemplate('favorito');
  };

  const handleSelectOfferTemplate = (template: 'favorito' | 'categoria' | 'saudades') => {
    if (!selectedProfileCustomer) return;
    setSelectedOfferTemplate(template);
    const profile = getCustomerConsumption(selectedProfileCustomer);
    const firstName = (selectedProfileCustomer.name || 'Cliente').split(' ')[0];
    const topProd = profile.favoriteProduct?.name || 'nossas delícias';
    const catName = profile.favoriteCategoryName || 'Salgados & Lanches';
    const storeTitle = storeInfo.name || 'DONAMARA - REVENDA';
    const siteUrl = window.location.origin;

    let text = '';
    if (template === 'favorito') {
      text = `Olá ${firstName}! 🥖\nPassando para avisar que acabou de sair uma fornada quentinha de *${topProd}* aqui na ${storeTitle}!\n\nQue tal saborear hoje? Peça rápido pelo link:\n${siteUrl}`;
    } else if (template === 'categoria') {
      text = `Oi ${firstName}! 🥐\nComo você sempre aprecia nossas opções de *${catName}*, separamos delícias especiais fresquinhas esperando por você na ${storeTitle} hoje!\n\nConfira o cardápio e faça seu pedido:\n${siteUrl}`;
    } else if (template === 'saudades') {
      text = `Olá ${firstName}! ☕\nSentimos sua falta na ${storeTitle}!\nPreparamos tudo com muito carinho para o seu próximo pedido de *${topProd}*.\n\nAcesse nosso cardápio online e aproveite:\n${siteUrl}`;
    }
    setCustomOfferText(text);
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormName(customer.name || '');
      setFormCpf(customer.cpf || '');
      setFormPhone(customer.phone || '');
      setFormEmail(customer.email || '');
      setFormAddress(customer.address || '');
      setFormSource(customer.source || 'manual');
      setFormStatus((customer.status as any) || 'approved');
      setFormMonthlyGoal(customer.monthlyGoal && customer.monthlyGoal > 0 ? String(customer.monthlyGoal) : '');
      const tagsList = Array.isArray(customer.tags) 
        ? customer.tags.join(', ') 
        : typeof customer.tags === 'string' ? customer.tags : '';
      setFormTags(tagsList);
      setFormNotes(customer.notes || '');
    } else {
      setEditingCustomer(null);
      setFormName('');
      setFormCpf('');
      setFormPhone('');
      setFormEmail('');
      setFormAddress('');
      setFormSource('manual');
      setFormStatus('approved');
      setFormMonthlyGoal('');
      setFormTags('Cliente, Revenda');
      setFormNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Por favor, informe ao menos o Nome e o Telefone/WhatsApp.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedTags = formTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const parsedGoal = formMonthlyGoal.trim() !== '' ? (parseFloat(formMonthlyGoal.replace(',', '.')) || 0) : 0;
      const cleanDoc = formCpf.replace(/\D/g, '');
      const defaultPass = cleanDoc.length >= 5 ? cleanDoc.slice(0, 5) : undefined;

      const customerPayload: Partial<Customer> = {
        name: formName.trim(),
        cpf: formCpf.trim() || undefined,
        password: defaultPass,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        source: formSource,
        status: formStatus,
        monthlyGoal: parsedGoal,
        tags: parsedTags,
        notes: formNotes.trim() || undefined
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerPayload);
      } else {
        await saveCustomer(customerPayload);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      alert('Erro ao salvar cliente. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente/lead "${name}"?`)) {
      await deleteCustomer(id);
    }
  };

  const handleSyncFromOrders = async () => {
    setIsSyncing(true);
    try {
      await syncCustomersFromOrders();
      await fetchCustomers();
      setSyncSuccessMsg('Base de clientes sincronizada com sucesso dos pedidos!');
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      alert('Erro ao sincronizar pedidos.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach(t => t && set.add(t));
      }
    });
    return Array.from(set);
  }, [customers]);

  // Filter and Sort Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // REGRA: Pedidos do totem não viram leads no sistema
      if (c.source === 'pedido_totem' || c.source === 'totem' || c.source === 'kiosk') return false;
      if ((c.name || '').trim().toLowerCase() === 'cliente totem') return false;

      const query = searchTerm.toLowerCase().trim();
      const matchesSearch = !query || 
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        (c.externalId && String(c.externalId).toLowerCase().includes(query)) ||
        (c.cpf && String(c.cpf).toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query)) ||
        (c.notes && c.notes.toLowerCase().includes(query));

      const tagsList = Array.isArray(c.tags) ? c.tags : [];
      const matchesTag = selectedTag === 'all' || tagsList.includes(selectedTag);

      const matchesSource = selectedSource === 'all' || 
        (selectedSource === 'orders' && (c.source === 'order' || c.totalOrders > 0)) ||
        (selectedSource === 'leads' && (c.source !== 'order' && c.totalOrders === 0)) ||
        (selectedSource === 'delivery' && (c.source === 'delivery' || c.source === 'pedido_delivery')) ||
        (selectedSource === 'instore' && (c.source === 'instore' || c.source === 'pedido_loja' || c.source === 'dine_in')) ||
        (selectedSource === 'bluefocus_erp' && (c.source === 'bluefocus_erp' || Boolean(c.externalId))) ||
        c.source === selectedSource;

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pending' && c.status === 'pending') ||
        (statusFilter === 'approved' && (c.status === 'approved' || !c.status)) ||
        (statusFilter === 'rejected' && c.status === 'rejected');

      return matchesSearch && matchesTag && matchesSource && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = a.lastOrderAt || a.createdAt || 0;
        const timeB = b.lastOrderAt || b.createdAt || 0;
        return timeB - timeA;
      }
      if (sortBy === 'spent') {
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      }
      if (sortBy === 'orders') {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      return 0;
    });
  }, [customers, searchTerm, selectedTag, selectedSource, statusFilter, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, safeCurrentPage, itemsPerPage]);

  // Key Metrics
  const metrics = useMemo(() => {
    const totalCount = customers.length;
    const withOrders = customers.filter(c => c.totalOrders > 0);
    const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const avgSpent = withOrders.length > 0 ? totalSpent / withOrders.length : 0;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const newLeadsMonth = customers.filter(c => (c.createdAt || 0) >= thirtyDaysAgo).length;

    return {
      totalCount,
      buyersCount: withOrders.length,
      totalSpent,
      avgSpent,
      newLeadsMonth
    };
  }, [customers]);

  const cleanPhoneForWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return digits;
    }
    return digits;
  };

  const getWhatsAppLink = (phone: string, customerName?: string, customText?: string) => {
    const cleaned = cleanPhoneForWhatsApp(phone);
    if (!cleaned) return '#';
    let text = customText || customPromoText;
    if (customerName) {
      text = text.replace('{nome}', customerName);
    } else {
      text = text.replace('{nome}', 'Cliente');
    }
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
  };

  const handleCopyPhoneNumbers = () => {
    const phoneList = filteredCustomers
      .map(c => c.phone.replace(/\D/g, ''))
      .filter(p => p.length >= 8)
      .join('\n');

    if (!phoneList) {
      alert('Nenhum número de telefone encontrado com os filtros atuais.');
      return;
    }

    navigator.clipboard.writeText(phoneList);
    setCopiedNumbers(true);
    setTimeout(() => setCopiedNumbers(false), 3000);
  };

  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert('Nenhum cliente para exportar.');
      return;
    }

    const headers = ['Cód. ERP', 'Nome', 'CPF/CNPJ', 'WhatsApp / Telefone', 'Email', 'Endereço', 'Origem', 'Data de Registro', 'Total Pedidos', 'Total Gasto (R$)', 'Data Último Pedido', 'Tags', 'Observações'];
    const rows = filteredCustomers.map(c => [
      `"${(c.externalId || '').replace(/"/g, '""')}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.cpf || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.source || 'manual').replace(/"/g, '""')}"`,
      c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') + ' ' + new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      c.totalOrders || 0,
      (c.totalSpent || 0).toFixed(2),
      c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('pt-BR') : '',
      `"${(Array.isArray(c.tags) ? c.tags.join(', ') : '').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_leads_donamara_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">

      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-600 text-white rounded-2xl shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <span>Clientes & Leads</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-black">
                  {customers.length} cadastrados
                </span>
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Base de contatos automáticos, histórico de consumo e ofertas personalizadas para WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSyncBlueFocusCustomers && (
            <>
              <button
                type="button"
                onClick={() => onSyncBlueFocusCustomers()}
                disabled={isSyncingERP || isSyncing}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                title="Sincronizar novos clientes ou alterações cadastrais do ERP BlueFocus"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingERP ? 'animate-spin' : ''}`} />
                <span>{isSyncingERP ? 'Sincronizando ERP...' : 'Sincronizar Alterações (ERP)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('bluefocus_cliente_carga_numero', '0');
                  localStorage.setItem('bluefocus_cliente_carga_sequencia', '0');
                  localStorage.setItem('bluefocus_start_pessoa_id', '0');
                  localStorage.setItem('bluefocus_tipo_atualizacao_cliente', 'C');
                  onSyncBlueFocusCustomers({
                    cargaNumero: 0,
                    cargaSequencia: 0,
                    startPessoaId: 0,
                    tipoAtualizacao: 'C'
                  });
                }}
                disabled={isSyncingERP || isSyncing}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                title="Zera marcadores e faz uma Carga Total de todos os clientes do ERP BlueFocus"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingERP ? 'animate-spin' : ''}`} />
                <span>Zerar & Sincronizar Tudo (Carga Total)</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSyncFromOrders}
            disabled={isSyncing || isSyncingERP}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 font-bold rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Importar e atualizar clientes com base em todos os pedidos realizados"
          >
            <RefreshCw className={`w-4 h-4 text-stone-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Pedidos'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMarketingModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Disparo WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      {syncSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight">
                {pendingCount} {pendingCount === 1 ? 'Novo Cadastro Pendente de Aprovação' : 'Novos Cadastros Pendentes de Aprovação'}
              </h3>
              <p className="text-xs text-amber-800 font-medium">
                Revise os cadastros solicitados na tela de login e clique em Aprovar ou Reprovar para liberar o acesso.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 shadow-xs"
          >
            {statusFilter === 'pending' ? 'Mostrar Todos' : `Ver Pendentes (${pendingCount})`}
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total de Leads</span>
            <p className="text-2xl font-black text-stone-800 mt-1">{metrics.totalCount}</p>
            <span className="text-[11px] text-stone-500 font-medium">Contatos no sistema</span>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Clientes Ativos</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.buyersCount}</p>
            <span className="text-[11px] text-stone-500 font-medium">Já realizaram compras</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total em Vendas</span>
            <p className="text-2xl font-black text-stone-800 mt-1">{formatCurrency(metrics.totalSpent)}</p>
            <span className="text-[11px] text-stone-500 font-medium">Acumulado dos clientes</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Ticket Médio</span>
            <p className="text-2xl font-black text-purple-600 mt-1">{formatCurrency(metrics.avgSpent)}</p>
            <span className="text-[11px] text-stone-500 font-medium">Por cliente pagante</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-stone-100 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ, WhatsApp, email, produto consumido ou tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`px-3 py-2 border rounded-xl text-xs font-black transition-all cursor-pointer bg-stone-50 text-stone-700 border-stone-200`}
            >
              <option value="all">Todos os Status ({customers.length})</option>
              <option value="pending">🟡 Pendentes de Aprovação ({pendingCount})</option>
              <option value="approved">🟢 Aprovados / Ativos ({approvedCount})</option>
              <option value="rejected">🔴 Reprovados / Inativos ({rejectedCount})</option>
            </select>

            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Todas as Origens</option>
              <option value="bluefocus_erp">BlueFocus ERP</option>
              <option value="orders">Com Pedidos Realizados</option>
              <option value="leads">Apenas Leads (Sem compras)</option>
              <option value="delivery">Delivery</option>
              <option value="instore">Retirada / Presencial</option>
              <option value="popup_novidades">Popup de Novidades</option>
              <option value="manual">Cadastro Manual</option>
            </select>

            {allTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Todas as Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>Tag: {tag}</option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="recent">Mais Recentes</option>
              <option value="spent">Maior Valor Gasto</option>
              <option value="orders">Mais Pedidos</option>
              <option value="name">Nome (A-Z)</option>
            </select>

            <button
              type="button"
              onClick={handleCopyPhoneNumbers}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Copiar lista de telefones/WhatsApp para lista de transmissão"
            >
              {copiedNumbers ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNumbers ? 'Copiados!' : 'Copiar Telefones'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Exportar planilha em Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customers List Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-100 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-800">Nenhum cliente ou lead encontrado</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchTerm || selectedTag !== 'all' || selectedSource !== 'all'
                ? 'Tente remover os filtros de busca para visualizar os registros.'
                : 'Quando clientes realizarem pedidos ou preencherem o cadastro de novidades, eles aparecerão aqui automaticamente.'}
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              {onSyncBlueFocusCustomers && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('bluefocus_cliente_carga_numero', '0');
                    localStorage.setItem('bluefocus_cliente_carga_sequencia', '0');
                    localStorage.setItem('bluefocus_start_pessoa_id', '0');
                    localStorage.setItem('bluefocus_tipo_atualizacao_cliente', 'C');
                    onSyncBlueFocusCustomers({
                      cargaNumero: 0,
                      cargaSequencia: 0,
                      startPessoaId: 0,
                      tipoAtualizacao: 'C'
                    });
                  }}
                  disabled={isSyncingERP}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingERP ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Clientes do BlueFocus ERP</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSyncFromOrders}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
              >
                Sincronizar Pedidos Existentes
              </button>
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold"
              >
                Cadastrar Manualmente
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-4">Cliente / CNPJ-CPF</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Data Registro</th>
                  <th className="py-3.5 px-4">Contato (WhatsApp)</th>
                  <th className="py-3.5 px-4">Meta Mensal (META) & Consumo</th>
                  <th className="py-3.5 px-4">Origem & Status</th>
                  <th className="py-3.5 px-4 text-right">Ações & Aprovação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {paginatedCustomers.map(customer => {
                  const hasOrders = customer.totalOrders > 0;
                  const formattedPhone = customer.phone;
                  const tagsList = Array.isArray(customer.tags) 
                    ? customer.tags 
                    : typeof customer.tags === 'string' ? [customer.tags] : [];

                  const consumption = getCustomerConsumption(customer);
                  const topItems = consumption.topProducts.slice(0, 2);
                  const goalValue = Number(customer.monthlyGoal) || 0;
                  const monthlySpent = consumption.currentMonthSpent || 0;
                  const goalPercent = goalValue > 0 ? Math.min(100, Math.round((monthlySpent / goalValue) * 100)) : 0;
                  const cleanDocDigits = String(customer.cpf || '').replace(/\D/g, '');
                  const loginPassPreview = cleanDocDigits.length >= 5 ? cleanDocDigits.slice(0, 5) : (customer.password || '---');

                  return (
                    <tr key={customer.id} className={`hover:bg-stone-50/70 transition-colors group ${customer.status === 'pending' ? 'bg-amber-50/40' : ''}`}>
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            customer.status === 'pending'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : hasOrders
                              ? 'bg-orange-500 text-white shadow-xs'
                              : 'bg-stone-200 text-stone-700'
                          }`}>
                            {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="font-bold text-stone-800 flex items-center gap-1.5 flex-wrap">
                              <span>{customer.name || 'Sem Nome'}</span>
                              {customer.externalId && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.2 rounded-md">
                                  ERP #{customer.externalId}
                                </span>
                              )}
                              {customer.status === 'pending' && (
                                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-2 py-0.5 rounded-md">
                                  🟡 Pendente de Aprovação
                                </span>
                              )}
                              {customer.status === 'rejected' && (
                                <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 font-bold px-1.5 py-0.2 rounded-md">
                                  🔴 Reprovado
                                </span>
                              )}
                              {hasOrders && (
                                <span className="text-[10px] bg-orange-100 text-orange-800 font-black px-1.5 py-0.2 rounded-md">
                                  Comprador
                                </span>
                              )}
                            </div>
                            {customer.cpf ? (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-stone-600 font-mono font-bold">
                                  CNPJ/CPF: {customer.cpf}
                                </span>
                                <span className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded font-mono border border-stone-200">
                                  Senha: {loginPassPreview}
                                </span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                Sem CNPJ/CPF cadastrado
                              </p>
                            )}
                            {customer.address && (
                              <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5 max-w-xs truncate" title={customer.address}>
                                <MapPin className="w-3 h-3 shrink-0 text-stone-400" />
                                <span>{customer.address}</span>
                              </p>
                            )}
                            {customer.notes && (
                              <p className="text-[11px] text-stone-500 italic mt-0.5">
                                "{customer.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-stone-700 whitespace-nowrap">
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('pt-BR') : '---'}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium">
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <a
                            href={getWhatsAppLink(customer.phone, customer.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                            title="Conversar diretamente no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{formattedPhone}</span>
                          </a>
                          {customer.email && (
                            <div className="text-xs text-stone-500 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-stone-400" />
                              <span className="truncate max-w-[180px]">{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Customer Monthly Goal (META) & Consumption */}
                      <td className="py-3.5 px-4 min-w-[230px]">
                        <div className="space-y-2">
                          {/* Monthly Goal Progress Block */}
                          {goalValue > 0 ? (
                            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-black text-stone-700 uppercase tracking-tight">
                                  🎯 Meta do Mês: {formatCurrency(goalValue)}
                                </span>
                                <span className={`font-black px-1.5 py-0.2 rounded ${
                                  goalPercent >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {goalPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    goalPercent >= 100
                                      ? 'bg-emerald-500'
                                      : 'bg-gradient-to-r from-orange-500 to-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, goalPercent)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold">
                                <span>Comprado no mês: <strong className="text-stone-800">{formatCurrency(monthlySpent)}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenModal(customer)}
                                  className="text-orange-600 hover:underline font-bold cursor-pointer"
                                >
                                  Alterar Meta
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-stone-50 border border-dashed border-stone-200 rounded-xl px-2.5 py-1.5 text-[11px]">
                              <span className="text-stone-500 font-medium">
                                Meta em branco (Compra livre) • Mês: <strong className="text-stone-700">{formatCurrency(monthlySpent)}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenModal(customer)}
                                className="ml-2 text-[10px] font-black text-orange-600 hover:text-orange-700 hover:underline cursor-pointer shrink-0"
                              >
                                + Definir Meta
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-800">
                              Total: {consumption.totalOrders} {consumption.totalOrders === 1 ? 'pedido' : 'pedidos'}
                            </span>
                            <span className="text-xs text-stone-300">•</span>
                            <span className="text-xs font-black text-emerald-600">
                              {formatCurrency(consumption.totalSpent)}
                            </span>
                          </div>

                          {/* Top Consumed Products Badges */}
                          {topItems.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {topItems.map((item, idx) => (
                                <span 
                                  key={idx} 
                                  className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded-lg shadow-2xs"
                                  title={`${item.name} - Pedido ${item.quantity} vezes (${formatCurrency(item.totalSpent)})`}
                                >
                                  <Flame className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="max-w-[130px] truncate">{item.name}</span>
                                  <span className="text-amber-700 font-black">({item.quantity}x)</span>
                                </span>
                              ))}

                              <button
                                type="button"
                                onClick={() => handleOpenConsumptionProfile(customer)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer ml-1"
                                title="Ver análise detalhada de consumo e gerar oferta personalizada"
                              >
                                <span>Ver mais ({consumption.topProducts.length})</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Source & Tags */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div>
                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              customer.source === 'bluefocus_erp'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : customer.source === 'cadastro_cliente'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : (customer.source === 'instore' || customer.source === 'pedido_loja' || customer.source === 'dine_in')
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}>
                              {customer.source === 'bluefocus_erp' ? 'BlueFocus ERP' :
                               customer.source === 'cadastro_cliente' ? 'Novo Cadastro App' :
                               (customer.source === 'instore' || customer.source === 'pedido_loja' || customer.source === 'dine_in') ? 'Retirada' :
                               'Manual / Sistema'}
                            </span>
                          </div>
                          {tagsList.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tagsList.map((tag, idx) => (
                                <span key={idx} className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {customer.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveCustomer(customer)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Aprovar cadastro e liberar login"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Aprovar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectCustomer(customer)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Reprovar cadastro"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reprovar</span>
                              </button>
                            </>
                          )}

                          {customer.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleApproveCustomer(customer)}
                              className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                              title="Reconsiderar e aprovar cliente"
                            >
                              Aprovar
                            </button>
                          )}

                          {/* Dedicated Consumption Intelligence & Targeted Offer Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenConsumptionProfile(customer)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
                            title="Ver o que o cliente mais consumiu e disparar oferta direcionada no WhatsApp"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Oferta Direcionada</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenModal(customer)}
                            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer"
                            title="Editar Dados e Meta Mensal do Cliente"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(customer.id, customer.name)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                            title="Excluir Cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-stone-100 bg-stone-50/70">
            <div className="text-xs text-stone-500 font-medium">
              Mostrando <span className="font-bold text-stone-800">{Math.min((safeCurrentPage - 1) * itemsPerPage + 1, filteredCustomers.length)}</span> a <span className="font-bold text-stone-800">{Math.min(safeCurrentPage * itemsPerPage, filteredCustomers.length)}</span> de <span className="font-bold text-stone-800">{filteredCustomers.length}</span> clientes
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - safeCurrentPage) <= 1
                      );
                    })
                    .reduce<(number | string)[]>((acc, page, index, arr) => {
                      if (index > 0 && page - (arr[index - 1] as number) > 1) {
                        acc.push(`ellipsis-${page}`);
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map(item => {
                      if (typeof item === 'string') {
                        return (
                          <span key={item} className="px-1.5 text-stone-400 text-xs font-bold select-none">
                            ...
                          </span>
                        );
                      }
                      const isActive = item === safeCurrentPage;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-orange-600 text-white shadow-xs'
                              : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consumption Intelligence & Targeted WhatsApp Offer Modal */}
      {selectedProfileCustomer && (() => {
        const profile = getCustomerConsumption(selectedProfileCustomer);
        const hasHistory = profile.topProducts.length > 0;
        const maxQty = profile.topProducts.length > 0 ? profile.topProducts[0].quantity : 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-stone-900 via-stone-800 to-orange-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-600 text-stone-950 rounded-2xl shadow-inner font-black">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-white">
                        Perfil de Consumo: {selectedProfileCustomer.name || 'Cliente'}
                      </h3>
                      {profile.totalOrders > 2 && (
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                          ★ Cliente Fiel
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-300 flex items-center gap-2 mt-0.5">
                      <span>WhatsApp: {selectedProfileCustomer.phone}</span>
                      {selectedProfileCustomer.address && <span>• {selectedProfileCustomer.address}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfileCustomer(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold uppercase text-stone-400 block">Total Pedidos</span>
                    <span className="text-lg font-black text-stone-800">{profile.totalOrders}</span>
                  </div>
                  <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Total Gasto</span>
                    <span className="text-lg font-black text-emerald-700">{formatCurrency(profile.totalSpent)}</span>
                  </div>
                  <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200">
                    <span className="text-[10px] font-bold uppercase text-purple-700 block">Ticket Médio</span>
                    <span className="text-lg font-black text-purple-700">
                      {formatCurrency(profile.totalOrders > 0 ? profile.totalSpent / profile.totalOrders : 0)}
                    </span>
                  </div>
                  <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Itens Comprados</span>
                    <span className="text-lg font-black text-amber-800">{profile.totalItemsOrdered} itens</span>
                  </div>
                </div>

                {/* Ranking of Most Consumed Products */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-black text-stone-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <Flame className="w-4 h-4 text-orange-600" />
                      <span>Produtos Mais Consumidos pelo Cliente</span>
                    </h4>
                    {profile.favoriteCategoryName && (
                      <span className="text-[11px] bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded-full">
                        Categoria Favorita: {profile.favoriteCategoryName}
                      </span>
                    )}
                  </div>

                  {hasHistory ? (
                    <div className="space-y-2.5 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                      {profile.topProducts.map((prod, index) => {
                        const pct = Math.round((prod.quantity / maxQty) * 100);
                        return (
                          <div key={prod.productId} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                  index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-stone-300 text-stone-800' : 'bg-stone-200 text-stone-600'
                                }`}>
                                  {index + 1}
                                </span>
                                <span>{prod.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-stone-500 font-medium">{formatCurrency(prod.totalSpent)}</span>
                                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-black">
                                  {prod.quantity}x
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all" 
                                style={{ width: `${Math.max(pct, 5)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-dashed border-stone-300 text-center space-y-1 text-xs text-stone-500">
                      <p className="font-bold text-stone-700">Este cliente ainda não realizou pedidos registrados.</p>
                      <p>Envie uma oferta de boas-vindas ou convite especial para realizar o primeiro pedido!</p>
                    </div>
                  )}
                </div>

                {/* Personalized WhatsApp Offer Generator */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2 uppercase tracking-wide">
                      <Gift className="w-4 h-4 text-emerald-600" />
                      <span>Gerador de Oferta Personalizada no WhatsApp</span>
                    </h4>
                    <span className="text-[10px] bg-emerald-200/60 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      1-Clique para Enviar
                    </span>
                  </div>

                  <p className="text-xs text-emerald-800">
                    O sistema analisou os itens favoritos e gerou mensagens prontas para você fechar novas vendas com este cliente:
                  </p>

                  {/* Template selector chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectOfferTemplate('favorito')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                        selectedOfferTemplate === 'favorito'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      🥖 Fornada do Favorito
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectOfferTemplate('categoria')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                        selectedOfferTemplate === 'categoria'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      🥐 Novidade da Categoria
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectOfferTemplate('saudades')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                        selectedOfferTemplate === 'saudades'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      ☕ Saudades & Retorno
                    </button>
                  </div>

                  {/* Message editor */}
                  <textarea
                    rows={4}
                    value={customOfferText}
                    onChange={(e) => setCustomOfferText(e.target.value)}
                    className="w-full p-3 bg-white border border-emerald-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                  />

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(customOfferText);
                        setCopiedOfferText(true);
                        setTimeout(() => setCopiedOfferText(false), 2500);
                      }}
                      className="px-3 py-2 bg-white hover:bg-stone-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedOfferText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedOfferText ? 'Mensagem Copiada!' : 'Copiar Texto'}</span>
                    </button>

                    <a
                      href={getWhatsAppLink(selectedProfileCustomer.phone, selectedProfileCustomer.name, customOfferText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      <span>Abrir no WhatsApp e Enviar</span>
                    </a>
                  </div>
                </div>

                {/* Historical Orders breakdown */}
                {profile.matchedOrders.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-stone-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <ShoppingBag className="w-4 h-4 text-stone-600" />
                      <span>Histórico de Pedidos Realizados ({profile.matchedOrders.length})</span>
                    </h4>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {profile.matchedOrders.map((ord, idx) => {
                        const items = Array.isArray(ord.items) ? ord.items : [];
                        return (
                          <div key={ord.id || idx} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-stone-800">
                                Pedido #{ord.id?.slice(-5) || idx + 1} • {new Date(ord.createdAt).toLocaleDateString('pt-BR')} {new Date(ord.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="font-black text-emerald-700">{formatCurrency(ord.total)}</span>
                            </div>
                            <div className="text-[11px] text-stone-600 flex flex-wrap gap-1">
                              {items.map((it: any, itIdx: number) => (
                                <span key={itIdx} className="bg-white border border-stone-200 px-1.5 py-0.5 rounded text-stone-700">
                                  {it.quantity}x {it.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedProfileCustomer(null)}
                  className="px-5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Fechar Análise
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Marketing / WhatsApp Broadcast Modal */}
      {showMarketingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 text-white rounded-2xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Ações de Marketing no WhatsApp</h3>
                  <p className="text-xs text-emerald-100">Envio de promoções e comunicados para seus clientes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMarketingModal(false)}
                className="p-2 hover:bg-white/10 rounded-full text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Modelos Prontos de Mensagem
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPromoMessageTemplate('ola_cliente');
                      setCustomPromoText(`Olá {nome}! 🥟\nPassando para avisar que o cardápio da ${storeInfo.name || 'DONAMARA - REVENDA'} está cheio de delícias fresquinhas esperando por você hoje!\n\nConfira e faça seu pedido direto pelo link:\n${window.location.origin}`);
                    }}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                      promoMessageTemplate === 'ola_cliente' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800' 
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    ✨ Cardápio do Dia
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoMessageTemplate('cupom_especial');
                      setCustomPromoText(`Oi {nome}! 🥐\nTemos uma surpresa especial para você na ${storeInfo.name || 'DONAMARA - REVENDA'} hoje!\nUse nosso cardápio online e saboreie nossos produtos artesanais quentinhos.\n\nAcesse agora:\n${window.location.origin}`);
                    }}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                      promoMessageTemplate === 'cupom_especial' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800' 
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    🎁 Promoção Especial
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoMessageTemplate('saudades');
                      setCustomPromoText(`Olá {nome}! ☕\nSentimos sua falta na ${storeInfo.name || 'DONAMARA - REVENDA'}!\nQue tal salgados quentinhos ou um pedido especial hoje?\n\nFaça seu pedido em segundos pelo link:\n${window.location.origin}`);
                    }}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                      promoMessageTemplate === 'saudades' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800' 
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    💌 Sentimos sua Falta
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Mensagem Personalizada (Use {"{nome}"} para inserir o nome do cliente)
                </label>
                <textarea
                  rows={5}
                  value={customPromoText}
                  onChange={(e) => setCustomPromoText(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed font-sans"
                />
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">Prévia da Mensagem:</span>
                <p className="text-xs text-stone-800 whitespace-pre-line bg-white p-3 rounded-lg border border-stone-200 font-sans">
                  {customPromoText.replace('{nome}', 'Maria')}
                </p>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-stone-500">
                  Dica: Para disparar individualmente com o nome personalizado, use o botão verde de WhatsApp ao lado de cada cliente na tabela.
                </p>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyPhoneNumbers}
                className="px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                {copiedNumbers ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedNumbers ? 'Telefones Copiados!' : 'Copiar Lista de Telefones'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMarketingModal(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer / Lead Create & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 text-white rounded-2xl">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {editingCustomer ? 'Editar Cliente / Lead' : 'Novo Cliente / Lead'}
                  </h3>
                  <p className="text-xs text-orange-100">Preencha os dados do contato</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Nome Completo / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João da Silva / Padaria Central"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  CNPJ ou CPF (Usuário de Login) *
                </label>
                <input
                  type="text"
                  value={formCpf}
                  onChange={(e) => setFormCpf(e.target.value)}
                  placeholder="Ex: 12.345.678/0001-90 ou 123.456.789-00"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                {formCpf.replace(/\D/g, '').length >= 5 && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    🔑 Senha de acesso do cliente (5 primeiros dígitos): <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{formCpf.replace(/\D/g, '').slice(0, 5)}</span>
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-orange-900">
                  🎯 META Mensal de Compras (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMonthlyGoal}
                  onChange={(e) => setFormMonthlyGoal(e.target.value)}
                  placeholder="Deixe em branco para compra livre sem meta (Ex: 1500.00)"
                  className="w-full p-2.5 bg-white border border-orange-300 rounded-xl text-sm font-bold text-stone-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <p className="text-[11px] text-orange-800 leading-relaxed">
                  Conforme o cliente for comprando no mês, o percentual crescerá até atingir <strong>100%</strong>. Se deixar em branco, o cliente comprará normalmente sem meta.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Status de Acesso do Cliente
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="approved">🟢 Aprovado (Liberado para Login e Pedidos)</option>
                  <option value="pending">🟡 Pendente (Aguardando Aprovação do Administrador)</option>
                  <option value="rejected">🔴 Reprovado (Acesso Bloqueado)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: (34) 98765-4321"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  E-mail (Opcional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ex: cliente@email.com"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Endereço (Opcional)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Ex: Revenda, Atacado, Frequente"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Observações Internas (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Observações sobre o cliente..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-semibold text-xs disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : editingCustomer ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersTab;
