export interface DaySchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  dayName: string;
  shortName: string;
  isOpen: boolean;
  openTime: string; // "HH:MM" e.g. "06:00"
  closeTime: string; // "HH:MM" e.g. "20:00"
  hasBreak?: boolean;
  breakStart?: string;
  breakEnd?: string;
}

export const DEFAULT_WEEKLY_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: 0, dayName: 'Domingo', shortName: 'Dom', isOpen: true, openTime: '07:00', closeTime: '13:00' },
  { dayOfWeek: 1, dayName: 'Segunda-feira', shortName: 'Seg', isOpen: true, openTime: '06:00', closeTime: '20:00' },
  { dayOfWeek: 2, dayName: 'Terça-feira', shortName: 'Ter', isOpen: true, openTime: '06:00', closeTime: '20:00' },
  { dayOfWeek: 3, dayName: 'Quarta-feira', shortName: 'Qua', isOpen: true, openTime: '06:00', closeTime: '20:00' },
  { dayOfWeek: 4, dayName: 'Quinta-feira', shortName: 'Qui', isOpen: true, openTime: '06:00', closeTime: '20:00' },
  { dayOfWeek: 5, dayName: 'Sexta-feira', shortName: 'Sex', isOpen: true, openTime: '06:00', closeTime: '20:00' },
  { dayOfWeek: 6, dayName: 'Sábado', shortName: 'Sáb', isOpen: true, openTime: '06:00', closeTime: '20:00' },
];

export function parseWeeklySchedule(raw: any): DaySchedule[] {
  if (!raw) return DEFAULT_WEEKLY_SCHEDULE;
  
  let scheduleArray: any = raw;
  if (typeof raw === 'string') {
    try {
      scheduleArray = JSON.parse(raw);
    } catch {
      return DEFAULT_WEEKLY_SCHEDULE;
    }
  }

  if (!Array.isArray(scheduleArray) || scheduleArray.length === 0) {
    return DEFAULT_WEEKLY_SCHEDULE;
  }

  // Ensure all 7 days are present and properly structured
  return DEFAULT_WEEKLY_SCHEDULE.map((defaultDay) => {
    const found = scheduleArray.find((d: any) => Number(d.dayOfWeek) === Number(defaultDay.dayOfWeek));
    if (!found) return defaultDay;
    return {
      dayOfWeek: defaultDay.dayOfWeek,
      dayName: defaultDay.dayName,
      shortName: defaultDay.shortName,
      isOpen: found.isOpen === true || found.isOpen === 'true',
      openTime: found.openTime || defaultDay.openTime,
      closeTime: found.closeTime || defaultDay.closeTime,
      hasBreak: !!found.hasBreak,
      breakStart: found.breakStart || '',
      breakEnd: found.breakEnd || '',
    };
  });
}

export function formatWeeklyScheduleSummary(schedule: DaySchedule[]): string {
  if (!schedule || schedule.length === 0) return '';

  const openDays = schedule.filter(d => d.isOpen);
  if (openDays.length === 0) return 'Temporariamente Fechado';

  // Group days with identical hours
  const groups: { days: string[]; hours: string }[] = [];

  schedule.forEach((day) => {
    const hours = day.isOpen ? `${day.openTime} às ${day.closeTime}` : 'Fechado';
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.hours === hours) {
      lastGroup.days.push(day.shortName);
    } else {
      groups.push({ days: [day.shortName], hours });
    }
  });

  return groups.map(g => {
    const dayLabel = g.days.length === 1 
      ? g.days[0] 
      : `${g.days[0]} a ${g.days[g.days.length - 1]}`;
    return `${dayLabel}: ${g.hours}`;
  }).join(' • ');
}

export interface StoreCurrentStatus {
  isOpenNow: boolean;
  isWithinSchedule: boolean;
  isManualOverride?: boolean;
  manualOverrideType?: 'open' | 'closed';
  statusBadge: string;
  details: string;
  todaySchedule: DaySchedule;
  currentTimeString: string;
  nextChangeText?: string;
}

export function isWithinOperatingHours(weeklyScheduleRaw: any): boolean {
  const schedule = parseWeeklySchedule(weeklyScheduleRaw);
  const now = new Date();
  
  let currentDayOfWeek = 1;
  let currentHour = 12;
  let currentMinute = 0;

  try {
    const brazilDateStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const brazilDate = new Date(brazilDateStr);
    currentDayOfWeek = brazilDate.getDay();
    currentHour = brazilDate.getHours();
    currentMinute = brazilDate.getMinutes();
  } catch {
    currentDayOfWeek = now.getDay();
    currentHour = now.getHours();
    currentMinute = now.getMinutes();
  }

  const currentMinutesFromMidnight = currentHour * 60 + currentMinute;
  const today = schedule.find(d => d.dayOfWeek === currentDayOfWeek) || schedule[0];

  if (!today || !today.isOpen) return false;

  const [openH, openM] = today.openTime.split(':').map(Number);
  const [closeH, closeM] = today.closeTime.split(':').map(Number);
  const openMinutes = (openH || 0) * 60 + (openM || 0);
  const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

  let isOpenByTime = currentMinutesFromMidnight >= openMinutes && currentMinutesFromMidnight < closeMinutes;

  if (isOpenByTime && today.hasBreak && today.breakStart && today.breakEnd) {
    const [bStartH, bStartM] = today.breakStart.split(':').map(Number);
    const [bEndH, bEndM] = today.breakEnd.split(':').map(Number);
    const bStartMin = (bStartH || 0) * 60 + (bStartM || 0);
    const bEndMin = (bEndH || 0) * 60 + (bEndM || 0);
    if (currentMinutesFromMidnight >= bStartMin && currentMinutesFromMidnight < bEndMin) {
      isOpenByTime = false;
    }
  }

  return isOpenByTime;
}

export function getStoreCurrentStatus(
  weeklyScheduleRaw: any, 
  manualIsOpen: boolean = true, 
  autoOpenClose: boolean = true,
  forceOpen: boolean = false
): StoreCurrentStatus {
  const schedule = parseWeeklySchedule(weeklyScheduleRaw);

  // Get current date/time in Brazilian timezone (America/Sao_Paulo / UTC-3)
  const now = new Date();
  
  // Calculate day of week and current time in Brazil (America/Sao_Paulo)
  let currentDayOfWeek = 1;
  let currentHour = 12;
  let currentMinute = 0;

  try {
    const brazilDateStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const brazilDate = new Date(brazilDateStr);
    currentDayOfWeek = brazilDate.getDay(); // 0 = Dom, 1 = Seg, ...
    currentHour = brazilDate.getHours();
    currentMinute = brazilDate.getMinutes();
  } catch {
    // Fallback to local time if timezone is not supported
    currentDayOfWeek = now.getDay();
    currentHour = now.getHours();
    currentMinute = now.getMinutes();
  }

  const currentMinutesFromMidnight = currentHour * 60 + currentMinute;
  const currentTimeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  const today = schedule.find(d => d.dayOfWeek === currentDayOfWeek) || schedule[0];

  // Calculate strict time-based schedule availability
  let isWithinSchedule = false;
  if (today && today.isOpen) {
    const [openH, openM] = today.openTime.split(':').map(Number);
    const [closeH, closeM] = today.closeTime.split(':').map(Number);
    const openMinutes = (openH || 0) * 60 + (openM || 0);
    const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

    isWithinSchedule = currentMinutesFromMidnight >= openMinutes && currentMinutesFromMidnight < closeMinutes;

    if (isWithinSchedule && today.hasBreak && today.breakStart && today.breakEnd) {
      const [bStartH, bStartM] = today.breakStart.split(':').map(Number);
      const [bEndH, bEndM] = today.breakEnd.split(':').map(Number);
      const bStartMin = (bStartH || 0) * 60 + (bStartM || 0);
      const bEndMin = (bEndH || 0) * 60 + (bEndM || 0);
      if (currentMinutesFromMidnight >= bStartMin && currentMinutesFromMidnight < bEndMin) {
        isWithinSchedule = false;
      }
    }
  }

  // 1. If manual open is set to false, it is always closed by owner
  if (manualIsOpen === false) {
    return {
      isOpenNow: false,
      isWithinSchedule,
      isManualOverride: true,
      manualOverrideType: 'closed',
      statusBadge: 'Fechado',
      details: 'Loja fechada temporariamente no painel de controle (apenas visualização)',
      todaySchedule: today,
      currentTimeString,
    };
  }

  // 2. If forceOpen is active, store is manually open even outside scheduled hours
  if (forceOpen === true) {
    return {
      isOpenNow: true,
      isWithinSchedule,
      isManualOverride: true,
      manualOverrideType: 'open',
      statusBadge: 'Aberto Manualmente',
      details: isWithinSchedule
        ? `Aberto (Escala normal ${today.openTime} às ${today.closeTime})`
        : 'Abertura manual ativa no painel (recebendo pedidos fora do horário programado)',
      todaySchedule: today,
      currentTimeString,
    };
  }

  // 3. If automatic schedule enforcement is disabled, trust manualIsOpen
  if (autoOpenClose === false) {
    return {
      isOpenNow: manualIsOpen,
      isWithinSchedule,
      isManualOverride: true,
      manualOverrideType: manualIsOpen ? 'open' : 'closed',
      statusBadge: manualIsOpen ? 'Aberto Agora' : 'Fechado',
      details: manualIsOpen 
        ? (today.isOpen ? `Hoje até às ${today.closeTime}` : 'Atendimento manual ativo')
        : 'Loja marcada como fechada no painel',
      todaySchedule: today,
      currentTimeString,
    };
  }

  // 4. Automatic calculation based on schedule
  if (!today.isOpen) {
    // Find next open day
    let nextDayIndex = (currentDayOfWeek + 1) % 7;
    let nextDay = schedule.find(d => d.dayOfWeek === nextDayIndex);
    let daysAhead = 1;
    while (nextDay && !nextDay.isOpen && daysAhead < 7) {
      nextDayIndex = (nextDayIndex + 1) % 7;
      nextDay = schedule.find(d => d.dayOfWeek === nextDayIndex);
      daysAhead++;
    }

    return {
      isOpenNow: false,
      isWithinSchedule: false,
      isManualOverride: false,
      statusBadge: 'Fechado Hoje',
      details: `Fechado aos ${today.dayName}s.${nextDay ? ` Abre ${daysAhead === 1 ? 'amanhã' : nextDay.dayName} às ${nextDay.openTime}` : ''}`,
      todaySchedule: today,
      currentTimeString,
      nextChangeText: nextDay ? `Abre ${daysAhead === 1 ? 'amanhã' : nextDay.dayName} às ${nextDay.openTime}` : 'Consulte os horários da semana',
    };
  }

  const [openH, openM] = today.openTime.split(':').map(Number);
  const openMinutes = (openH || 0) * 60 + (openM || 0);

  const isOpenNow = isWithinSchedule && manualIsOpen;

  let statusBadge = 'Fechado';
  let details = '';

  if (isOpenNow) {
    statusBadge = 'Aberto Agora';
    details = `Aberto hoje das ${today.openTime} às ${today.closeTime}`;
  } else if (currentMinutesFromMidnight < openMinutes) {
    statusBadge = 'Fechado Agora';
    details = `Fora do horário de atendimento. Abre hoje às ${today.openTime}`;
  } else {
    // Find next open day
    let nextDayIndex = (currentDayOfWeek + 1) % 7;
    let nextDay = schedule.find(d => d.dayOfWeek === nextDayIndex);
    let daysAhead = 1;
    while (nextDay && !nextDay.isOpen && daysAhead < 7) {
      nextDayIndex = (nextDayIndex + 1) % 7;
      nextDay = schedule.find(d => d.dayOfWeek === nextDayIndex);
      daysAhead++;
    }
    statusBadge = 'Fechado Agora';
    details = nextDay 
      ? `Fora do horário de atendimento. Abre ${daysAhead === 1 ? 'amanhã' : nextDay.dayName} às ${nextDay.openTime}` 
      : 'Fora do horário de atendimento. Cardápio disponível para visualização.';
  }

  return {
    isOpenNow,
    isWithinSchedule,
    isManualOverride: false,
    statusBadge,
    details,
    todaySchedule: today,
    currentTimeString,
  };
}

export function calculatePickupTime(
  scheduledTime: string,
  hasFrozen: boolean,
  normalMinutes = 40,
  frozenMinutes = 90
): string {
  if (!scheduledTime || typeof scheduledTime !== 'string') return '';
  const match = scheduledTime.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return '';

  const addMinutes = hasFrozen ? frozenMinutes : normalMinutes;
  const totalMinutes = h * 60 + m + addMinutes;
  const newH = Math.floor((totalMinutes / 60) % 24);
  const newM = totalMinutes % 60;

  const padH = String(newH).padStart(2, '0');
  const padM = String(newM).padStart(2, '0');
  return `${padH}:${padM}`;
}

export function getEffectivePickupTimestamp(order: any): number {
  if (!order) return Date.now();

  const createdTime = order.createdAt 
    ? (typeof order.createdAt === 'number' ? order.createdAt : new Date(order.createdAt).getTime())
    : Date.now();

  const scheduledTimeStr = order.scheduledTime || (order as any).scheduled_time;
  const scheduledDayStr = order.scheduledDay || (order as any).scheduled_day || order.scheduledDate || (order as any).scheduled_date;

  if (scheduledTimeStr && typeof scheduledTimeStr === 'string' && scheduledTimeStr.trim().length > 0) {
    let timePart = scheduledTimeStr;
    const matchRetirada = scheduledTimeStr.match(/retirada\s+às\s+(\d{1,2}:\d{2})/i);
    if (matchRetirada && matchRetirada[1]) {
      timePart = matchRetirada[1];
    } else {
      const matchTime = scheduledTimeStr.match(/(\d{1,2}:\d{2})/);
      if (matchTime) {
        timePart = matchTime[1];
      }
    }

    const timeParts = timePart.split(':');
    if (timeParts.length >= 2) {
      const targetHours = parseInt(timeParts[0], 10);
      const targetMinutes = parseInt(timeParts[1], 10);

      if (!isNaN(targetHours) && !isNaN(targetMinutes)) {
        let baseDate = new Date(createdTime);

        if (scheduledDayStr && typeof scheduledDayStr === 'string') {
          const isoMatch = scheduledDayStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          const slashMatch = scheduledDayStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);

          if (isoMatch) {
            baseDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
          } else if (slashMatch) {
            const day = parseInt(slashMatch[1], 10);
            const month = parseInt(slashMatch[2], 10) - 1;
            const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : baseDate.getFullYear();
            baseDate = new Date(year, month, day);
          }
        }

        baseDate.setHours(targetHours, targetMinutes, 0, 0);
        return baseDate.getTime();
      }
    }
  }

  // Immediate order: createdAt + prep buffer (40m / 90m)
  const hasFrozen = Boolean(order.hasFrozenItems) || (Array.isArray(order.items) && order.items.some((i: any) => i.isFrozen || (i.addons && i.addons.some((a: any) => a.isFrozen))));
  const prepMinutes = hasFrozen ? 90 : 40;
  return createdTime + (prepMinutes * 60 * 1000);
}

export interface DayTheme {
  dayOfWeek: number; // 0..6 or -1 for 'all'
  name: string;
  shortName: string;
  emoji: string;
  dotBg: string;
  // Tab styles
  tabActive: string;
  tabInactive: string;
  badgeActive: string;
  badgeInactive: string;
  // Card styles
  cardHeaderBg: string;
  cardBorder: string;
  cardScheduleBg: string;
  cardScheduleIcon: string;
  cardDayBadge: string;
  accentBadge: string;
}

export const DAY_THEMES: Record<number, DayTheme> = {
  // 0: Domingo (Rose)
  0: {
    dayOfWeek: 0,
    name: 'Domingo',
    shortName: 'Dom',
    emoji: '🔴',
    dotBg: 'bg-rose-500',
    tabActive: 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400/50',
    tabInactive: 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50 hover:border-rose-400',
    badgeActive: 'bg-white text-rose-800',
    badgeInactive: 'bg-rose-100 text-rose-800',
    cardHeaderBg: 'bg-gradient-to-r from-rose-600 to-rose-700',
    cardBorder: 'border-rose-300 hover:border-rose-400 shadow-sm',
    cardScheduleBg: 'bg-rose-50 border-rose-200 text-rose-950',
    cardScheduleIcon: 'text-rose-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  // 1: Segunda-feira (Sky Blue)
  1: {
    dayOfWeek: 1,
    name: 'Segunda-feira',
    shortName: 'Seg',
    emoji: '🔵',
    dotBg: 'bg-sky-500',
    tabActive: 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-400/50',
    tabInactive: 'bg-white text-sky-800 border-sky-300 hover:bg-sky-50 hover:border-sky-400',
    badgeActive: 'bg-white text-sky-800',
    badgeInactive: 'bg-sky-100 text-sky-800',
    cardHeaderBg: 'bg-gradient-to-r from-sky-600 to-sky-700',
    cardBorder: 'border-sky-300 hover:border-sky-400 shadow-sm',
    cardScheduleBg: 'bg-sky-50 border-sky-200 text-sky-950',
    cardScheduleIcon: 'text-sky-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  // 2: Terça-feira (Emerald Green)
  2: {
    dayOfWeek: 2,
    name: 'Terça-feira',
    shortName: 'Ter',
    emoji: '🟢',
    dotBg: 'bg-emerald-500',
    tabActive: 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50',
    tabInactive: 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400',
    badgeActive: 'bg-white text-emerald-800',
    badgeInactive: 'bg-emerald-100 text-emerald-800',
    cardHeaderBg: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
    cardBorder: 'border-emerald-300 hover:border-emerald-400 shadow-sm',
    cardScheduleBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    cardScheduleIcon: 'text-emerald-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  // 3: Quarta-feira (Warm Amber)
  3: {
    dayOfWeek: 3,
    name: 'Quarta-feira',
    shortName: 'Qua',
    emoji: '🟡',
    dotBg: 'bg-amber-500',
    tabActive: 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/50',
    tabInactive: 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50 hover:border-amber-400',
    badgeActive: 'bg-white text-amber-900',
    badgeInactive: 'bg-amber-100 text-amber-900',
    cardHeaderBg: 'bg-gradient-to-r from-amber-600 to-amber-700',
    cardBorder: 'border-amber-300 hover:border-amber-400 shadow-sm',
    cardScheduleBg: 'bg-amber-50 border-amber-200 text-amber-950',
    cardScheduleIcon: 'text-amber-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  // 4: Quinta-feira (Purple Violet)
  4: {
    dayOfWeek: 4,
    name: 'Quinta-feira',
    shortName: 'Qui',
    emoji: '🟣',
    dotBg: 'bg-purple-500',
    tabActive: 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/50',
    tabInactive: 'bg-white text-purple-800 border-purple-300 hover:bg-purple-50 hover:border-purple-400',
    badgeActive: 'bg-white text-purple-800',
    badgeInactive: 'bg-purple-100 text-purple-800',
    cardHeaderBg: 'bg-gradient-to-r from-purple-600 to-purple-700',
    cardBorder: 'border-purple-300 hover:border-purple-400 shadow-sm',
    cardScheduleBg: 'bg-purple-50 border-purple-200 text-purple-950',
    cardScheduleIcon: 'text-purple-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  // 5: Sexta-feira (Indigo)
  5: {
    dayOfWeek: 5,
    name: 'Sexta-feira',
    shortName: 'Sex',
    emoji: '🔷',
    dotBg: 'bg-indigo-500',
    tabActive: 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/50',
    tabInactive: 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400',
    badgeActive: 'bg-white text-indigo-800',
    badgeInactive: 'bg-indigo-100 text-indigo-800',
    cardHeaderBg: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
    cardBorder: 'border-indigo-300 hover:border-indigo-400 shadow-sm',
    cardScheduleBg: 'bg-indigo-50 border-indigo-200 text-indigo-950',
    cardScheduleIcon: 'text-indigo-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  // 6: Sábado (Fuchsia Pink)
  6: {
    dayOfWeek: 6,
    name: 'Sábado',
    shortName: 'Sáb',
    emoji: '🌸',
    dotBg: 'bg-fuchsia-500',
    tabActive: 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-md ring-2 ring-fuchsia-400/50',
    tabInactive: 'bg-white text-fuchsia-800 border-fuchsia-300 hover:bg-fuchsia-50 hover:border-fuchsia-400',
    badgeActive: 'bg-white text-fuchsia-800',
    badgeInactive: 'bg-fuchsia-100 text-fuchsia-800',
    cardHeaderBg: 'bg-gradient-to-r from-fuchsia-600 to-fuchsia-700',
    cardBorder: 'border-fuchsia-300 hover:border-fuchsia-400 shadow-sm',
    cardScheduleBg: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950',
    cardScheduleIcon: 'text-fuchsia-600',
    cardDayBadge: 'bg-white/20 text-white border-white/30',
    accentBadge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
};

export const ALL_DAYS_THEME: DayTheme = {
  dayOfWeek: -1,
  name: 'Todos os Dias',
  shortName: 'Todos',
  emoji: '📋',
  dotBg: 'bg-stone-700',
  tabActive: 'bg-stone-900 text-white border-stone-950 shadow-md ring-2 ring-stone-400/50',
  tabInactive: 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 hover:border-stone-400',
  badgeActive: 'bg-white text-stone-900',
  badgeInactive: 'bg-stone-100 text-stone-700',
  cardHeaderBg: 'bg-gradient-to-r from-stone-800 to-stone-900',
  cardBorder: 'border-stone-300 shadow-sm',
  cardScheduleBg: 'bg-stone-50 border-stone-200 text-stone-950',
  cardScheduleIcon: 'text-stone-600',
  cardDayBadge: 'bg-white/20 text-white border-white/30',
  accentBadge: 'bg-stone-100 text-stone-800 border-stone-200',
};

export function getDayTheme(dayOfWeek: number | undefined | null): DayTheme {
  if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
    return ALL_DAYS_THEME;
  }
  return DAY_THEMES[dayOfWeek] || ALL_DAYS_THEME;
}

export interface OrderDateInfo {
  dateKey: string;
  formattedLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
  dayOfWeek: number;
  dayShortName: string;
  dayFullName: string;
  formattedDate: string;
  theme: DayTheme;
}

export function getOrderDateInfo(order: any): OrderDateInfo {
  const pickupTs = getEffectivePickupTimestamp(order);
  const d = new Date(pickupTs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${dayNum}`;
  const formattedDate = `${dayNum}/${m}`;

  const dayShortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayFullNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayOfWeek = d.getDay();

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const isToday = dateKey === todayKey;
  const isTomorrow = dateKey === tomorrowKey;

  let label = `${dayShortNames[dayOfWeek]}, ${dayNum}/${m}`;
  if (isToday) {
    label = `Hoje (${dayNum}/${m})`;
  } else if (isTomorrow) {
    label = `Amanhã (${dayShortNames[dayOfWeek]}, ${dayNum}/${m})`;
  }

  const theme = getDayTheme(dayOfWeek);

  return { 
    dateKey, 
    formattedLabel: label, 
    isToday, 
    isTomorrow, 
    dayOfWeek, 
    dayShortName: dayShortNames[dayOfWeek], 
    dayFullName: dayFullNames[dayOfWeek],
    formattedDate,
    theme
  };
}

