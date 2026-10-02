// src/lib/format.ts — display formatting for money and dates.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '$—';
  const n = Number(amount);
  const rounded = Math.round(n * 100) / 100;
  const int = Math.floor(Math.abs(rounded));
  const cents = Math.round((Math.abs(rounded) - int) * 100);
  const grouped = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cents > 0 ? `$${grouped}.${String(cents).padStart(2, '0')}` : `$${grouped}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
