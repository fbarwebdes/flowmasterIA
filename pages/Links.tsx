import React, { useEffect, useState } from 'react';
import { fetchProducts } from '../services/mockService';
import { Product } from '../types';
import { ExternalLink, Copy, TrendingUp, MousePointer2 } from 'lucide-react';

export const Links: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts().then(data => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  const calculateCTR = (clicks: number = 0, sales: number = 0) => {
    if (clicks === 0) return '0.00%';
    return ((sales / clicks) * 100).toFixed(2) + '%';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Links Afiliados</h1>
        <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Gerencie e monitore o desempenho dos seus links.</p>
      </div>

      {/* Desktop Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-main)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Produto</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Link Encurtado</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Cliques</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Vendas</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)]">Conversão (CTR)</th>
                <th className="px-6 py-4 font-medium text-[var(--color-text-muted)] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-[var(--color-text-muted)]">Carregando dados...</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className="hover:bg-[var(--color-bg-main)]">
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex items-center space-x-3">
                      <img src={product.image} className="w-8 h-8 rounded bg-[var(--color-bg-main)] object-cover" />
                      <span className="font-medium text-[var(--color-text-main)] truncate">{product.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded max-w-max">
                      <ExternalLink size={12} />
                      <span className="truncate max-w-[150px]">{product.affiliate_link}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-[var(--color-text-main)]">
                    <div className="flex items-center">
                      <MousePointer2 size={14} className="mr-1 text-[var(--color-text-muted)]" />
                      {product.clicks || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">
                    {product.sales || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <TrendingUp size={14} className="mr-1 text-[var(--color-text-muted)]" />
                      {calculateCTR(product.clicks, product.sales)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => copyToClipboard(product.affiliate_link)}
                      className="text-[var(--color-text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      title="Copiar Link"
                    >
                      <Copy size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-muted)]">Carregando dados...</div>
        ) : products.map((product) => (
          <div key={product.id} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-3 space-y-2">
            <div className="flex items-center gap-3">
              <img src={product.image} className="w-10 h-10 rounded-lg bg-[var(--color-bg-main)] object-cover flex-shrink-0" />
              <p className="font-medium text-[var(--color-text-main)] text-sm line-clamp-2 flex-1">{product.title}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center"><MousePointer2 size={12} className="mr-1" />{product.clicks || 0} cliques</span>
                <span className="text-green-600 font-medium">{product.sales || 0} vendas</span>
                <span>{calculateCTR(product.clicks, product.sales)}</span>
              </div>
              <button
                onClick={() => copyToClipboard(product.affiliate_link)}
                className="text-[var(--color-text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title="Copiar Link"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
