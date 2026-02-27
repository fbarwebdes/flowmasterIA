import React, { useEffect, useState } from 'react';
import { Save, User, Bell, MessageSquare, Loader2, Smartphone, CheckCircle2, AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { fetchSettings, saveSettings } from '../services/mockService';
import { supabase } from '../services/supabase';
import { AppSettings } from '../types';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

        setErrorMsg(null);
        setSaving(true);
        try {
            await saveSettings(settings);
            // Show brief success alert ideally
        } catch (e: any) {
            setErrorMsg('Erro ao salvar: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                    Configurações
                </h1>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">Gerencie seu perfil e templates de envio.</p>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-shake">
                    <AlertTriangle size={18} />
                    <span className="text-sm font-medium">{errorMsg}</span>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">Nome de Exibição</label>
                                <input
                                    type="text"
                                    placeholder="Seu nome"
                                    value={settings.displayName || ''}
                                    onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">E-mail</label>
                                <input type="email" value={userEmail} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none text-slate-400 text-sm italic" />
                            </div>

                        </div>

                        <div className="flex items-center justify-between py-6 border-t border-slate-100">
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm sm:text-base">Resposta Automática</h4>
                                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Responder automaticamente quando alguém interagir com o bot.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.autoReply}
                                    onChange={(e) => setSettings({ ...settings, autoReply: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                            </label>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-900 text-white px-10 py-3.5 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center font-bold shadow-lg shadow-slate-200 disabled:opacity-50 active:scale-95 min-w-[200px]"
                        >
                            {saving ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <Save size={18} className="mr-2" />}
                            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
