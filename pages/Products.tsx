import React, { useEffect, useState } from 'react';
import { Product, AppSettings } from '../types';
import { fetchProducts, fetchSettings, updateProduct, importProductsFromIntegration, deleteProduct, deleteAllProducts, createSchedule } from '../services/mockService';
import { ProductForm } from './ProductForm';
import { Plus, Search, Filter, ExternalLink, Trash2, MessageCircle, Copy, Check, Wand2, X, Save, RefreshCw, Loader2, Calendar, Clock, Eye, Trash } from 'lucide-react';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('');

  // Copy Generation State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedProductForCopy, setSelectedProductForCopy] = useState<Product | null>(null);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
    const [prodData, settingsData] = await Promise.all([fetchProducts(), fetchSettings()]);
    setProducts(prodData);
    setSettings(settingsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductAdded = () => {
    setIsAdding(false);
    loadData(); // Reload list to see new item
  };

  const generateFromTemplate = (product: Product) => {
    if (!settings) return '';
    let text = settings.salesTemplate;
    text = text.replace('{titulo}', product.title);
    text = text.replace('{preco}', product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    // Mock old price logic (just add 20%)
    text = text.replace('{preco_antigo}', (product.price * 1.2).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    text = text.replace('{link}', product.affiliate_link);
    text = text.replace('{plataforma}', product.platform);
    return text;
  };

  const openCopyModal = (product: Product) => {
    setSelectedProductForCopy(product);
    if (product.salesCopy) {
      setGeneratedText(product.salesCopy);
    } else {
      setGeneratedText(generateFromTemplate(product));
    }
    setCopySuccess(false);
    setIsCopyModalOpen(true);
  };

  const handleAiGenerate = () => {
    setIsGenerating(true);
    // Simulate AI generation delay
    setTimeout(() => {
      if (!selectedProductForCopy) return;

      const baseText = generateFromTemplate(selectedProductForCopy);
      const intros = [
        "🚨 ATENÇÃO! OFERTA RELÂMPAGO! 🚨",
        "😱 VOCÊ NÃO VAI ACREDITAR NESSE PREÇO!",
        "🔥 SÓ HOJE: Oportunidade Única!",
        "✨ Chegou o que você esperava!"
      ];
      const outros = [
        "🏃‍♂️ Corra antes que acabe!",
        "📦 Últimas unidades em estoque!",
        "⏳ Promoção por tempo limitado!",
        "👉 Clique no link e garanta o seu!"
      ];

      const randomIntro = intros[Math.floor(Math.random() * intros.length)];
      const randomOutro = outros[Math.floor(Math.random() * outros.length)];

      const enhancedText = `${randomIntro}\n\n${baseText}\n\n${randomOutro}`;

      setGeneratedText(enhancedText);
      setIsGenerating(false);
    }, 1200);
  };

  const handleSaveCopy = async () => {
    if (!selectedProductForCopy) return;
    const updated = { ...selectedProductForCopy, salesCopy: generatedText };
    await updateProduct(updated);

    setProducts(products.map(p => p.id === updated.id ? updated : p));
    setIsCopyModalOpen(false);
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

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
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

  if (isAdding) {
    return (
      <div className="max-w-2xl mx-auto mt-6">
        <ProductForm onSuccess={handleProductAdded} onCancel={() => setIsAdding(false)} />
      </div>
    );
  }


  // Helper for PT-BR currency
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 mt-1">Gerencie seus links e itens de afiliado.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors font-medium"
          >
            <RefreshCw size={20} />
            <span>Importar Vendas</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Plus size={20} />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Platform Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todos', count: products.length },
          { id: 'Shopee', label: 'Shopee', count: products.filter(p => p.platform === 'Shopee').length },
          { id: 'Amazon', label: 'Amazon', count: products.filter(p => p.platform === 'Amazon').length },
          { id: 'Mercado Livre', label: 'Mercado Livre', count: products.filter(p => p.platform === 'Mercado Livre').length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPlatformFilter(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center space-x-2 ${platformFilter === tab.id
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
      <div className="flex space-x-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center space-x-2">
          <Filter size={18} />
          <span className="hidden sm:inline">Filtrar</span>
        </button>

        {/* Delete Selected Button */}
        {selectedProducts.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="px-4 py-2 border border-red-200 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 flex items-center space-x-2 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            <span className="hidden sm:inline">Excluir ({selectedProducts.size})</span>
          </button>
        )}

        {/* Delete All Button */}
        {filteredProducts.length > 0 && selectedProducts.size === 0 && (
          <button
            onClick={handleDeleteAllProducts}
            disabled={isDeleting}
            className="px-4 py-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash size={18} />}
            <span className="hidden sm:inline">Excluir Todos ({filteredProducts.length})</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-500 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th className="px-6 py-4 font-medium text-slate-500">Produto</th>
                <th className="px-6 py-4 font-medium text-slate-500">Plataforma</th>
                <th className="px-6 py-4 font-medium text-slate-500">Status</th>
                <th className="px-6 py-4 font-medium text-slate-500 text-right">Ações</th>
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
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <img
                          src={product.image}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                        />
                        <div>
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
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {product.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        {product.salesCopy && (
                          <button
                            onClick={() => openPreview(product)}
                            className="p-2 rounded-lg transition-colors bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            title="Ver Template Salvo"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => openScheduleModal(product)}
                          className="p-2 rounded-lg transition-colors bg-purple-50 text-purple-600 hover:bg-purple-100"
                          title="Agendar Envio"
                        >
                          <Calendar size={18} />
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

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Importar Produtos</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">Selecione a plataforma para buscar novos produtos usando suas credenciais configuradas.</p>

              <div className="space-y-3">
                {['shopee', 'amazon', 'mercadolivre'].map(p => {
                  const config = settings?.integrations?.find(i => i.id === p);
                  return (
                    <button
                      key={p}
                      onClick={() => handleImport(p)}
                      disabled={!config?.isEnabled || isImporting}
                      className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${!config?.isEnabled
                        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                    >
                      <span className="font-medium capitalize text-slate-700">{p}</span>
                      {isImporting ? <Loader2 className="animate-spin text-indigo-500" size={18} /> : (
                        !config?.isEnabled ? <span className="text-xs text-red-400">Não configurado</span> : <ExternalLink size={18} className="text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Copy Modal */}
      {isCopyModalOpen && selectedProductForCopy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <div className="flex items-center space-x-2">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Wand2 size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Gerar Copy Persuasiva</h2>
                  <p className="text-xs text-indigo-700">Otimizado para conversão no WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setIsCopyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Texto Gerado</label>
                <div className="relative">
                  <textarea
                    className="w-full h-64 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm bg-slate-50"
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                  />
                  {copySuccess && (
                    <div className="absolute top-4 right-4 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center shadow-sm">
                      <Check size={12} className="mr-1" /> Copiado!
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                  className="flex items-center space-x-2 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  <span>{isGenerating ? 'Gerando...' : 'Regenerar com IA'}</span>
                </button>
                <span className="text-xs text-slate-400">Edite livremente antes de salvar</span>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors flex items-center space-x-2 font-medium"
              >
                <Copy size={18} />
                <span>Copiar</span>
              </button>
              <button
                onClick={handleSaveCopy}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex items-center space-x-2 font-medium"
              >
                <Save size={18} />
                <span>Salvar Copy</span>
              </button>
            </div>
          </div>
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
      {
        isPreviewOpen && previewProduct && (
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
                    {previewProduct.salesCopy}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewProduct.salesCopy || '');
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
