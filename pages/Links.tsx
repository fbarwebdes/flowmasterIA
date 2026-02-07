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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Links Afiliados</h1>
        <p className="text-slate-500 mt-1">Gerencie e monitore o desempenho dos seus links.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-500">Produto</th>
                <th className="px-6 py-4 font-medium text-slate-500">Link Encurtado</th>
                <th className="px-6 py-4 font-medium text-slate-500">Cliques</th>
                <th className="px-6 py-4 font-medium text-slate-500">Vendas</th>
                <th className="px-6 py-4 font-medium text-slate-500">Conversão (CTR)</th>
                <th className="px-6 py-4 font-medium text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={6} className="text-center py-10 text-slate-500">Carregando dados...</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex items-center space-x-3">
                      <img src={product.image} className="w-8 h-8 rounded bg-slate-100 object-cover" />
                      <span className="font-medium text-slate-900 truncate">{product.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-indigo-600 bg-indigo-50 px-2 py-1 rounded max-w-max">
                      <ExternalLink size={12} />
                      <span className="truncate max-w-[150px]">{product.affiliate_link}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    <div className="flex items-center">
                        <MousePointer2 size={14} className="mr-1 text-slate-400" />
                        {product.clicks || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">
                    {product.sales || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                        <TrendingUp size={14} className="mr-1 text-slate-400" />
                        {calculateCTR(product.clicks, product.sales)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                        onClick={() => copyToClipboard(product.affiliate_link)}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"
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
    </div>
  );
};
