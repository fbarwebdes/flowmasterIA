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

export const getNextSends = (config: AutomationConfig, products: Product[], limit: number = 15) => {
  if (!config.isActive || config.days.length === 0 || config.intervalMinutes === 0) return [];

  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const activeDayNums = config.days.map(d => dayMap[d]);
  const now = new Date();
  const [startH, startM] = config.startHour.split(':').map(Number);
  const [endH, endM] = config.endHour.split(':').map(Number);
  const sends: { time: Date; product: Product }[] = [];

  // Use shuffle list if available, otherwise fallback to simple rotation
  const shuffledIds = config.shuffledProductIds || [];
  let currentIndex = config.lastShuffleIndex || 0;
  const isStrictCycle = shuffledIds.length > 0;

  // If strict cycle and already finished, no upcoming sends
  if (isStrictCycle && currentIndex >= shuffledIds.length) return [];

  const getProduct = (idx: number) => {
    if (isStrictCycle) {
      if (idx >= shuffledIds.length) return null;
      const id = shuffledIds[idx];
      return products.find(p => p.id === id && p.active);
    }
    const activeProds = products.filter(p => p.active);
    if (activeProds.length === 0) return null;
    return activeProds[idx % activeProds.length];
  };

  let prodIdx = currentIndex;

  for (let dayOffset = 0; dayOffset < 7 && sends.length < limit; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    if (!activeDayNums.includes(checkDate.getDay())) continue;

    let curMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (dayOffset === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > curMin) {
        curMin = nowMin + (config.intervalMinutes - (nowMin % config.intervalMinutes));
      }
    }

    while (curMin < endMin && sends.length < limit) {
      const product = getProduct(prodIdx);
      if (!product) break; // Finished cycle or no products

      const sendTime = new Date(checkDate);
      sendTime.setHours(Math.floor(curMin / 60), curMin % 60, 0, 0);
      sends.push({ time: sendTime, product });

      prodIdx++;
      curMin += config.intervalMinutes;
    }

    if (isStrictCycle && prodIdx >= shuffledIds.length) break;
  }
  return sends;
};
