import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Zap, Power, Save, Loader2, CheckCircle2, AlertCircle, XCircle, Package, Send } from 'lucide-react';
import { fetchAutomationConfig, saveAutomationConfig, fetchSchedules, fetchProducts, fetchSettings } from '../services/mockService';
import { ALL_DAYS } from '../services/automationService';
import { AutomationConfig, DayOfWeek, Schedule as ScheduleType, Product } from '../types';

const INTERVALS = [
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const defaultConfig: AutomationConfig = {
  isActive: false,
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  startHour: '08:00',
  endHour: '23:00',
  intervalMinutes: 30,
  lastShuffleIndex: 0,
  shuffledProductIds: [],
};

export const Schedule: React.FC = () => {
  const [config, setConfig] = useState<AutomationConfig>(defaultConfig);
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchAutomationConfig(), fetchSchedules(), fetchProducts()]).then(([autoConfig, schedData, prodData]) => {
      if (autoConfig) setConfig(autoConfig);
      setSchedules(schedData);
      setProducts(prodData);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveAutomationConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: DayOfWeek) => {
    setConfig(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const selectAllDays = () => {
    setConfig(prev => ({
      ...prev,
      days: prev.days.length === 7 ? [] : ALL_DAYS.map(d => d.key)
    }));
  };

  // Calculate sends per day
  const calculateSendsPerDay = () => {
    const [startH, startM] = config.startHour.split(':').map(Number);
    const [endH, endM] = config.endHour.split(':').map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes <= 0) return 0;
    return Math.floor(totalMinutes / config.intervalMinutes);
  };

  const sendsPerDay = calculateSendsPerDay();
  const sendsPerWeek = sendsPerDay * config.days.length;
  const activeProducts = products.filter(p => p.active).length;
  const daysToComplete = activeProducts > 0 ? Math.ceil(activeProducts / sendsPerDay) : 0;

  // Recent history (last 20)
  const recentSchedules = [...schedules]
    .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
    .slice(0, 20);

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Test send handler
  const handleTestSend = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const appSettings = await fetchSettings();
      const whatsappConfig = appSettings?.integrations?.find(i => i.id === 'whatsapp');
      if (!whatsappConfig?.isEnabled || !whatsappConfig?.credentials?.instanceId || !whatsappConfig?.credentials?.token) {
        setTestResult({ ok: false, message: 'Configure o WhatsApp em Integrações primeiro!' });
        return;
      }
      const { destinationChat, destinationChat2, destinationChat3 } = whatsappConfig.credentials;
      if (!destinationChat && !destinationChat2 && !destinationChat3) {
        setTestResult({ ok: false, message: 'Nenhum destino configurado nas Integrações!' });
        return;
      }
      const activeProds = products.filter(p => p.active);
      if (activeProds.length === 0) {
        setTestResult({ ok: false, message: 'Nenhum produto ativo cadastrado.' });
        return;
      }

      // Call Edge Function which handles Green API server-to-server (no CORS)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ test: true })
      });
      const data = await res.json();

      if (res.ok && data.results) {
        const sentResult = data.results.find((r: any) => r.status === 'sent');
        if (sentResult) {
          setTestResult({ ok: true, message: `✅ "${sentResult.product}" enviado para ${sentResult.chats} destino(s)! (${sentResult.index})` });
        } else {
          const reason = data.results[0]?.skipped || data.results[0]?.error || 'desconhecido';
          setTestResult({ ok: false, message: `Não enviou. Motivo: ${reason}` });
        }
      } else {
        setTestResult({ ok: false, message: data.error || 'Falha ao chamar função de envio.' });
      }
    } catch (err) {
      setTestResult({ ok: false, message: `Erro: ${err}` });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Cronograma Automático</h1>
          <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Configure e os envios acontecem sozinhos.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl shadow-sm text-sm font-semibold transition-all w-full sm:w-auto ${saved
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
            }`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
        </button>
      </div>

      {/* Cycle Completion Alert */}
      {config.shuffledProductIds && config.shuffledProductIds.length > 0 && config.lastShuffleIndex >= config.shuffledProductIds.length && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 text-amber-800 dark:text-amber-200 shadow-lg shadow-amber-100 dark:shadow-none animate-pulse">
          <div className="bg-amber-500 text-white p-3 rounded-xl">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="font-bold text-lg">Ciclagem Shopee Finalizada!</h4>
            <p className="text-sm opacity-90 mt-1">
              Todos os {config.shuffledProductIds.length} produtos do ciclo atual foram enviados.
              <strong> A automação está pausada</strong> para evitar repetições indesejadas.
              Importe novos produtos para iniciar uma nova rodada.
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'products' }))}
            className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
          >
            Importar agora
          </button>
        </div>
      )}

      {/* Master Toggle */}
      <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${config.isActive
        ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 shadow-lg shadow-emerald-100 dark:shadow-none'
        : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
        }`}>
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${config.isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
              }`}>
              <Power size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                {config.isActive ? '🟢 Automação Ativa' : '⚫ Automação Desligada'}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {config.isActive ? 'Enviando produtos via WhatsApp' : 'Clique para ativar os envios'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 flex-shrink-0 ${config.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${config.isActive ? 'left-9' : 'left-1'
              }`} />
          </button>
        </div>
      </div>

      {/* Config Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Days Selector */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-500" />
              <h3 className="font-semibold text-[var(--color-text-main)]">Dias de Envio</h3>
            </div>
            <button
              onClick={selectAllDays}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
            >
              {config.days.length === 7 ? 'Nenhum' : 'Todos'}
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {ALL_DAYS.map(day => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={`flex flex-col items-center justify-center py-3 rounded-xl text-xs font-bold transition-all border-2 ${config.days.includes(day.key)
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-100 dark:shadow-none'
                  : 'bg-slate-50 dark:bg-slate-800 text-[var(--color-text-muted)] border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
              >
                <span>{day.short}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-4 font-medium text-center">
            {config.days.length === 7 ? '📅 Todos os dias' : config.days.length === 0 ? '⚠️ Selecione ao menos um dia' : `${config.days.length} dia(s) selecionado(s)`}
          </p>
        </div>

        {/* Time Window */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--color-text-main)]">Janela de Atividade</h3>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1.5 ml-1">Início</label>
              <select
                value={config.startHour}
                onChange={(e) => setConfig(prev => ({ ...prev, startHour: e.target.value }))}
                className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold appearance-none"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="hidden sm:flex items-center justify-center pt-6">
              <span className="text-slate-400 font-bold">→</span>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1.5 ml-1">Fim</label>
              <select
                value={config.endHour}
                onChange={(e) => setConfig(prev => ({ ...prev, endHour: e.target.value }))}
                className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold appearance-none"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-5 font-medium text-center">
            {(() => {
              const [sH] = config.startHour.split(':').map(Number);
              const [eH] = config.endHour.split(':').map(Number);
              const hours = eH - sH;
              return hours > 0 ? `⏱️ ${hours}h de funcionamento` : '⚠️ Horário expirado';
            })()}
          </p>
        </div>
      </div>

      {/* Frequency */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-emerald-500" />
          <h3 className="font-semibold text-[var(--color-text-main)]">Frequência de Envio</h3>
        </div>
        <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-7 gap-2">
          {INTERVALS.map(interval => (
            <button
              key={interval.value}
              onClick={() => setConfig(prev => ({ ...prev, intervalMinutes: interval.value }))}
              className={`py-3 px-1 rounded-xl text-xs font-bold transition-all border-2 ${config.intervalMinutes === interval.value
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-100 dark:shadow-none'
                : 'bg-slate-50 dark:bg-slate-800 text-[var(--color-text-muted)] border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 text-center transition-transform hover:scale-[1.02]">
          <div className="text-3xl font-black text-emerald-600">{sendsPerDay}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mt-1">envios/dia</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 text-center transition-transform hover:scale-[1.02]">
          <div className="text-3xl font-black text-blue-600">{sendsPerWeek}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mt-1">envios/semana</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 text-center transition-transform hover:scale-[1.02]">
          <div className="text-3xl font-black text-purple-600">{activeProducts}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mt-1">ativos</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 text-center transition-transform hover:scale-[1.02]">
          <div className="text-3xl font-black text-amber-600">{daysToComplete}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mt-1">dias p/ total</div>
        </div>
      </div>

      {/* Test Send Button */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-xl overflow-hidden group">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-white text-center sm:text-left">
            <h3 className="font-bold text-xl flex items-center justify-center sm:justify-start gap-2">
              <Send size={22} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              Enviar Teste Agora
            </h3>
            <p className="text-indigo-100 text-sm mt-1.5 max-w-sm">Valide sua configuração enviando um product aleatório imediatamente.</p>
          </div>
          <button
            onClick={handleTestSend}
            disabled={sendingTest}
            className="bg-white text-indigo-700 font-extrabold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-base w-full sm:w-auto"
          >
            {sendingTest ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {sendingTest ? 'Enviando...' : 'Testar Agora!'}
          </button>
        </div>
        {testResult && (
          <div className={`px-6 py-4 text-sm font-bold flex items-center gap-3 ${testResult.ok ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}>
            {testResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
};
