import React, { useEffect, useState } from 'react';
import { Save, User, Bell, MessageSquare, Loader2 } from 'lucide-react';
import { fetchSettings, saveSettings } from '../services/mockService';
import { supabase } from '../services/supabase';
import { AppSettings } from '../types';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'template'>('general');

    useEffect(() => {
        const loadData = async () => {
            const [settingsData, { data: { user } }] = await Promise.all([
                fetchSettings(),
                supabase.auth.getUser()
            ]);

            setSettings(settingsData);
            if (user) setUserEmail(user.email || '');
            setLoading(false);
        };
        loadData();
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        await saveSettings(settings);
        setSaving(false);
        // Toast success here ideally
    };

    if (loading || !settings) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Configurações</h1>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">Gerencie seu perfil e templates de envio.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-6 py-4 text-sm font-medium flex items-center space-x-2 ${activeTab === 'general' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <User size={18} /> <span>Geral</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`px-6 py-4 text-sm font-medium flex items-center space-x-2 ${activeTab === 'template' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <MessageSquare size={18} /> <span>Template de Vendas</span>
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome de Exibição</label>
                                    <input
                                        type="text"
                                        value={settings.displayName || ''}
                                        onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                                    <input type="email" value={userEmail} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Principal</label>
                                    <input
                                        type="text"
                                        value={settings.whatsappNumber}
                                        onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4 border-t border-slate-100">
                                <div>
                                    <h4 className="font-medium text-slate-900">Resposta Automática</h4>
                                    <p className="text-sm text-slate-500">Responder automaticamente quando alguém interagir com o bot.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.autoReply}
                                        onChange={(e) => setSettings({ ...settings, autoReply: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'template' && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <p className="font-bold mb-1">Variáveis Disponíveis:</p>
                                <p>{`{titulo}, {preco}, {preco_antigo}, {link}, {plataforma}`}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Texto Padrão para WhatsApp</label>
                                <textarea
                                    rows={8}
                                    value={settings.salesTemplate}
                                    onChange={(e) => setSettings({ ...settings, salesTemplate: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                ></textarea>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center disabled:opacity-70"
                        >
                            {saving && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                            <span>Salvar Alterações</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
