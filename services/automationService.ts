import { Product, AutomationConfig, DayOfWeek } from '../types';

export const ALL_DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda', short: 'Seg' },
  { key: 'tue', label: 'Terça', short: 'Ter' },
  { key: 'wed', label: 'Quarta', short: 'Qua' },
  { key: 'thu', label: 'Quinta', short: 'Qui' },
  { key: 'fri', label: 'Sexta', short: 'Sex' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
];

/**
 * Returns the current date/time in Brazil timezone (America/Sao_Paulo).
 * This matches the Edge Function's timezone logic.
 */
const getBrazilNow = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
};

export const getNextSends = (config: AutomationConfig, products: Product[], limit: number = 15, recentSentProductIds?: Set<string>) => {
  if (!config.isActive || config.days.length === 0 || config.intervalMinutes === 0) return [];

  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const activeDayNums = config.days.map(d => dayMap[d]);
  const brNow = getBrazilNow();
  const [startH, startM] = config.startHour.split(':').map(Number);
  const [endH, endM] = config.endHour.split(':').map(Number);
  const sends: { time: Date; product: Product }[] = [];
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // Use shuffle list if available, otherwise fallback to simple rotation
  const shuffledIds = config.shuffledProductIds || [];
  let currentIndex = config.lastShuffleIndex || 0;
  const isStrictCycle = shuffledIds.length > 0;

  // If strict cycle and already finished, no upcoming sends
  if (isStrictCycle && currentIndex >= shuffledIds.length) return [];

  const getProduct = (idx: number) => {
    const activeProds = products.filter(p => p.active);
    if (activeProds.length === 0) return null;

    if (isStrictCycle && idx < shuffledIds.length) {
      const id = shuffledIds[idx];
      const p = activeProds.find(p => p.id === id);
      if (p) return p;
    }

    // Fallback to rotation if strict cycle ends or product is missing
    return activeProds[idx % activeProds.length];
  };

  let prodIdx = currentIndex;

  for (let dayOffset = 0; dayOffset < 14 && sends.length < limit; dayOffset++) {
    const checkDate = new Date(brNow);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    if (!activeDayNums.includes(checkDate.getDay())) continue;

    // Calculate the first slot aligned to startHour
    let curMin = startMin;

    if (dayOffset === 0) {
      const nowMin = brNow.getHours() * 60 + brNow.getMinutes();
      if (nowMin >= endMin) continue; // Past end time for today, skip to next day
      if (nowMin > startMin) {
        // Snap to next interval aligned to startHour
        const elapsed = nowMin - startMin;
        const slotsPassed = Math.ceil(elapsed / config.intervalMinutes);
        curMin = startMin + slotsPassed * config.intervalMinutes;
      }
    }

    while (curMin < endMin && sends.length < limit) {
      let product = getProduct(prodIdx);

      // Smart Recovery: Skip missing or recently sent products in strict cycle
      if (isStrictCycle && !product) {
        let skipCount = 0;
        let candidateFound = false;

        while (!candidateFound && prodIdx < shuffledIds.length && skipCount < products.length + 50) {
          const candidateId = shuffledIds[prodIdx];
          const candidate = getProduct(prodIdx);

          if (!candidate) {
            prodIdx++;
            skipCount++;
            continue;
          }

          if (recentSentProductIds && recentSentProductIds.has(candidateId)) {
            prodIdx++;
            skipCount++;
            continue;
          }

          product = candidate;
          candidateFound = true;
        }
      }

      if (!product) break; // Reached end of cycle or no products available

      const sendTime = new Date(checkDate);
      sendTime.setHours(Math.floor(curMin / 60), curMin % 60, 0, 0);
      sends.push({ time: sendTime, product });

      prodIdx++;
      curMin += config.intervalMinutes;
    }
  }
  return sends;
};
