import React, { useEffect, useState } from 'react';
import { fetchStats, fetchProducts, fetchSchedules } from '../services/mockService';
import { DashboardStats, Product, Schedule } from '../types';
import { Package, Calendar, Send, Clock, Loader2, Rocket, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  color: 'emerald' | 'blue' | 'purple' | 'orange';
}

const colorMap = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const StatCard = ({ title, value, subtext, icon: Icon, color }: StatCardProps) => (
  <div className="bg-[var(--color-bg-card)] p-4 sm:p-6 rounded-xl border border-[var(--color-border)] shadow-sm hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
        <h3 className="text-xl sm:text-3xl font-bold text-[var(--color-text-main)] mt-1 sm:mt-2 group-hover:scale-105 transition-transform origin-left">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon size={24} />
      </div>
    </div>
    {subtext && <p className="text-sm text-[var(--color-text-muted)] mt-3">{subtext}</p>}
  </div>
);

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [pendingSchedules, setPendingSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, products, schedules] = await Promise.all([
          fetchStats(),
          fetchProducts(),
          fetchSchedules()
        ]);
        setStats(statsData);
        setRecentProducts(products.slice(0, 5));
        setPendingSchedules(schedules.filter(s => s.status === 'pending').slice(0, 5));
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
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Dashboard</h1>
        <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Visão geral do FlowMasterIA</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Total de Produtos"
          value={stats?.totalProducts || 0}
          subtext="Cadastrados no sistema"
          icon={Package}
          color="emerald"
        />
        <StatCard
          title="Produtos Ativos"
          value={stats?.activeLinks || 0}
          subtext="Prontos para divulgação"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Agendamentos"
          value={stats?.lastShipment || '0 agendados'}
          subtext="Aguardando envio"
          icon={Calendar}
          color="purple"
        />
        <StatCard
          title="Posts Hoje"
          value={stats?.totalRevenue || 0}
          subtext="Enviados nas últimas 24h"
          icon={Send}
          color="orange"
        />
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Products */}
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center">
              <Package className="mr-2 text-emerald-500" size={20} />
              Produtos Recentes
            </h3>
            <span className="text-xs text-[var(--color-text-muted)]">{recentProducts.length} itens</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {recentProducts.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Rocket className="mx-auto mb-3 text-slate-300" size={40} />
                <p>Nenhum produto cadastrado</p>
                <p className="text-sm mt-1">Importe produtos na página Meus Produtos!</p>
              </div>
            ) : (
              recentProducts.map(product => (
                <div key={product.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-[var(--color-bg-main)] transition-colors">
                  <img
                    src={product.image || 'https://via.placeholder.com/50'}
                    alt={product.title}
                    className="w-12 h-12 rounded-lg object-cover border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text-main)] truncate">{product.title}</p>
                    <p className="text-sm text-emerald-600 font-semibold">
                      R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${product.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Schedules */}
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-main)] flex items-center">
              <Clock className="mr-2 text-purple-500" size={20} />
              Próximos Envios
            </h3>
            <span className="text-xs text-[var(--color-text-muted)]">{pendingSchedules.length} pendentes</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {pendingSchedules.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Calendar className="mx-auto mb-3 text-slate-300" size={40} />
                <p>Nenhum agendamento pendente</p>
                <p className="text-sm mt-1">Agende posts em Automação</p>
              </div>
            ) : (
              pendingSchedules.map(schedule => (
                <div key={schedule.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-[var(--color-bg-main)] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Send className="text-purple-600 dark:text-purple-400" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text-main)] truncate">{schedule.productTitle || 'Produto'}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{schedule.platform}</p>
                  </div>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {formatTime(schedule.scheduledTime)}
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