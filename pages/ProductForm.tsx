import React, { useState, useCallback } from 'react';
import { Upload, Link as LinkIcon, Save, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { extractFromImage, extractFromLink, saveProduct } from '../services/mockService';
import { Product } from '../types';

interface ProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ onSuccess, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'image' | 'link'>('image');
  const [isLoading, setIsLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  
  // Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Product['platform']>('Other');
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Simulate OCR
    setOcrStatus('processing');
    try {
      const data = await extractFromImage(file);
      setTitle(data.title);
      setPrice(data.price.toString());
      setOcrStatus('success');
    } catch (err) {
      setOcrStatus('error');
      setError("Falha ao extrair dados da imagem.");
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (activeTab !== 'image') return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
            setError(null);
            // Re-use upload logic for pasted image
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(blob);
            
            setOcrStatus('processing');
            const data = await extractFromImage(blob);
            setTitle(data.title);
            setPrice(data.price.toString());
            setOcrStatus('success');
        }
      }
    }
  }, [activeTab]);

  const handleLinkExtraction = async () => {
    setError(null);
    if (!affiliateLink) {
        setError("Por favor, insira um link primeiro.");
        return;
    }

    if (!validateUrl(affiliateLink)) {
        setError("Por favor, insira uma URL válida (ex: https://exemplo.com).");
        return;
    }

    setIsLoading(true);
    try {
      const data = await extractFromLink(affiliateLink);
      setTitle(data.title);
      setPrice(data.price.toString());
      setImagePreview(data.image);
      setPlatform(data.platform);
    } catch (err) {
        setError("Não foi possível buscar detalhes do produto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Required fields check
    if (!title.trim() || !price || !affiliateLink.trim()) {
        setError("Por favor, preencha todos os campos obrigatórios (Título, Preço, Link).");
        return;
    }

    // Price validation
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
        setError("O preço deve ser um número positivo.");
        return;
    }

    // URL Validation
    if (!validateUrl(affiliateLink)) {
        setError("Por favor, forneça uma URL de afiliado válida (incluindo http:// ou https://).");
        return;
    }

    setIsLoading(true);
    try {
      await saveProduct({
        title,
        price: priceNum,
        affiliate_link: affiliateLink,
        image: imagePreview || 'https://picsum.photos/200',
        platform,
        active: true
      });
      onSuccess();
    } catch (err) {
      setError("Falha ao salvar produto.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" onPaste={handlePaste}>
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Novo Produto</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <AlertCircle size={20} className="transform rotate-45" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
            activeTab === 'image' 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <ImageIcon size={18} />
            <span>Upload Imagem (OCR)</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('link')}
          className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
            activeTab === 'link' 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <LinkIcon size={18} />
            <span>Importar via Link</span>
          </div>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Input Source */}
        {activeTab === 'image' ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors relative group">
              {imagePreview ? (
                <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded shadow-sm" />
                    <button 
                        onClick={() => setImagePreview(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                    >
                        <AlertCircle size={16} />
                    </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <p className="mt-2 text-sm text-slate-600">Clique para upload ou arraste e solte</p>
                  <p className="text-xs text-slate-400">suporta PNG, JPG (Colar também funciona)</p>
                </>
              )}
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleImageUpload}
                accept="image/*"
                disabled={!!imagePreview}
              />
            </div>
            {ocrStatus === 'processing' && (
               <div className="flex items-center text-indigo-600 text-sm bg-indigo-50 p-3 rounded-lg animate-pulse">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Analisando imagem com IA...
               </div>
            )}
            {ocrStatus === 'success' && (
                <div className="flex items-center text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                   <CheckCircle2 className="mr-2 h-4 w-4" />
                   Dados extraídos com sucesso!
                </div>
            )}
          </div>
        ) : (
          <div className="flex space-x-2">
            <input 
              type="url" 
              placeholder="Cole o link do produto (ex: https://...)" 
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
            />
            <button 
              onClick={handleLinkExtraction}
              disabled={isLoading || !affiliateLink}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'Gerar'}
            </button>
          </div>
        )}

        {/* Step 2: Confirmation Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Título do Produto <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="ex: Fone de Ouvido Bluetooth"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preço <span className="text-red-500">*</span></label>
            <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">R$</span>
                <input 
                type="number" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plataforma</label>
            <select 
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Product['platform'])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="Shopee">Shopee</option>
              <option value="Amazon">Amazon</option>
              <option value="AliExpress">AliExpress</option>
              <option value="Other">Outro</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Link de Afiliado <span className="text-red-500">*</span></label>
            <input 
              type="url" 
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none ${
                !affiliateLink && activeTab === 'image' && ocrStatus === 'success' ? 'border-amber-300 bg-amber-50' : 'border-slate-300'
              }`}
              placeholder="https://..."
            />
            {!affiliateLink && activeTab === 'image' && ocrStatus === 'success' && (
                <p className="text-xs text-amber-600 mt-1">Não esqueça de adicionar seu link de afiliado!</p>
            )}
          </div>
        </div>
        
        {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
            </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center space-x-2"
          >
            {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
            <span>Salvar Produto</span>
          </button>
        </div>
      </div>
    </div>
  );
};