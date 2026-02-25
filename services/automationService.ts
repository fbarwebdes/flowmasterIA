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
  const activeProds = products.filter(p => p.active);
  
  if (activeProds.length === 0) return [];
  
  let prodIdx = 0;

  for (let dayOffset = 0; dayOffset < 7 && sends.length < limit; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    if (!activeDayNums.includes(checkDate.getDay())) continue;

    let curMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    
    // If it's today, adjusted curMin to next valid interval
    if (dayOffset === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > curMin) {
        curMin = nowMin + (config.intervalMinutes - (nowMin % config.intervalMinutes));
      }
    }

    while (curMin < endMin && sends.length < limit) {
      const sendTime = new Date(checkDate);
      sendTime.setHours(Math.floor(curMin / 60), curMin % 60, 0, 0);
      sends.push({ time: sendTime, product: activeProds[prodIdx % activeProds.length] });
      prodIdx++;
      curMin += config.intervalMinutes;
    }
  }
  return sends;
};
