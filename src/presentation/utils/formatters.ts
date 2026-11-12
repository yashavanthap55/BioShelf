import { parseISODate, type ISODate } from '@/domain/dates';
import { tracksServiceDate, type AssetCategory } from '@/domain/entities';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(value: ISODate): string {
  const { year, month, day } = parseISODate(value);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export const formatMonth = (month: number) => MONTHS[month - 1];

export function formatWeekday(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** Sentence describing the time to expiry/service, e.g. "Expired 3 days ago". */
export function countdownSentence(days: number, category: AssetCategory): string {
  const service = tracksServiceDate(category);
  if (days < 0) {
    const overdue = plural(-days, 'day');
    return service ? `Service overdue by ${overdue}` : `Expired ${overdue} ago`;
  }
  if (days === 0) return service ? 'Service due today' : 'Expires today';
  if (days === 1) return service ? 'Service due tomorrow' : 'Expires tomorrow';
  return service ? `Service due in ${plural(days, 'day')}` : `${plural(days, 'day')} left`;
}

/** Compact countdown for tight spaces: "12d", "3mo", "1.4y", "Today", "5d ago". */
export function compactDays(days: number): string {
  if (days === 0) return 'Today';
  const magnitude = Math.abs(days);
  const value =
    magnitude >= 365
      ? `${(magnitude / 365).toFixed(1)}y`
      : magnitude >= 60
        ? `${Math.floor(magnitude / 30)}mo`
        : `${magnitude}d`;
  return days < 0 ? `${value} ago` : value;
}

export function timeAgo(timestamp: number, now: Date): string {
  const seconds = (now.getTime() - timestamp) / 1000;
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
