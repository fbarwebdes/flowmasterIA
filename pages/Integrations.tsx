import React, { useState, useEffect } from 'react';
import { ShoppingBag, Save, Key, AlertCircle, CheckCircle2, Shield, Loader2, Users, RefreshCw, Phone } from 'lucide-react';
import { fetchSettings, saveSettings } from '../services/mockService';
import { validateShopeeCredentials } from '../services/shopeeService';
import { AppSettings, IntegrationConfig, IntegrationId } from '../types';

export const Integrations: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<IntegrationId>('shopee');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [whatsappChats, setWhatsappChats] = useState<Array<{ id: string; name: string; isGroup: boolean }>>([]);
    const [loadingChats, setLoadingChats] = useState(false);
    const [manualPhone, setManualPhone] = useState('');
    const [chatSearchFilter, setChatSearchFilter] = useState('');

    useEffect(() => {
        fetchSettings().then(data => {
            setSettings(data);
            setLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        try {
            await saveSettings(settings);
            alert('Credenciais salvas com sucesso!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Erro ao salvar. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const updateIntegration = (id: IntegrationId, field: string, value: string) => {
        if (!settings) return;

        const currentIntegrations = settings.integrations || [];
        const index = currentIntegrations.findIndex(i => i.id === id);
        let newIntegrations = [...currentIntegrations];

        if (index >= 0) {
            newIntegrations[index] = {
                ...newIntegrations[index],
                credentials: {
                    ...newIntegrations[index].credentials,
                    [field]: value
                }
            };
        } else {
            newIntegrations.push({
                id,
                name: id.charAt(0).toUpperCase() + id.slice(1),
                isEnabled: true,
                credentials: { [field]: value }
            });
        }

        setSettings({ ...settings, integrations: newIntegrations });
    };

    const toggleIntegration = async (id: IntegrationId) => {
        if (!settings) return;
        const currentIntegrations = settings.integrations || [];
        const index = currentIntegrations.findIndex(i => i.id === id);
        let newIntegrations = [...currentIntegrations];

        if (index >= 0) {
            newIntegrations[index] = {
                ...newIntegrations[index],
                isEnabled: !newIntegrations[index].isEnabled
            };
        } else {
            newIntegrations.push({
                id,
                name: id.charAt(0).toUpperCase() + id.slice(1),
                isEnabled: true,
                credentials: {}
            });
        }
        const updatedSettings = { ...settings, integrations: newIntegrations };
        setSettings(updatedSettings);

        // Auto-save the toggle state immediately so it persists
        try {
            await saveSettings(updatedSettings);
        } catch (e) {
            console.error('Error auto-saving toggle state:', e);
        }
    };

    const getConfig = (id: IntegrationId) => {
        return settings?.integrations?.find(i => i.id === id) || { isEnabled: false, credentials: {} };
    };

    const handleTestConnection = async () => {
        if (!settings) return;
        const config = getConfig(activeTab);

        setTesting(true);
        setTestResult(null);

        try {
            if (activeTab === 'shopee') {
                // Shopee test
                if (!config.credentials.partnerId || !config.credentials.apiKey) {
                    setTestResult({ success: false, message: 'Preencha App ID e Senha antes de testar.' });
                    setTesting(false);
                    return;
                }
                const result = await validateShopeeCredentials(
                    config.credentials.partnerId,
                    config.credentials.apiKey
                );
                if (result.valid) {
                    setTestResult({ success: true, message: 'Conexão estabelecida com sucesso! API Ativa.' });
                } else {
                    setTestResult({
                        success: false,
                        message: result.message || 'Falha na conexão. Verifique suas credenciais.'
                    });
                }
            } else if (activeTab === 'whatsapp') {
                // Green API test via Edge Function (to avoid CORS)
                const { instanceId, token, destinationChat, destinationChat2, destinationChat3 } = config.credentials;
                if (!instanceId || !token) {
                    setTestResult({ success: false, message: 'Preencha o ID da Instância e Token antes de testar.' });
                    setTesting(false);
                    return;
                }

                const chats = [destinationChat, destinationChat2, destinationChat3].filter(Boolean);
                if (chats.length === 0) {
                    setTestResult({ success: false, message: 'Adicione pelo menos um destino de envio (número ou grupo) antes de testar.' });
                    setTesting(false);
                    return;
                }

                // Test with the first one
                const chatId = chats[0]!.includes('@') ? chats[0] : `${chats[0]}@c.us`;
                console.log('Testing WhatsApp connection...', { instanceId, chatId });

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                try {
                    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseKey}`
                        },
                        body: JSON.stringify({
                            directTest: {
                                instanceId,
                                token,
                                baseUrl: config.credentials.baseUrl,
                                chatId,
                                message: '✅ Conexão Green API testada com sucesso via FlowMasterIA!'
                            }
                        })
                    });

                    const data = await response.json();
                    console.log('Test result:', data);

                    if (response.ok && data.success) {
                        setTestResult({ success: true, message: `Mensagem de teste enviada com sucesso para ${chatId.split('@')[0]}!` });
                    } else {
                        const errorMsg = data.error || data.data?.message || `API Error ${response.status}`;
                        setTestResult({
                            success: false,
                            message: `Erro da API: ${errorMsg}. Verifique no painel Green API se a cota foi atingida.`
                        });
                    }
                } catch (fetchErr: any) {
                    console.error('Fetch error during test:', fetchErr);
                    setTestResult({ success: false, message: `Erro de rede ao testar: ${fetchErr.message}` });
                }
            }
        } catch (error) {
            setTestResult({ success: false, message: 'Erro ao testar a conexão. Verifique sua internet.' });
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" /></div>;

    const platforms = [
        { id: 'shopee', name: 'Shopee', color: 'orange' },
        { id: 'whatsapp', name: 'WhatsApp API', color: 'green' }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Integrações</h1>
                <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Configure suas chaves de API para importação e disparos.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1 flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto pb-1 lg:pb-0">
                    {platforms.map(p => {
                        const config = getConfig(p.id as IntegrationId);
                        return (
                            <button
                                key={p.id}
                                onClick={() => setActiveTab(p.id as IntegrationId)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === p.id
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium ring-1 ring-emerald-500/20'
                                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-main)]'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <ShoppingBag size={18} />
                                    <span>{p.name}</span>
                                </div>
                                {config.isEnabled && <CheckCircle2 size={16} className="text-emerald-500" />}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="lg:col-span-3">
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <ShoppingBag className="text-emerald-600 dark:text-emerald-400" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--color-text-main)]">Configuração {platforms.find(p => p.id === activeTab)?.name}</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {activeTab === 'shopee' ? 'Conecte sua conta de afiliado' : 'Conecte sua API de envio'}
                                    </p>
                                </div>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={getConfig(activeTab).isEnabled}
                                    onChange={() => toggleIntegration(activeTab)}
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        {getConfig(activeTab).isEnabled ? (
                            <form onSubmit={handleSave} className="space-y-4">
                                {activeTab === 'shopee' ? (
                                    <>
                                        {/* Shopee-specific fields */}
                                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-orange-800 dark:text-orange-300">
                                                <strong>Shopee Affiliate API:</strong> Obtenha suas credenciais em{' '}
                                                <a href="https://affiliate.shopee.com.br/open-account-api" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-600">
                                                    affiliate.shopee.com.br
                                                </a>
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">App ID</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={18} />
                                                <input
                                                    type="text"
                                                    value={getConfig(activeTab).credentials.partnerId || ''}
                                                    onChange={(e) => updateIntegration(activeTab, 'partnerId', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                    placeholder="Ex: 18363940496"
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Número de 11 dígitos do seu painel Shopee</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Senha (API Secret)</label>
                                            <div className="relative">
                                                <Shield className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={18} />
                                                <input
                                                    type="password"
                                                    value={getConfig(activeTab).credentials.apiKey || ''}
                                                    onChange={(e) => updateIntegration(activeTab, 'apiKey', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                    placeholder="BEGH5AO4XL7FA3YF2..."
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Chave secreta gerada no painel Shopee</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* WhatsApp Green API fields */}
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-emerald-800 dark:text-emerald-300">
                                                <strong>Green API (Gratuito):</strong> Conecte seu WhatsApp via{' '}
                                                <a href="https://console.green-api.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-600">
                                                    console.green-api.com
                                                </a>
                                                {' '}— plano Developer (free).
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">ID da Instância (idInstance)</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={18} />
                                                <input
                                                    type="text"
                                                    value={getConfig(activeTab).credentials.instanceId || ''}
                                                    onChange={(e) => updateIntegration(activeTab, 'instanceId', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                    placeholder="Ex: 7103524545"
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">idInstance do seu painel Green API</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">API URL (Opcional)</label>
                                            <div className="relative">
                                                <RefreshCw className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={18} />
                                                <input
                                                    type="text"
                                                    value={getConfig(activeTab).credentials.baseUrl || ''}
                                                    onChange={(e) => updateIntegration(activeTab, 'baseUrl', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                    placeholder="https://7103.api.greenapi.com"
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Copia o 'apiUrl' do seu painel se for diferente do padrão</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Token (apiTokenInstance)</label>
                                            <div className="relative">
                                                <Shield className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={18} />
                                                <input
                                                    type="password"
                                                    value={getConfig(activeTab).credentials.token || ''}
                                                    onChange={(e) => updateIntegration(activeTab, 'token', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                    placeholder="Seu Token da Green API"
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">apiTokenInstance do seu painel Green API</p>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium text-[var(--color-text-main)]">Destinos de Envio (até 3)</label>
                                                <button
                                                    type="button"
                                                    disabled={loadingChats || !getConfig(activeTab).credentials.instanceId || !getConfig(activeTab).credentials.token}
                                                    onClick={async () => {
                                                        const config = getConfig(activeTab);
                                                        const { instanceId, token } = config.credentials;
                                                        if (!instanceId || !token) return;
                                                        setLoadingChats(true);
                                                        try {
                                                            const res = await fetch(`https://api.green-api.com/waInstance${instanceId}/getContacts/${token}`);
                                                            const contacts = await res.json();
                                                            const chats = (contacts || []).filter((c: any) => c.name && c.name !== '').map((c: any) => ({
                                                                id: c.id,
                                                                name: c.name || c.id,
                                                                isGroup: c.id.endsWith('@g.us')
                                                            }));
                                                            // Sort: groups first, then contacts
                                                            chats.sort((a: any, b: any) => {
                                                                if (a.isGroup && !b.isGroup) return -1;
                                                                if (!a.isGroup && b.isGroup) return 1;
                                                                return a.name.localeCompare(b.name);
                                                            });
                                                            setWhatsappChats(chats);
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert('Erro ao buscar grupos. Verifique se o ID e Token estão corretos e o WhatsApp está conectado.');
                                                        } finally {
                                                            setLoadingChats(false);
                                                        }
                                                    }}
                                                    className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {loadingChats ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Buscar Grupos e Contatos
                                                </button>
                                            </div>

                                            {/* Selected chats display */}
                                            {(() => {
                                                const creds = getConfig(activeTab).credentials;
                                                const selected = [creds.destinationChat, creds.destinationChat2, creds.destinationChat3].filter(Boolean);
                                                if (selected.length === 0) return (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                                                        ⚠️ Nenhum destino selecionado. Adicione um número ou busque grupos/contatos abaixo.
                                                    </p>
                                                );
                                                return (
                                                    <div className="space-y-1.5 mb-3">
                                                        {selected.map((chatId, i) => {
                                                            const found = whatsappChats.find(c => c.id === chatId);
                                                            const name = found?.name || chatId;
                                                            const isGroup = chatId!.endsWith('@g.us');
                                                            return (
                                                                <div key={i} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-200 dark:bg-emerald-800 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                                                                        {isGroup ? <Users size={14} className="text-emerald-600" /> : <Phone size={14} className="text-blue-600" />}
                                                                        <span className="text-[var(--color-text-main)] font-medium truncate max-w-[200px]">{name}</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const keys = ['destinationChat', 'destinationChat2', 'destinationChat3'] as const;
                                                                            updateIntegration(activeTab, keys[i], '');
                                                                        }}
                                                                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                                    >
                                                                        Remover
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {/* Manual phone number input */}
                                            {(() => {
                                                const creds = getConfig(activeTab).credentials;
                                                const selectedCount = [creds.destinationChat, creds.destinationChat2, creds.destinationChat3].filter(Boolean).length;
                                                return (
                                                    <div className="mb-3">
                                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Adicionar número manualmente</label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <Phone size={14} className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                                                                <input
                                                                    type="tel"
                                                                    value={manualPhone}
                                                                    onChange={(e) => setManualPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                                                    placeholder="5522999787535"
                                                                    disabled={selectedCount >= 3}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={!manualPhone || manualPhone.length < 10 || selectedCount >= 3}
                                                                onClick={() => {
                                                                    const chatId = `${manualPhone}@c.us`;
                                                                    const creds2 = getConfig(activeTab).credentials;
                                                                    if (!creds2.destinationChat) updateIntegration(activeTab, 'destinationChat', chatId);
                                                                    else if (!creds2.destinationChat2) updateIntegration(activeTab, 'destinationChat2', chatId);
                                                                    else if (!creds2.destinationChat3) updateIntegration(activeTab, 'destinationChat3', chatId);
                                                                    setManualPhone('');
                                                                }}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                            >
                                                                <Phone size={14} />
                                                                Adicionar
                                                            </button>
                                                        </div>
                                                        {selectedCount >= 3 && (
                                                            <p className="text-[10px] text-amber-500 mt-1">Limite de 3 destinos atingido. Remova um para adicionar outro.</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Search filter + Group/Contact picker list */}
                                            {whatsappChats.length > 0 && (
                                                <>
                                                    <div className="mb-2">
                                                        <input
                                                            type="text"
                                                            value={chatSearchFilter}
                                                            onChange={(e) => setChatSearchFilter(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                                            placeholder="🔍 Filtrar grupos e contatos..."
                                                        />
                                                    </div>
                                                    <div className="border border-[var(--color-border)] rounded-lg max-h-60 overflow-y-auto">
                                                        {whatsappChats.filter(chat => !chatSearchFilter || chat.name.toLowerCase().includes(chatSearchFilter.toLowerCase())).map((chat) => {
                                                            const creds = getConfig(activeTab).credentials;
                                                            const selectedChats = [creds.destinationChat, creds.destinationChat2, creds.destinationChat3];
                                                            const isSelected = selectedChats.includes(chat.id);
                                                            const selectedCount = selectedChats.filter(Boolean).length;

                                                            return (
                                                                <button
                                                                    key={chat.id}
                                                                    type="button"
                                                                    disabled={!isSelected && selectedCount >= 3}
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            // Deselect
                                                                            if (creds.destinationChat === chat.id) updateIntegration(activeTab, 'destinationChat', '');
                                                                            else if (creds.destinationChat2 === chat.id) updateIntegration(activeTab, 'destinationChat2', '');
                                                                            else if (creds.destinationChat3 === chat.id) updateIntegration(activeTab, 'destinationChat3', '');
                                                                        } else {
                                                                            // Select in next empty slot
                                                                            if (!creds.destinationChat) updateIntegration(activeTab, 'destinationChat', chat.id);
                                                                            else if (!creds.destinationChat2) updateIntegration(activeTab, 'destinationChat2', chat.id);
                                                                            else if (!creds.destinationChat3) updateIntegration(activeTab, 'destinationChat3', chat.id);
                                                                        }
                                                                    }}
                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-[var(--color-border)] last:border-b-0 transition-colors ${isSelected
                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
                                                                        : selectedCount >= 3
                                                                            ? 'opacity-40 cursor-not-allowed bg-[var(--color-bg-main)]'
                                                                            : 'hover:bg-[var(--color-bg-main)] text-[var(--color-text-main)]'
                                                                        }`}
                                                                >
                                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                                                                        }`}>
                                                                        {isSelected && <CheckCircle2 size={12} />}
                                                                    </div>
                                                                    {chat.isGroup ? <Users size={16} className="text-emerald-500 flex-shrink-0" /> : <Phone size={16} className="text-blue-500 flex-shrink-0" />}
                                                                    <span className="truncate">{chat.name}</span>
                                                                    <span className="text-[10px] text-[var(--color-text-muted)] ml-auto flex-shrink-0">{chat.isGroup ? 'Grupo' : 'Contato'}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>)}
                                        </div>
                                    </>
                                )}

                                <div className="pt-4 flex justify-between items-center">
                                    {testResult && (
                                        <div className={`flex items-center text-sm ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {testResult.success ? (
                                                <CheckCircle2 size={18} className="mr-2" />
                                            ) : (
                                                <AlertCircle size={18} className="mr-2" />
                                            )}
                                            {testResult.message}
                                        </div>
                                    )}
                                    <div className="flex space-x-3 ml-auto">
                                        {(activeTab === 'shopee' || activeTab === 'whatsapp') && (
                                            <button
                                                type="button"
                                                onClick={handleTestConnection}
                                                disabled={testing || saving}
                                                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-4 py-2.5 rounded-lg transition-colors flex items-center disabled:opacity-70"
                                            >
                                                {testing ? <Loader2 className="animate-spin mr-2" size={18} /> : <Shield className="mr-2" size={18} />}
                                                {activeTab === 'whatsapp' ? 'Enviar Teste' : 'Testar Conexão'}
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={saving || testing}
                                            className={`${activeTab === 'shopee' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'} text-white px-6 py-2.5 rounded-lg transition-colors flex items-center shadow-lg disabled:opacity-70`}
                                        >
                                            {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                                            Salvar Credenciais
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="text-center py-12 bg-[var(--color-bg-main)] rounded-lg border border-dashed border-[var(--color-border)]">
                                <AlertCircle className="mx-auto h-12 w-12 text-[var(--color-text-muted)] opacity-50 mb-3" />
                                <h3 className="text-lg font-medium text-[var(--color-text-main)]">Integração Desativada</h3>
                                <p className="text-[var(--color-text-muted)]">Ative a chave acima para configurar as credenciais.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const UserIcon = ({ className, size }: { className?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);
