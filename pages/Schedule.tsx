import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Zap, Power, Save, Loader2, CheckCircle2, AlertCircle, XCircle, Package, BarChart3 } from 'lucide-react';
import { fetchAutomationConfig, saveAutomationConfig, fetchSchedules, fetchProducts } from '../services/mockService';
import { AutomationConfig, DayOfWeek, Schedule as ScheduleType, Product } from '../types';

const ALL_DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda', short: 'Seg' },
  { key: 'tue', label: 'Terça', short: 'Ter' },
  { key: 'wed', label: 'Quarta', short: 'Qua' },
  { key: 'thu', label: 'Quinta', short: 'Qui' },
  { key: 'fri', label: 'Sexta', short: 'Sex' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
];

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

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Cronograma Automático</h1>
          <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Configure e os envios acontecem sozinhos.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-sm text-sm font-medium transition-all ${saved
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
        </button>
      </div>

      {/* Master Toggle */}
      <div className={`rounded-xl border-2 transition-all duration-300 ${config.isActive
          ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 shadow-lg shadow-emerald-100 dark:shadow-none'
          : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
        }`}>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${config.isActive ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
              }`}>
              <Power size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                {config.isActive ? '🟢 Automação Ativa' : '⚫ Automação Desligada'}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {config.isActive ? 'Enviando produtos automaticamente via WhatsApp' : 'Clique para ativar os envios automáticos'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${config.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
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
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-500" />
              <h3 className="font-semibold text-[var(--color-text-main)]">Dias de Envio</h3>
            </div>
            <button
              onClick={selectAllDays}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
            >
              {config.days.length === 7 ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {ALL_DAYS.map(day => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={`py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${config.days.includes(day.key)
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <span className="hidden sm:inline">{day.short}</span>
                <span className="sm:hidden">{day.short.slice(0, 1)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
            {config.days.length === 7 ? '📅 Todos os dias' : config.days.length === 0 ? '⚠️ Nenhum dia selecionado' : `${config.days.length} dia${config.days.length > 1 ? 's' : ''} selecionado${config.days.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Time Window */}
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--color-text-main)]">Janela de Atividade</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Início</label>
              <select
                value={config.startHour}
                onChange={(e) => setConfig(prev => ({ ...prev, startHour: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <span className="text-[var(--color-text-muted)] mt-5 font-bold">→</span>
            <div className="flex-1">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Fim</label>
              <select
                value={config.endHour}
                onChange={(e) => setConfig(prev => ({ ...prev, endHour: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
            {(() => {
              const [sH] = config.startHour.split(':').map(Number);
              const [eH] = config.endHour.split(':').map(Number);
              const hours = eH - sH;
              return hours > 0 ? `⏱️ ${hours} horas de atividade` : '⚠️ Horário inválido';
            })()}
          </p>
        </div>
      </div>

      {/* Frequency */}
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-emerald-500" />
          <h3 className="font-semibold text-[var(--color-text-main)]">Frequência de Envio</h3>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {INTERVALS.map(interval => (
            <button
              key={interval.value}
              onClick={() => setConfig(prev => ({ ...prev, intervalMinutes: interval.value }))}
              className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${config.intervalMinutes === interval.value
                  ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{sendsPerDay}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">envios/dia</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{sendsPerWeek}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">envios/semana</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{activeProducts}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">produtos ativos</div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{daysToComplete}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">dias p/ rodar todos</div>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-500" />
          <h3 className="font-semibold text-[var(--color-text-main)]">Histórico de Envios</h3>
          <span className="ml-auto text-xs text-[var(--color-text-muted)] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
            Últimos {recentSchedules.length}
          </span>
        </div>

        {recentSchedules.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-[var(--color-text-main)]">Sem histórico</h3>
            <p className="text-[var(--color-text-muted)]">Os envios aparecerão aqui assim que a automação começar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
            {recentSchedules.map(schedule => (
              <li key={schedule.id} className="p-3 flex items-center gap-3 hover:bg-[var(--color-bg-main)] transition-colors">
                <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-[var(--color-border)] flex-shrink-0">
                  {schedule.productImage ? (
                    <img src={schedule.productImage} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-main)] truncate">{schedule.productTitle || 'Produto'}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(schedule.scheduledTime)}</p>
                </div>
                <div>
                  {schedule.status === 'sent' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <CheckCircle2 size={12} /> Enviado
                    </span>
                  ) : schedule.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      <XCircle size={12} /> Falhou
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <AlertCircle size={12} /> Pendente
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
