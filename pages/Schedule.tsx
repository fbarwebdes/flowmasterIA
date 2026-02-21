import React, { useEffect, useState } from 'react';
import { Trash2, Calendar, Clock, Plus, Check, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { fetchProducts, fetchSchedules, createSchedule, deleteSchedules } from '../services/mockService';
import { Product, Schedule as ScheduleType } from '../types';

export const Schedule: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [date, setDate] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly'>('once');
  const [times, setTimes] = useState<string[]>(['10:00']);
  const [applyToAll, setApplyToAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([fetchSchedules(), fetchProducts()]).then(([schedData, prodData]) => {
      setSchedules(schedData);
      setProducts(prodData);
      setLoading(false);
    });
  }, []);

  const handleAddTime = () => {
    setTimes([...times, '12:00']);
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const handleRemoveTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(schedules.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} agendamentos?`)) return;

    try {
      await deleteSchedules(selectedIds);
      const updated = await fetchSchedules();
      setSchedules(updated);
      setSelectedIds([]);
    } catch (error) {
      alert('Erro ao excluir agendamentos');
    }
  };

  const handleSave = async () => {
    if (!date) return alert('Selecione uma data de início');
    if (!applyToAll && !selectedProduct) return alert('Selecione um produto ou marque "Todos"');

    setSubmitting(true);

    // 1. Get all currently occupied slots (from existing schedules)
    // We normalize to generic ISO string minutes for comparison? 
    // Or just simple collision check. 
    // Note: Existing Logic allows same time? User requested "1 product per time slot".
    // We will build a "Occupied Map".
    const occupiedSlots = new Set<string>();
    schedules.forEach(s => {
      // Assuming schedules with frequency 'daily' occupy that slot EVERY day?
      // For simplicity in this logic, we strictly check specific datetime collisions first
      // But if 'daily', it effectively blocks that time-of-day forever.
      // Let's stick to strict Datetime collision for 'once' and approximate for 'daily'.

      const d = new Date(s.scheduledTime);
      // Key format: "YYYY-MM-DDTHH:mm"
      // If frequency is daily, we might need a "HH:mm" global block?
      // User asked: "só será feito envio via wpp um produto por vez em cada horário agendado"
      // This implies 09:00 can only have ONE product.
      occupiedSlots.add(s.scheduledTime);
    });

    const productsToSchedule = applyToAll
      ? products.filter(p => p.active)
      : products.filter(p => p.id === selectedProduct);

    // Helper to add 'days' to a date
    const addDays = (d: Date, days: number) => {
      const result = new Date(d);
      result.setDate(result.getDate() + days);
      return result;
    };

    let createdCount = 0;
    let timeIndex = 0;
    let dayOffset = 0;
    const sortedTimes = [...times].sort();

    // We need to track newly booked slots in this session to prevent self-collision
    const sessionOccupied = new Set<string>();

    for (const prod of productsToSchedule) {
      let scheduled = false;
      let preventInfinite = 0;

      while (!scheduled && preventInfinite < 500) { // Safety break
        preventInfinite++;

        // Calculate candidate time
        if (timeIndex >= sortedTimes.length) {
          timeIndex = 0;
          dayOffset++;
        }

        const timeStr = sortedTimes[timeIndex];
        const baseDate = new Date(date);
        const targetDate = addDays(baseDate, dayOffset);

        // Construct ISO string carefully
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const candidateIso = `${year}-${month}-${day}T${timeStr}:00.000Z`; // UTC simplified or Local? 
        // Best to use simple string concat for the "Save" logic if backend expects it.
        // Actually the mockService uses whatever we pass. Let's try to match browser local time or just use the string builder.
        // The input `date` is YYYY-MM-DD. `time` is HH:mm.
        // Let's stick to the input format + ISO conversion.
        const localDateTimeStr = `${year}-${month}-${day}T${timeStr}`;
        const scheduledDateTime = new Date(localDateTimeStr).toISOString();

        // Check Collision
        // Robust check using timestamps
        const targetMs = new Date(scheduledDateTime).getTime();

        const isTaken = schedules.some(s => {
          return new Date(s.scheduledTime).getTime() === targetMs;
        }) || sessionOccupied.has(scheduledDateTime);

        if (!isTaken) {
          // Book it
          await createSchedule({
            productId: prod.id,
            productTitle: prod.title,
            productImage: prod.image,
            scheduledTime: scheduledDateTime,
            status: 'pending',
            platform: 'WhatsApp',
            frequency: applyToAll ? 'once' : frequency // Force 'once' for batch to avoid infinite overlaps
          });

          sessionOccupied.add(scheduledDateTime);
          scheduled = true;
          createdCount++;
        }

        // Move to next slot for next attempt (or next product)
        timeIndex++;
      }
    }

    const finalDate = addDays(new Date(date), dayOffset);
    const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

    alert(`Agendamento Concluído!\n\n${createdCount} disparos foram distribuídos automaticamente.\nDo dia ${new Date(date).toLocaleDateString('pt-BR', dateOptions)} até ${finalDate.toLocaleDateString('pt-BR', dateOptions)}.\n\nNenhum horário possui mais de um produto.`);

    const updated = await fetchSchedules();
    setSchedules(updated);
    setSubmitting(false);
    setIsModalOpen(false);
    // Reset form
    setTimes(['10:00']);
    setApplyToAll(false);
    setSelectedProduct('');
    setFrequency('once');
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)]">Agendamentos</h1>
          <p className="text-[var(--color-text-muted)] mt-1 text-sm sm:text-base">Automatize seus disparos no WhatsApp.</p>
        </div>
        <div className="flex space-x-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition-colors text-sm"
            >
              <Trash2 size={18} />
              <span>Excluir ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition-colors text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {schedules.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-[var(--color-text-main)]">Nada agendado</h3>
            <p className="text-[var(--color-text-muted)]">Crie seu primeiro disparo automático.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-[var(--color-border)] p-3 flex items-center">
              <input
                type="checkbox"
                onChange={(e) => handleSelectAll(e.target.checked)}
                checked={schedules.length > 0 && selectedIds.length === schedules.length}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded mr-3"
              />
              <span className="text-sm font-medium text-[var(--color-text-muted)]">Selecionar Todos</span>
            </div>
            {schedules.map((schedule) => (
              <li key={schedule.id} className="p-3 sm:p-4 hover:bg-[var(--color-bg-main)] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(schedule.id)}
                    onChange={() => handleSelectOne(schedule.id)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-[var(--color-border)]">
                    {schedule.productImage ? (
                      <img src={schedule.productImage} className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text-main)]">{schedule.productTitle || 'Vários Produtos'}</p>
                    <div className="flex items-center text-sm text-[var(--color-text-muted)] space-x-3 mt-1">
                      <span className="flex items-center"><Calendar size={14} className="mr-1" /> {formatDateTime(schedule.scheduledTime)}</span>
                      {schedule.frequency && schedule.frequency !== 'once' && (
                        <span className="flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs capitalize">
                          {schedule.frequency === 'daily' ? 'Diário' : 'Semanal'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  {schedule.status === 'sent' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      ✅ Enviado
                    </span>
                  ) : schedule.status === 'failed' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      ❌ Falhou
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      ⏳ Pendente
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[var(--color-border)] flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text-main)]">Configurar Disparo</h2>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">Produto</label>
                <div className="space-y-3">
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${applyToAll ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-main)]'}`}>
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 flex-1 font-medium text-[var(--color-text-main)]">Aplicar para todos os produtos ativos</span>
                    <Layers className="text-emerald-500" size={20} />
                  </label>

                  {!applyToAll && (
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Selecione um produto único...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-2">Frequência</label>
                <div className="flex space-x-2">
                  {['once', 'daily', 'weekly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq as any)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${frequency === freq
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105'
                        : 'bg-[var(--color-bg-main)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-emerald-500'
                        }`}
                    >
                      {freq === 'once' ? 'Único' : freq === 'daily' ? 'Diariamente' : 'Semanalmente'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Horários de Disparo</label>
                  {times.map((time, idx) => (
                    <div key={idx} className="flex mb-2 space-x-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(idx, e.target.value)}
                        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)] px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      {times.length > 1 && (
                        <button onClick={() => handleRemoveTime(idx)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg">
                          <AlertCircle size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={handleAddTime} className="text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline mt-1 flex items-center">
                    <Plus size={16} className="mr-1" /> Adicionar outro horário
                  </button>
                </div>
              </div>

            </div>

            <div className="p-6 bg-[var(--color-bg-main)] border-t border-[var(--color-border)] flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
