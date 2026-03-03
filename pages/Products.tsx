import React, { useEffect, useState } from 'react';
import { Product, AppSettings, AutomationConfig } from '../types';
import { fetchProducts, fetchSettings, updateProduct, importProductsFromIntegration, deleteProduct, deleteAllProducts, createSchedule, extractFromLink, saveProduct, fetchAutomationConfig } from '../services/mockService';
import { Search, Filter, ExternalLink, Trash2, Copy, Check, Wand2, X, Save, RefreshCw, Loader2, Calendar, Clock, Eye, Trash, Rocket, Link as LinkIcon, CheckCircle2, AlertCircle, Image as ImageIcon, Edit3, Send, AlertTriangle, Package } from 'lucide-react';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Quick Post (Link Import) State
  const [isQuickPostOpen, setIsQuickPostOpen] = useState(false);
  const [quickPostLink, setQuickPostLink] = useState('');
  const [quickPostLoading, setQuickPostLoading] = useState(false);
  const [quickPostData, setQuickPostData] = useState<{ title: string; price: number | null; image: string; platform: string } | null>(null);
  const [quickPostError, setQuickPostError] = useState<string | null>(null);
  const [quickPostSaving, setQuickPostSaving] = useState(false);
  const [quickPostSaved, setQuickPostSaved] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState('');

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedProductForSchedule, setSelectedProductForSchedule] = useState<Product | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState<'once' | 'daily' | 'weekly'>('once');

  // Preview Template Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  // Platform Filter Tab
  const [platformFilter, setPlatformFilter] = useState<'all' | 'Shopee' | 'Amazon' | 'Mercado Livre'>('all');

  // Delete All State
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection State
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const toggleProductSelection = (id: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedProducts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.size === 0) return;

    if (!confirm(`Tem certeza que deseja excluir ${selectedProducts.size} produtos selecionados?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete one by one for now (or implement bulk delete in service)
      const promises = Array.from(selectedProducts).map((id: string) => deleteProduct(id));
      await Promise.all(promises);

      setProducts(products.filter(p => !selectedProducts.has(p.id)));
      setSelectedProducts(new Set());
      alert('Produtos excluídos com sucesso!');
    } catch (e) {
      alert('Erro ao excluir produtos selecionados');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllProducts = async () => {
    const platform = platformFilter === 'all' ? 'todos os' : 'os produtos da';
    const platformName = platformFilter === 'all' ? 'produtos' : platformFilter;

    if (!confirm(`Tem certeza que deseja excluir ${platform} ${platformName}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllProducts(platformFilter === 'all' ? undefined : platformFilter);
      await loadData();
      alert('Produtos excluídos com sucesso!');
    } catch (e) {
      alert('Erro ao excluir produtos');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const [prodData, settingsData, configData] = await Promise.all([fetchProducts(), fetchSettings(), fetchAutomationConfig()]);
    setProducts(prodData);
    setSettings(settingsData);
    setAutomationConfig(configData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick Post handlers
  const handleQuickPostGenerate = async () => {
    if (!quickPostLink) {
      setQuickPostError('Por favor, cole um link.');
      return;
    }
    setQuickPostError(null);
    setQuickPostLoading(true);
    setQuickPostData(null);
    setQuickPostSaved(false);

    try {
      const data = await extractFromLink(quickPostLink);
      if (!data.title) {
        throw new Error('Não foi possível extrair dados deste link.');
      }
      setQuickPostData(data);
      setManualPrice(data.price?.toString() || '');
      setEditingPrice(false);
    } catch (err: any) {
      setQuickPostError(err.message || 'Falha ao buscar dados do produto.');
    } finally {
      setQuickPostLoading(false);
    }
  };

  const getQuickPostPrice = () => {
    if (manualPrice) {
      return parseFloat(manualPrice.replace(',', '.'));
    }
    return quickPostData?.price || 0;
  };

  const handleQuickPostSave = async () => {
    if (!quickPostData) return;
    setQuickPostSaving(true);
    const price = getQuickPostPrice();
    try {
      await saveProduct({
        title: quickPostData.title,
        price: price,
        image: quickPostData.image,
        affiliate_link: quickPostLink,
        platform: quickPostData.platform as Product['platform'],
        active: true,
      });
      setQuickPostSaved(true);
      setTimeout(() => {
        setQuickPostSaved(false);
      }, 3000);
      loadData();
    } catch (err) {
      setQuickPostError('Falha ao salvar produto.');
    } finally {
      setQuickPostSaving(false);
    }
  };

  const resetQuickPost = () => {
    setQuickPostLink('');
    setQuickPostData(null);
    setQuickPostError(null);
    setQuickPostSaving(false);
    setQuickPostSaved(false);
    setEditingPrice(false);
    setManualPrice('');
  };

  const formatPrice = (price: number) => price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generateFromTemplateText = (product: Partial<Product>) => {
    let text = settings?.salesTemplate || `🔥 OFERTA IMPERDÍVEL! 🔥\n\n{titulo}\n\n💰 De: R$ {preco_antigo}\n✅ Por apenas: R$ {preco}\n\n🛒 Garanta o seu agora:\n{link}`;
    text = text.replace(/{titulo}/g, product.title || '');
    text = text.replace(/{preco}/g, formatPrice(product.price || 0));
    text = text.replace(/{preco_antigo}/g, formatPrice((product.price || 0) * 1.2));
    text = text.replace(/{link}/g, product.affiliate_link || '');
    text = text.replace(/{plataforma}/g, product.platform || '');
    text = text.replace(/{desconto}/g, '30%');
    return text;
  };

  const handleImport = async (platform: string) => {
    setIsImporting(true);
    try {
      const count = await importProductsFromIntegration(platform);
      alert(`${count} produtos importados com sucesso da ${platform.toUpperCase()}!`);
      setIsImportModalOpen(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (confirm(`Deseja realmente excluir "${product.title}"?`)) {
      try {
        await deleteProduct(product.id);
        setProducts(products.filter(p => p.id !== product.id));
      } catch (e) {
        alert('Erro ao excluir produto');
      }
    }
  };

  const openScheduleModal = (product: Product) => {
    setSelectedProductForSchedule(product);
    setScheduleTime('');
    setScheduleFrequency('once');
    setIsScheduleModalOpen(true);
  };

  const handleCreateSchedule = async () => {
    if (!selectedProductForSchedule || !scheduleTime) return;
    try {
      await createSchedule({
        productId: selectedProductForSchedule.id,
        productTitle: selectedProductForSchedule.title,
        productImage: selectedProductForSchedule.image,
        scheduledTime: new Date(scheduleTime).toISOString(),
        status: 'pending',
        platform: 'WhatsApp',
        frequency: scheduleFrequency
      });
      alert('Agendamento criado com sucesso!');
      setIsScheduleModalOpen(false);
    } catch (e) {
      alert('Erro ao criar agendamento');
    }
  };

  const openPreview = (product: Product) => {
    setPreviewProduct(product);
    setIsPreviewOpen(true);
  };

  const filteredProducts = products.filter(p => {
    const matchesText = p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.platform.toLowerCase().includes(filter.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || p.platform === platformFilter;
    return matchesText && matchesPlatform;
  });

  // Helper for PT-BR currency
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // WhatsApp Share Function
  const handleWhatsAppShare = (product: Product) => {
    const text = generateFromTemplateText(product);
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Produtos</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Gerencie seus links e itens de afiliado.</p>
        </div>
        <div className="flex space-x-2 sm:space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-main)] px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors font-medium text-sm"
          >
            <RefreshCw size={18} />
            <span className="hidden sm:inline">Importar Vendas</span>
          </button>
          <button
            onClick={() => { resetQuickPost(); setIsQuickPostOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors font-medium text-sm"
          >
            <Rocket size={18} />
            <span className="hidden sm:inline">Quick Post</span>
          </button>
        </div>
      </div>

      {automationConfig?.cycleCompleted && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/10 border-red-200 dark:border-red-800 border p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row gap-5 items-center justify-between animate-fade-in shadow-lg shadow-red-500/5 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="flex gap-4 items-start relative z-10">
            <div className="bg-red-500 p-2.5 rounded-2xl shadow-lg shadow-red-500/30">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-red-900 dark:text-red-400 font-extrabold text-base sm:text-lg tracking-tight">
                Ciclo de Envios Finalizado!
              </h3>
              <p className="text-red-700/80 dark:text-red-300/70 text-sm mt-1 max-w-md leading-relaxed">
                Todos os produtos salvos já foram enviados. Eles continuarão se repetindo automaticamente, mas para renovar seu feed, cadastre ou importe novos produtos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Platform Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { id: 'all', label: 'Todos', count: products.length },
          { id: 'Shopee', label: 'Shopee', count: products.filter(p => p.platform === 'Shopee').length },
          { id: 'Amazon', label: 'Amazon', count: products.filter(p => p.platform === 'Amazon').length },
          { id: 'Mercado Livre', label: 'ML', count: products.filter(p => p.platform === 'Mercado Livre').length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPlatformFilter(tab.id as any)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0 ${platformFilter === tab.id
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-main)]'
              }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${platformFilter === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--color-bg-main)] text-[var(--color-text-muted)]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-4 bg-[var(--color-bg-card)] p-3 sm:p-4 rounded-xl border border-[var(--color-border)] shadow-sm">
        <div className="flex-1 min-w-[150px] relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {/* Delete Selected Button */}
        {selectedProducts.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 flex items-center space-x-1.5 disabled:opacity-50 transition-colors text-sm"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            <span>({selectedProducts.size})</span>
          </button>
        )}

        {/* Delete All Button */}
        {filteredProducts.length > 0 && selectedProducts.size === 0 && (
          <button
            onClick={handleDeleteAllProducts}
            disabled={isDeleting}
            className="px-3 py-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 flex items-center space-x-1.5 disabled:opacity-50 text-sm"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash size={16} />}
            <span className="hidden sm:inline">Excluir Todos ({filteredProducts.length})</span>
            <span className="sm:hidden">({filteredProducts.length})</span>
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-main)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 lg:px-6 py-4 font-medium text-[var(--color-text-muted)] w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Produto</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Preço</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Status</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Plataforma</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)] text-right px-10">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Nenhum produto encontrado. Adicione um para começar.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-[var(--color-bg-main)] transition-colors border-b border-[var(--color-border)] last:border-0 ${selectedProducts.has(product.id) ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''} transition-colors`}
                  >
                    <td className="px-4 lg:px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                      />
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.image}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text-main)] line-clamp-1">{product.title}</p>
                          <a
                            href={product.affiliate_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline flex items-center mt-0.5"
                          >
                            Ver Link <ExternalLink size={10} className="ml-1" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="font-bold text-[var(--color-text-main)]">
                        {product.price ? `R$ ${product.price.toFixed(2)}` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {product.platform}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => openPreview(product)}
                          className="p-2 rounded-lg transition-colors bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          title="Ver Template Salvo"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {/* Select All mobile */}
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center space-x-2 text-sm text-slate-500">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
              onChange={toggleAllSelection}
            />
            <span>Selecionar Todos</span>
          </label>
          <span className="text-xs text-slate-400">{filteredProducts.length} produtos</span>
        </div>

        {loading ? (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-muted)]">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-muted)]">
            Nenhum produto encontrado. Adicione um para começar.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-3 space-y-3">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-1 flex-shrink-0"
                  checked={selectedProducts.has(product.id)}
                  onChange={() => toggleProductSelection(product.id)}
                />
                <img
                  src={product.image}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text-main)] text-sm line-clamp-2">{product.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {product.platform}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {product.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <a
                  href={product.affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center"
                >
                  Ver Link <ExternalLink size={10} className="ml-1" />
                </a>
                <div className="flex space-x-1">
                  <button
                    onClick={() => openPreview(product)}
                    className="p-2 rounded-lg transition-colors bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    title="Ver Template"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Import Modal (Shopee Auto) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-[var(--color-border)]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-[var(--color-text-main)]">Importar Vendas — Shopee</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">Importação automática via API da Shopee usando suas credenciais configuradas.</p>

              {(() => {
                const config = settings?.integrations?.find(i => i.id === 'shopee');
                return (
                  <button
                    onClick={() => handleImport('shopee')}
                    disabled={!config?.isEnabled || isImporting}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${!config?.isEnabled
                      ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50'
                      }`}
                  >
                    <span className="font-medium text-slate-700">Shopee</span>
                    {isImporting ? <Loader2 className="animate-spin text-emerald-500" size={18} /> : (
                      !config?.isEnabled ? <span className="text-xs text-red-400">Não configurado</span> : <ExternalLink size={18} className="text-slate-400" />
                    )}
                  </button>
                );
              })()}

              <p className="text-xs text-slate-400 mt-4 text-center">
                Para Amazon e Mercado Livre, use o botão <strong>Quick Post</strong> para importar via link.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Post Modal (Link Import) */}
      {isQuickPostOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-[var(--color-border)]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <div className="flex items-center space-x-2">
                <div className="bg-[var(--color-bg-card)] p-2 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <Rocket size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-main)]">Quick Post</h2>
                  <p className="text-xs text-emerald-700">Cole o link e importe automaticamente</p>
                </div>
              </div>
              <button onClick={() => setIsQuickPostOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Link Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Link do Produto (Amazon, Mercado Livre, Shopee, etc.)
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={quickPostLink}
                    onChange={(e) => setQuickPostLink(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 min-w-[200px] pl-10 pr-4 py-2 sm:py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickPostGenerate()}
                  />
                  <button
                    onClick={handleQuickPostGenerate}
                    disabled={quickPostLoading || !quickPostLink}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {quickPostLoading ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                  </button>
                </div>
                {quickPostError && (
                  <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
                    <AlertCircle size={16} className="mr-2 flex-shrink-0" /> {quickPostError}
                  </div>
                )}
              </div>

              {/* Product Preview */}
              {quickPostData && (
                <div className="bg-[var(--color-bg-main)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[var(--color-text-main)] flex items-center text-sm">
                      <div className="bg-blue-50 p-1.5 rounded-lg mr-2">
                        <ImageIcon className="text-blue-600" size={16} />
                      </div>
                      Dados do Produto
                    </h4>
                    <span className="px-2.5 py-1 bg-[var(--color-bg-main)] rounded-full text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {quickPostData.platform}
                    </span>
                  </div>
                  <div className="flex gap-5">
                    <div className="relative group">
                      {quickPostData.image ? (
                        <img src={quickPostData.image} alt="Produto" className="w-24 h-24 rounded-xl object-contain bg-[var(--color-bg-main)] border border-[var(--color-border)] shadow-sm transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-[var(--color-bg-main)] flex items-center justify-center border border-dashed border-[var(--color-border)]">
                          <ImageIcon className="text-[var(--color-text-muted)]" size={32} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-semibold text-[var(--color-text-main)] text-sm line-clamp-2 leading-snug mb-2">{quickPostData.title}</p>
                      {/* Editable Price */}
                      <div className="mt-2 flex items-center gap-2">
                        {editingPrice ? (
                          <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-emerald-600">R$</span>
                            <input
                              type="text"
                              value={manualPrice}
                              onChange={(e) => setManualPrice(e.target.value)}
                              onBlur={() => setEditingPrice(false)}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingPrice(false)}
                              autoFocus
                              className="w-24 px-2 py-1 text-lg font-bold text-emerald-600 border border-emerald-500 rounded-lg bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="0,00"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingPrice(true)}
                            className="text-xl font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 group"
                            title="Clique para editar o preço"
                          >
                            R$ {getQuickPostPrice()?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                            <Edit3 size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-600 mt-1.5 flex items-center bg-amber-50 px-2 py-0.5 rounded w-fit">
                        <AlertCircle size={10} className="mr-1" /> Clique no preço para editar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Template Preview */}
              {quickPostData && (
                <div className="bg-[#f0f2f5] rounded-2xl p-6 border border-slate-200 mt-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-20"></div>
                  <h4 className="font-bold text-slate-700 flex items-center text-sm mb-4">
                    <div className="bg-green-100 p-1.5 rounded-lg mr-2">
                      <svg viewBox="0 0 24 24" className="text-green-600 w-4 h-4" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                      </svg>
                    </div>
                    Pré-visualização WhatsApp
                  </h4>

                  <div className="relative">
                    {/* Chat Bubble decoration */}
                    <div className="absolute -left-2 top-0 w-3 h-3 bg-white rotate-45 transform origin-top-right"></div>

                    <div className="bg-[var(--color-bg-card)] rounded-2xl rounded-tl-none shadow-sm p-4 max-w-full sm:max-w-[90%] whitespace-pre-wrap text-sm break-words relative border-l-4 border-emerald-500/20 text-[var(--color-text-main)]">
                      {quickPostData.image && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-[var(--color-border)] shadow-inner">
                          <img src={quickPostData.image} alt="" className="w-full h-48 object-contain bg-[var(--color-bg-main)]" />
                        </div>
                      )}
                      <div className="text-slate-800 leading-relaxed font-normal">
                        {generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product)}
                      </div>
                      <div className="flex justify-end items-center gap-1 mt-2">
                        <p className="text-[10px] text-slate-400 font-medium">12:45</p>
                        <div className="flex">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-blue-500" fill="currentColor">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                          </svg>
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-blue-500 -ml-2" fill="currentColor">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => {
                        const text = generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product);
                        navigator.clipboard.writeText(text);
                        alert('Copiado para a área de transferência!');
                      }}
                      className="flex-1 text-sm bg-[var(--color-bg-card)] text-[var(--color-text-main)] border border-[var(--color-border)] py-3 rounded-xl hover:bg-[var(--color-bg-main)] transition-all flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Copy size={16} /> Copiar
                    </button>
                    <button
                      onClick={() => {
                        const text = generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product);
                        const encodedText = encodeURIComponent(text);
                        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
                      }}
                      className="flex-1 text-sm bg-green-500 text-white py-3 rounded-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2 font-bold shadow-lg shadow-green-500/20"
                    >
                      <Send size={16} /> WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Save Footer - Moved inside the modal container */}
            {quickPostData && (
              <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-bg-main)] flex items-center justify-between gap-4">
                <button
                  onClick={resetQuickPost}
                  className="px-4 py-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-sm font-medium transition-colors"
                >
                  Novo Link
                </button>
                <button
                  onClick={handleQuickPostSave}
                  disabled={quickPostSaving || quickPostSaved}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-all transform hover:scale-[1.02] active:scale-[0.98]
                      ${quickPostSaved
                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200 cursor-default'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'}
                      disabled:opacity-70`}
                >
                  {quickPostSaving ? (
                    <><Loader2 className="animate-spin mr-2" size={20} /> Salvando...</>
                  ) : quickPostSaved ? (
                    <><CheckCircle2 className="mr-2" size={20} /> Produto Salvo!</>
                  ) : (
                    <><Save className="mr-2" size={20} /> Salvar em Meus Produtos</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && selectedProductForSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-purple-50">
              <div className="flex items-center space-x-2">
                <div className="bg-[var(--color-bg-card)] p-2 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-main)]">Agendar Envio</h2>
                  <p className="text-xs text-purple-700">WhatsApp Automático</p>
                </div>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-main)] rounded-lg">
                <img src={selectedProductForSchedule.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text-main)] truncate">{selectedProductForSchedule.title}</p>
                  <p className="text-sm text-emerald-600 font-semibold">{formatCurrency(selectedProductForSchedule.price)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                  <Clock size={16} className="inline mr-1" /> Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2">Quando enviar?</label>
                <div className="flex gap-2">
                  {[
                    { value: 'once', label: 'Uma vez' },
                    { value: 'daily', label: 'Diário' },
                    { value: 'weekly', label: 'Semanal' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setScheduleFrequency(opt.value as 'once' | 'daily' | 'weekly')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${scheduleFrequency === opt.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-[var(--color-bg-main)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-card)]'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-bg-main)] flex justify-end space-x-3">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-bg-card)] transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSchedule}
                disabled={!scheduleTime}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm flex items-center space-x-2 font-medium disabled:opacity-50"
              >
                <Calendar size={18} />
                <span>Agendar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Template Modal */}
      {isPreviewOpen && previewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[var(--color-border)]">
            <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-emerald-50">
              <div className="flex items-center space-x-2">
                <div className="bg-[var(--color-bg-card)] p-2 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <Eye size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-main)]">Template Salvo</h2>
                  <p className="text-xs text-emerald-700">Pronto para WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
              <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border)] shadow-sm transition-all hover:bg-[var(--color-bg-card)]/50">
                <img src={previewProduct.image} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm border border-[var(--color-border)]" />
                <div className="min-w-0">
                  <p className="font-bold text-[var(--color-text-main)] line-clamp-2 leading-tight mb-1">{previewProduct.title}</p>
                  <p className="text-xl text-emerald-600 font-extrabold">{formatCurrency(previewProduct.price)}</p>
                </div>
              </div>

              <div className="bg-[#e5ddd5] p-5 rounded-2xl border border-slate-200/50 shadow-inner relative overflow-hidden">
                {/* WhatsApp Chat Background Simulation */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

                <div className="bg-[var(--color-bg-card)] p-4 rounded-2xl rounded-tr-none shadow-md text-sm text-[var(--color-text-main)] whitespace-pre-wrap break-words max-w-[90%] ml-auto relative z-10 border-l-4 border-emerald-500/20">
                  <div className="leading-relaxed">
                    {generateFromTemplateText(previewProduct)}
                  </div>
                  <div className="flex justify-end items-center gap-1 mt-1 text-slate-400">
                    <span className="text-[10px]">agora</span>
                    <CheckCircle2 size={12} className="text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={() => {
                  const textToCopy = generateFromTemplateText(previewProduct);
                  navigator.clipboard.writeText(textToCopy);
                  alert('Texto copiado!');
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm flex items-center space-x-2 font-medium"
              >
                <Copy size={18} />
                <span>Copiar Texto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
