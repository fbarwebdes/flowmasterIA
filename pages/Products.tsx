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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Gerencie seus links e itens de afiliado.</p>
        </div>
        <div className="flex space-x-2 sm:space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors font-medium text-sm"
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
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${platformFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 lg:px-6 py-4 font-medium text-slate-500 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th className="px-4 lg:px-6 py-4 font-medium text-slate-500">Produto</th>
                <th className="px-4 lg:px-6 py-4 font-medium text-slate-500">Plataforma</th>
                <th className="px-4 lg:px-6 py-4 font-medium text-slate-500">Status</th>
                <th className="px-4 lg:px-6 py-4 font-medium text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Nenhum produto encontrado. Adicione um para começar.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
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
                          <p className="font-medium text-slate-900 line-clamp-1">{product.title}</p>
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {product.platform}
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
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Nenhum produto encontrado. Adicione um para começar.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
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
                  <p className="font-medium text-slate-900 text-sm line-clamp-2">{product.title}</p>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Importar Vendas — Shopee</h3>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <div className="flex items-center space-x-2">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Rocket size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Quick Post</h2>
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
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                  <h4 className="font-semibold text-slate-700 flex items-center text-sm">
                    <ImageIcon className="mr-2 text-blue-500" size={18} /> Dados do Produto
                  </h4>
                  <div className="flex gap-4">
                    {quickPostData.image ? (
                      <img src={quickPostData.image} alt="Produto" className="w-20 h-20 rounded-lg object-cover border flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="text-slate-400" size={28} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm line-clamp-2">{quickPostData.title}</p>
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
                            <Edit3 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-amber-600 mt-1">⚠️ Clique no preço para corrigir se necessário</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 rounded text-xs text-slate-600">
                        {quickPostData.platform}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Template Preview */}
              {quickPostData && (
                <div className="bg-[#e5ddd5] rounded-xl p-4 border border-slate-200 mt-4">
                  <h4 className="font-semibold text-slate-700 flex items-center text-sm mb-3">
                    <svg viewBox="0 0 24 24" className="mr-2 text-green-500 w-5 h-5 flex-shrink-0" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                    </svg>
                    Pré-visualização WhatsApp
                  </h4>
                  <div className="bg-white rounded-lg shadow-sm p-3 max-w-xs ml-auto whitespace-pre-wrap text-sm">
                    {quickPostData.image && (
                      <img src={quickPostData.image} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
                    )}
                    {generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product)}
                    <p className="text-[10px] text-slate-400 text-right mt-1">agora</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const text = generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product);
                        navigator.clipboard.writeText(text);
                      }}
                      className="flex-1 text-sm bg-slate-600 text-white py-2.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Copy size={14} /> Copiar
                    </button>
                    <button
                      onClick={() => {
                        const text = generateFromTemplateText({ ...quickPostData, price: getQuickPostPrice(), affiliate_link: quickPostLink } as Product);
                        const encodedText = encodeURIComponent(text);
                        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
                      }}
                      className="flex-1 text-sm bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Send size={14} /> WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Footer */}
          {quickPostData && (
            <div className="p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleQuickPostSave}
                disabled={quickPostSaving || quickPostSaved}
                className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center transition-all
                    ${quickPostSaved
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'}
                    disabled:opacity-70`}
              >
                {quickPostSaving ? (
                  <><Loader2 className="animate-spin mr-2" size={18} /> Salvando...</>
                ) : quickPostSaved ? (
                  <><CheckCircle2 className="mr-2" size={18} /> Salvo em Meus Produtos!</>
                ) : (
                  <><Save className="mr-2" size={18} /> Salvar em Meus Produtos</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && selectedProductForSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-purple-50">
              <div className="flex items-center space-x-2">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Agendar Envio</h2>
                  <p className="text-xs text-purple-700">WhatsApp Automático</p>
                </div>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <img src={selectedProductForSchedule.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{selectedProductForSchedule.title}</p>
                  <p className="text-sm text-emerald-600 font-semibold">{formatCurrency(selectedProductForSchedule.price)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Clock size={16} className="inline mr-1" /> Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Frequência</label>
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
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors font-medium"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <div className="flex items-center space-x-2">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Eye size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Template Salvo</h2>
                  <p className="text-xs text-emerald-700">Pronto para WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                <img src={previewProduct.image} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <div>
                  <p className="font-medium text-slate-900">{previewProduct.title}</p>
                  <p className="text-lg text-emerald-600 font-bold">{formatCurrency(previewProduct.price)}</p>
                </div>
              </div>
              <div className="bg-[#e5ddd5] p-4 rounded-lg">
                <div className="bg-white p-4 rounded-lg shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
                  {generateFromTemplateText(previewProduct)}
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
