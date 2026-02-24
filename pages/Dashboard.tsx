import React, { useEffect, useState } from 'react';
import { fetchStats, fetchProducts, fetchRecentDispatches } from '../services/mockService';
import { DashboardStats, Product, DispatchRecord } from '../types';
import {
  Package, Send, Loader2, TrendingUp, CheckCircle2, XCircle,
  Activity, Zap, ArrowUpRight, Clock, MessageCircle
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
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, products, dispatchData] = await Promise.all([
          fetchStats(),
          fetchProducts(),
          fetchRecentDispatches(10)
        ]);
        setStats(statsData);
        setRecentProducts(products.slice(0, 5));
        setDispatches(dispatchData);
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

        {/* Recent Products */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center gap-2 text-sm sm:text-base">
              <Package size={18} className="text-emerald-500" />
              Produtos Recentes
            </h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              {recentProducts.length} itens
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
            {recentProducts.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Package className="mx-auto mb-3 text-slate-300" size={36} />
                <p className="text-sm">Nenhum produto cadastrado</p>
              </div>
            ) : (
              recentProducts.map(product => (
                <div key={product.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[var(--color-bg-main)] transition-colors">
                  <img
                    src={product.image || 'https://via.placeholder.com/44'}
                    alt={product.title}
                    className="w-11 h-11 rounded-lg object-cover border border-[var(--color-border)] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-main)] truncate">{product.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] opacity-70">•</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{product.platform}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${product.active
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};