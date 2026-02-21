import React, { useState, useEffect } from 'react';
import { Save, Plus, MessageSquare, Loader2, Wand2 } from 'lucide-react';
import { fetchSettings, saveSettings } from '../services/mockService';
import { AppSettings } from '../types';

export const SalesTemplates: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [template, setTemplate] = useState('');

    useEffect(() => {
        fetchSettings().then(data => {
            setSettings(data);
            setTemplate(data.salesTemplate);
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        await saveSettings({ ...settings, salesTemplate: template });
        setSaving(false);
    };

    const insertVariable = (variable: string) => {
        setTemplate(prev => prev + ` {${variable}}`);
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Templates de Venda</h1>
                <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Configure o modelo de mensagem para o WhatsApp.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center">
                                <MessageSquare className="mr-2 text-emerald-500" size={20} />
                                Editor de Mensagem
                            </h3>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors flex items-center shadow-lg shadow-emerald-500/20 disabled:opacity-70"
                            >
                                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                                Salvar Template
                            </button>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                            {[
                                { label: 'Nome do Produto', var: 'titulo' },
                                { label: 'Preço', var: 'preco' },
                                { label: 'Preço Antigo', var: 'preco_antigo' },
                                { label: 'Link de Compra', var: 'link' }
                            ].map(v => (
                                <button
                                    key={v.var}
                                    onClick={() => insertVariable(v.var)}
                                    className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center"
                                >
                                    <Plus size={12} className="mr-1" />
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="w-full h-64 sm:h-96 p-3 sm:p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                            placeholder="Digite sua mensagem aqui..."
                        />
                    </div>
                </div>

                <div>
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm sticky top-24">
                        <h3 className="font-semibold text-[var(--color-text-main)] mb-4 flex items-center">
                            <Wand2 className="mr-2 text-purple-500" size={20} />
                            Pré-visualização
                        </h3>
                        <div className="bg-[#e5ddd5] p-4 rounded-lg min-h-[300px] relative">
                            <div className="bg-white p-3 rounded-lg shadow-sm text-sm text-gray-800 whitespace-pre-wrap relative max-w-[90%] before:content-[''] before:absolute before:top-0 before:-left-2 before:w-0 before:h-0 before:border-[8px] before:border-transparent before:border-t-white before:border-r-white">
                                {template
                                    .replace(/{titulo}/g, 'Fone de Ouvido Bluetooth')
                                    .replace(/{preco}/g, '299,90')
                                    .replace(/{preco_antigo}/g, '450,00')
                                    .replace(/{link}/g, 'https://shopee.com/...')
                                }
                                <div className="absolute bottom-1 right-2 text-[10px] text-gray-500 flex items-center">
                                    10:45 <span className="ml-1 text-blue-400">✓✓</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">Simulação de como o cliente verá no WhatsApp</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
