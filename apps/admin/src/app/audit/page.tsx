import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

interface AuditRow {
  action: string;
  actor: string | null;
  targetType: string | null;
  targetId: number | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

const ACTIONS: Record<string, string> = {
  'report.dismiss': 'Şikayət rədd edildi',
  'report.delete_content': 'Şikayət → kontent silindi',
  'report.suspend_user': 'Şikayət → hesab dayandırıldı',
  'user.suspend': 'Hesab dayandırıldı',
  'user.restore': 'Hesab bərpa edildi',
  'content.delete': 'Kontent silindi',
};

function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object') return String(value);
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== false)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

export default async function AuditPage() {
  const trail = await api<{ total: number; data: AuditRow[] }>('/admin/audit?limit=100');

  return (
    <Shell current="/audit">
      <h1>Audit izi</h1>
      <p className="sub">Panelin hər dəyişikliyi burada qalır — {trail.total.toLocaleString('az-AZ')} qeyd</p>

      {trail.data.length === 0 ? (
        <div className="empty">Hələ əməliyyat olmayıb.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tarix</th>
              <th>Kim</th>
              <th>Nə</th>
              <th>Hədəf</th>
              <th>Əvvəl → sonra</th>
            </tr>
          </thead>
          <tbody>
            {trail.data.map((row, i) => (
              <tr key={`${row.createdAt}-${i}`}>
                <td>{when(row.createdAt)}</td>
                <td>{row.actor ? `@${row.actor}` : '—'}</td>
                <td>{ACTIONS[row.action] ?? row.action}</td>
                <td>
                  {row.targetType ?? '—'}
                  {row.targetId ? ` #${row.targetId}` : ''}
                </td>
                <td className="snippet">
                  {summarize(row.before)} → {summarize(row.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
