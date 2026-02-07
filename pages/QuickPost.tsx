import React, { useState, useEffect } from 'react';
import { Rocket, Loader2, Copy, ExternalLink, CheckCircle2, AlertCircle, Image as ImageIcon, Save, Edit3 } from 'lucide-react';
import { extractFromLink, fetchSettings, saveProduct } from '../services/mockService';
import { AppSettings, Product } from '../types';

export const QuickPost: React.FC = () => {
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [productData, setProductData] = useState<{ title: string; price: number | null; image: string; platform: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editingPrice, setEditingPrice] = useState(false);
    const [manualPrice, setManualPrice] = useState('');

    useEffect(() => {
        fetchSettings().then(setSettings);
    }, []);

    const handleGenerate = async () => {
        if (!link) {
            setError('Por favor, cole um link.');
            return;
        }
        setError(null);
        setLoading(true);
        setProductData(null);

        try {
            const data = await extractFromLink(link);
            if (!data.title) {
                throw new Error('Não foi possível extrair dados deste link.');
            }
            setProductData(data);
            setManualPrice(data.price?.toString() || '');
            setEditingPrice(false);
        } catch (err: any) {
            setError(err.message || 'Falha ao buscar dados do produto.');
        } finally {
            setLoading(false);
        }
    };

    const getCurrentPrice = () => {
        if (manualPrice) {
            return parseFloat(manualPrice.replace(',', '.'));
        }
        return productData?.price || 0;
    };

    const generateMessage = () => {
        if (!productData || !settings) return '';
        const price = getCurrentPrice();
        return settings.salesTemplate
            .replace(/{titulo}/g, productData.title)
            .replace(/{preco}/g, price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---')
            .replace(/{preco_antigo}/g, (price ? (price * 1.3).toFixed(2) : '---'))
            .replace(/{link}/g, link);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateMessage());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenWhatsApp = () => {
        const msg = encodeURIComponent(generateMessage());
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    const handleSaveProduct = async () => {
        if (!productData) return;
        setSaving(true);
        try {
            await saveProduct({
                title: productData.title,
                price: getCurrentPrice(),
                image: productData.image,
                affiliate_link: link,
                platform: productData.platform as Product['platform'],
                active: true,
                salesCopy: generateMessage()
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError('Falha ao salvar produto.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-main)] flex items-center">
                    <Rocket className="mr-3 text-emerald-500" /> Quick Post
                </h1>
                <p className="text-[var(--color-text-muted)] mt-1">
                    Cole o link do produto e gere a mensagem para WhatsApp instantaneamente.
                </p>
            </div>

            {/* Input Area */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">
                    Link do Produto (Shopee, Amazon, Mercado Livre)
                </label>
                <div className="flex gap-3">
                    <input
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !link}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Rocket className="mr-2" size={20} />}
                        Gerar
                    </button>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center">
                        <AlertCircle size={16} className="mr-2" /> {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {productData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Product Preview */}
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-[var(--color-text-main)] mb-4 flex items-center">
                            <ImageIcon className="mr-2 text-blue-500" size={20} /> Dados do Produto
                        </h3>
                        <div className="flex gap-4">
                            {productData.image ? (
                                <img src={productData.image} alt="Produto" className="w-24 h-24 rounded-lg object-cover border" />
                            ) : (
                                <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                    <ImageIcon className="text-slate-400" size={32} />
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="font-medium text-[var(--color-text-main)] line-clamp-2">{productData.title}</p>
                                {/* Editable Price */}
                                <div className="mt-2 flex items-center gap-2">
                                    {editingPrice ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-emerald-600">R$</span>
                                            <input
                                                type="text"
                                                value={manualPrice}
                                                onChange={(e) => setManualPrice(e.target.value)}
                                                onBlur={() => setEditingPrice(false)}
                                                onKeyDown={(e) => e.key === 'Enter' && setEditingPrice(false)}
                                                autoFocus
                                                className="w-28 px-2 py-1 text-xl font-bold text-emerald-600 border border-emerald-500 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setEditingPrice(true)}
                                            className="text-2xl font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 group"
                                            title="Clique para editar o preço"
                                        >
                                            R$ {getCurrentPrice()?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                            <Edit3 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-amber-600 mt-1">⚠️ Clique no preço para corrigir se necessário</p>
                                <span className="inline-block mt-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-[var(--color-text-muted)]">
                                    {productData.platform}
                                </span>
                            </div>
                        </div>
                        {/* Save Button */}
                        <button
                            onClick={handleSaveProduct}
                            disabled={saving || saved}
                            className={`w-full mt-4 px-4 py-3 rounded-lg font-medium flex items-center justify-center transition-all
                                ${saved
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'}
                                disabled:opacity-70`}
                        >
                            {saving ? (
                                <><Loader2 className="animate-spin mr-2" size={18} /> Salvando...</>
                            ) : saved ? (
                                <><CheckCircle2 className="mr-2" size={18} /> Salvo em Meus Produtos!</>
                            ) : (
                                <><Save className="mr-2" size={18} /> Salvar em Meus Produtos</>
                            )}
                        </button>
                    </div>

                    {/* WhatsApp Preview */}
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-[var(--color-text-main)] mb-4 flex items-center">
                            <CheckCircle2 className="mr-2 text-green-500" size={20} /> Mensagem Pronta
                        </h3>
                        <div className="bg-[#e5ddd5] p-4 rounded-lg min-h-[150px]">
                            <div className="bg-white p-3 rounded-lg shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
                                {generateMessage()}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleCopy}
                                className="flex-1 bg-slate-100 dark:bg-slate-700 text-[var(--color-text-main)] px-4 py-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center font-medium"
                            >
                                {copied ? <CheckCircle2 className="mr-2 text-green-500" size={18} /> : <Copy className="mr-2" size={18} />}
                                {copied ? 'Copiado!' : 'Copiar Texto'}
                            </button>
                            <button
                                onClick={handleOpenWhatsApp}
                                className="flex-1 bg-green-500 text-white px-4 py-2.5 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center font-medium shadow-lg shadow-green-500/20"
                            >
                                <ExternalLink className="mr-2" size={18} /> Abrir WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
