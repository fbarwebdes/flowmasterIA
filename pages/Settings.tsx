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
    const [activeTab, setActiveTab] = useState<'general' | 'template'>('general');

    // Test states
    const [testLoading, setTestLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
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

    const validateWhatsApp = (num: string) => {
        const cleaned = num.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 15;
    };

    const handleSave = async () => {
        if (!settings) return;

        if (settings.whatsappNumber && !validateWhatsApp(settings.whatsappNumber)) {
            setErrorMsg('O número de WhatsApp parece estar incompleto ou no formato errado.');
            setActiveTab('general');
            return;
        }

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

    const handleTestWhatsApp = async () => {
        if (!settings?.whatsappNumber) {
            setErrorMsg('Preencha seu número de WhatsApp primeiro.');
            return;
        }

        if (!validateWhatsApp(settings.whatsappNumber)) {
            setErrorMsg('Formato inválido. Use DDI + DDD + Número (ex: 5511999998888).');
            return;
        }

        setTestLoading(true);
        setTestStatus('idle');
        setErrorMsg(null);

        try {
            const whatsappInt = settings.integrations?.find(i => i.id === 'whatsapp');
            if (!whatsappInt?.isEnabled || !whatsappInt?.credentials?.instanceId) {
                throw new Error('Certifique-se que a integração WhatsApp está ativada e configurada em "Integrações".');
            }

            const { instanceId, token, baseUrl } = whatsappInt.credentials;
            const res = await supabase.functions.invoke('send-whatsapp', {
                body: {
                    directTest: {
                        instanceId,
                        token,
                        baseUrl,
                        chatId: settings.whatsappNumber.replace(/\D/g, '') + '@c.us',
                        message: '✅ *FlowMasterIA: Mensagem de Teste Administrativa!*\n\nEste número foi configurado para receber alertas privados sobre ciclos de produtos e avisos de estoque.\n\n_Se você recebeu esta mensagem, significa que seu contato está configurado corretamente._'
                    }
                }
            });

            if (res.data?.success) {
                setTestStatus('success');
                setTimeout(() => setTestStatus('idle'), 5000);
            } else {
                throw new Error(res.data?.error || 'A API Green API retornou um erro.');
            }
        } catch (e: any) {
            console.error('Test error:', e);
            setErrorMsg(e.message);
            setTestStatus('error');
        } finally {
            setTestLoading(false);
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
                <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-6 py-4 text-sm font-semibold flex items-center space-x-2 transition-all ${activeTab === 'general' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <User size={18} /> <span>Geral</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`px-6 py-4 text-sm font-semibold flex items-center space-x-2 transition-all ${activeTab === 'template' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MessageSquare size={18} /> <span>Template de Vendas</span>
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'general' && (
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

                                <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
                                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Smartphone size={16} className="text-slate-600" />
                                                <label className="block text-sm font-bold text-slate-700">WhatsApp para Notificações (Privado)</label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Ex: 5511999998888"
                                                value={settings.whatsappNumber || ''}
                                                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm font-medium"
                                            />
                                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                                <Smartphone size={12} /> Digite DDI + DDD + Número. Este número receberá avisos administrativos.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleTestWhatsApp}
                                            disabled={testLoading}
                                            className={`h-[46px] px-6 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 whitespace-nowrap min-w-[170px] justify-center
                                                ${testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' :
                                                    testStatus === 'error' ? 'bg-red-50 text-red-600 border-red-300' :
                                                        'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm active:scale-95'}
                                            `}
                                        >
                                            {testLoading ? <Loader2 size={16} className="animate-spin" /> :
                                                testStatus === 'success' ? <CheckCircle2 size={16} /> :
                                                    testStatus === 'error' ? <AlertTriangle size={16} /> :
                                                        <Check size={16} />}
                                            {testLoading ? 'Enviando...' :
                                                testStatus === 'success' ? 'Teste Enviado!' :
                                                    testStatus === 'error' ? 'Falha no Teste' : 'Testar Conexão'}
                                        </button>
                                    </div>
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
                    )}

                    {activeTab === 'template' && (
                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-2xl p-5 text-indigo-100 shadow-lg shadow-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Smartphone size={18} className="text-emerald-400" />
                                    <p className="font-bold text-sm">Variáveis de Texto Inteligentes:</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {['{titulo}', '{preco}', '{preco_antigo}', '{link}', '{plataforma}', '{desconto}'].map(v => (
                                        <code key={v} className="bg-white/10 px-2 py-1 rounded text-[10px] font-mono border border-white/5">{v}</code>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700 font-mono">Template de Vendas (WhatsApp)</label>
                                <textarea
                                    rows={10}
                                    value={settings.salesTemplate}
                                    onChange={(e) => setSettings({ ...settings, salesTemplate: e.target.value })}
                                    className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm leading-relaxed"
                                    placeholder="Escreva seu template aqui..."
                                ></textarea>
                            </div>
                        </div>
                    )}

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
