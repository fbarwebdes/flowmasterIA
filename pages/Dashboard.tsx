import React, { useEffect, useState } from 'react';
import { fetchStats, fetchProducts, fetchRecentDispatches, fetchAutomationConfig, fetchSchedules } from '../services/mockService';
import { getNextSends } from '../services/automationService';
import { DashboardStats, Product, DispatchRecord, AutomationConfig, Schedule } from '../types';
import {
  Package, Send, Loader2, TrendingUp, CheckCircle2, XCircle,
  Activity, Zap, ArrowUpRight, Clock, MessageCircle, Calendar,
  AlertTriangle
} from 'lucide-react';

// ── Stat Card ──
interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
}

const StatCard = ({ title, value, subtext, icon: Icon, accent, accentBg }: StatCardProps) => (
  <div className="bg-[var(--color-bg-card)] p-5 rounded-2xl border border-[var(--color-border)] hover:shadow-md transition-all duration-300 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentBg}`}>
        <Icon size={20} className={accent} />
      </div>
      <ArrowUpRight size={16} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-main)] tracking-tight">{value}</h3>
    <p className="text-sm text-[var(--color-text-muted)] mt-1">{title}</p>
    {subtext && <p className="text-xs text-[var(--color-text-muted)] mt-1 opacity-70">{subtext}</p>}
  </div>
);

// ── Main Dashboard ──
export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig | null>(null);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, prods, dispatchData, autoConfig, scheduleData] = await Promise.all([
          fetchStats(),
          fetchProducts(),
          fetchRecentDispatches(10),
          fetchAutomationConfig(),
          fetchSchedules()
        ]);
        setStats(statsData);
        setAllProducts(prods);
        setDispatches(dispatchData);
        setAutomationConfig(autoConfig);
        setAllSchedules(scheduleData);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-[var(--color-text-muted)] mt-3">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHrs < 24) return `${diffHrs}h atrás`;

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) =>
    price > 0 ? `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Dashboard</h1>
        <p className="text-[var(--color-text-muted)] mt-1 text-sm">Visão geral do FlowMasterIA</p>
      </div>

      {automationConfig?.shuffledProductIds && automationConfig.shuffledProductIds.length > 0 && (() => {
        const total = automationConfig.shuffledProductIds.length;
        const current = automationConfig.lastShuffleIndex || 0;
        const remaining = total - current;

        if (current >= total) {
          return (
            <div className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 border p-4 sm:p-5 rounded-2xl flex gap-4 items-start animate-fade-in">
              <AlertTriangle className="text-red-500 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="text-red-800 dark:text-red-400 font-bold text-sm sm:text-base">Atenção: Ciclo de Envios Finalizado!</h3>
                <p className="text-red-700 dark:text-red-300 text-xs sm:text-sm mt-1">Todos os produtos cadastrados já foram enviados em seus respectivos grupos. Para que a automação continue sem repetições, vá até a aba de Produtos, <b>exclua os atuais e faça uma nova importação</b>.</p>
              </div>
            </div>
          );
        }

        if (remaining <= 5) {
          return (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 border p-4 sm:p-5 rounded-2xl flex gap-4 items-start animate-fade-in">
              <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="text-amber-800 dark:text-amber-400 font-bold text-sm sm:text-base">Aviso: Produtos Acabando</h3>
                <p className="text-amber-700 dark:text-amber-300 text-xs sm:text-sm mt-1">Restam apenas <b>{remaining} produtos</b> para serem enviados neste ciclo. Prepare uma nova importação em breve para manter os clientes engajados.</p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total de Produtos"
          value={stats?.totalProducts || 0}
          subtext="Cadastrados"
          icon={Package}
          accent="text-emerald-600 dark:text-emerald-400"
          accentBg="bg-emerald-500/10"
        />
        <StatCard
          title="Produtos Ativos"
          value={stats?.activeProducts || 0}
          subtext="Prontos p/ divulgação"
          icon={TrendingUp}
          accent="text-blue-600 dark:text-blue-400"
          accentBg="bg-blue-500/10"
        />
        <StatCard
          title="Disparos Hoje"
          value={stats?.dispatchesToday || 0}
          subtext="Últimas 24h"
          icon={Send}
          accent="text-violet-600 dark:text-violet-400"
          accentBg="bg-violet-500/10"
        />
        <StatCard
          title="Total Enviados"
          value={stats?.totalDispatched || 0}
          subtext={`${stats?.successRate || 0}% de sucesso`}
          icon={Activity}
          accent="text-amber-600 dark:text-amber-400"
          accentBg="bg-amber-500/10"
        />
      </div>

      {/* Success Rate Bar */}
      {stats && stats.totalDispatched > 0 && (
        <div className="bg-[var(--color-bg-card)] p-4 sm:p-5 rounded-2xl border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-emerald-500" />
              <span className="text-sm font-medium text-[var(--color-text-main)]">Taxa de Sucesso</span>
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {stats.successRate}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000"
              style={{ width: `${stats.successRate}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {stats.totalDispatched} envios realizados · {stats.pendingSchedules} pendentes
          </p>
        </div>
      )}

      {/* Two-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Dispatches */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 text-sm sm:text-base">
              <MessageCircle size={18} className="text-violet-500" />
              Últimos Disparos
            </h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              {dispatches.length} recentes
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
            {dispatches.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Send className="mx-auto mb-3 text-slate-300" size={36} />
                <p className="text-sm">Nenhum disparo realizado</p>
              </div>
            ) : (
              dispatches.map(dispatch => (
                <div key={dispatch.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[var(--color-bg-main)] transition-colors">
                  {/* Product Image */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={dispatch.productImage || 'https://via.placeholder.com/44'}
                      alt={dispatch.productTitle}
                      className="w-11 h-11 rounded-lg object-cover border border-[var(--color-border)]"
                    />
                    {/* Status Indicator */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--color-bg-card)] ${dispatch.status === 'sent'
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                      }`}>
                      {dispatch.status === 'sent'
                        ? <CheckCircle2 size={12} className="text-white" />
                        : <XCircle size={12} className="text-white" />
                      }
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                      {dispatch.productTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {dispatch.productPrice > 0 && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatPrice(dispatch.productPrice)}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)] opacity-70">•</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {dispatch.productPlatform}
                      </span>
                    </div>
                  </div>

                  {/* Time + Status */}
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${dispatch.status === 'sent'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}>
                      {dispatch.status === 'sent' ? '✓ Enviado' : '✕ Falhou'}
                    </span>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1 flex items-center justify-end gap-1">
                      <Clock size={10} />
                      {formatTime(dispatch.scheduledTime)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Sends */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 text-sm sm:text-base">
              <Calendar size={18} className="text-emerald-500" />
              Próximos Envios
            </h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              Próximos 15
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
            {(() => {
              if (!automationConfig) return (
                <div className="p-8 text-center text-[var(--color-text-muted)]">
                  <Calendar className="mx-auto mb-3 text-slate-300" size={36} />
                  <p className="text-sm">Configurando envios...</p>
                </div>
              );

              const nextAutoSends = getNextSends(automationConfig, allProducts, 15);
              const now = new Date();

              // Get future manual schedules
              const futureManualSends = allSchedules
                .filter(s => s.status === 'pending' && new Date(s.scheduledTime) > now)
                .map(s => {
                  const product = allProducts.find(p => p.id === s.productId);
                  return {
                    time: new Date(s.scheduledTime),
                    product: product || { title: s.productTitle, image: s.productImage, platform: s.platform } as any,
                    isManual: true
                  };
                });

              // Merge and sort
              const unifiedSends = [
                ...nextAutoSends.map(s => ({ ...s, isManual: false })),
                ...futureManualSends
              ].sort((a, b) => a.time.getTime() - b.time.getTime())
                .slice(0, 15);

              if (unifiedSends.length === 0) {
                return (
                  <div className="p-8 text-center text-[var(--color-text-muted)]">
                    <Package className="mx-auto mb-3 text-slate-300" size={36} />
                    <p className="text-sm">Nenhum envio agendado</p>
                    <p className="text-xs opacity-70 mt-1">Verifique se há produtos ativos</p>
                  </div>
                );
              }

              return unifiedSends.map((send, idx) => {
                const isToday = send.time.toDateString() === new Date().toDateString();
                return (
                  <div key={idx} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[var(--color-bg-main)] transition-colors">
                    <img
                      src={send.product.image || 'https://via.placeholder.com/44'}
                      alt={send.product.title}
                      className="w-11 h-11 rounded-lg object-cover border border-[var(--color-border)] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-main)] truncate">{send.product.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {send.time.toLocaleString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {send.isManual && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold uppercase tracking-wider">
                            Manual
                          </span>
                        )}
                        {!send.isManual && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                            Auto
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${isToday
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                      <Clock size={10} />
                      {isToday ? 'Hoje' : send.time.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};