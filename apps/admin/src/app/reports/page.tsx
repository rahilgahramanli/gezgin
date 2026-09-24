import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { REASONS, TARGET_LABELS, ageLabel, when } from '@/lib/format';

interface QueueRow {
  publicId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  ageHours: number;
  reporter: { username: string; fullName: string } | null;
  reportedUser: { username: string; fullName: string; status: string } | null;
  target: { type: string; text: string | null; author: string | null; deleted: boolean };
}

const TABS = [
  { key: 'open', label: 'Açıq' },
  { key: 'resolved', label: 'Həll olunmuş' },
  { key: 'rejected', label: 'Rədd edilmiş' },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'open' } = await searchParams;
  const queue = await api<{ data: QueueRow[]; nextCursor: string | null }>(
    `/admin/reports?status=${status}&limit=50`,
  );
  const open = status === 'open' ? queue.data.length : undefined;

  return (
    <Shell current="/reports" openReports={open}>
      <h1>Şikayətlər</h1>
      <p className="sub">Hədəf: hər şikayətə 24 saat içində baxılsın</p>

      <div className="row" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/reports?status=${tab.key}`}
            className={`tag ${status === tab.key ? 'ok' : 'muted'}`}
            style={{ textDecoration: 'none', padding: '6px 14px' }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {queue.data.length === 0 ? (
        <div className="empty">Bu siyahı boşdur.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Yaş</th>
              <th>Növ</th>
              <th>Səbəb</th>
              <th>Kontent</th>
              <th>Müəllif</th>
              <th>Şikayətçi</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.data.map((r) => {
              const age = ageLabel(r.ageHours);
              return (
                <tr key={r.publicId}>
                  <td>
                    <span className={`tag ${age.level}`}>{age.text}</span>
                    <div className="label" style={{ fontSize: 12, color: 'var(--muted)' }}>{when(r.createdAt)}</div>
                  </td>
                  <td>{TARGET_LABELS[r.target.type] ?? r.target.type}</td>
                  <td>{REASONS[r.reason] ?? r.reason}</td>
                  <td className="snippet">
                    {r.target.deleted ? <span className="tag muted">silinib</span> : null} {r.target.text ?? '—'}
                  </td>
                  <td>
                    {r.reportedUser ? `@${r.reportedUser.username}` : '—'}
                    {r.reportedUser?.status === 'suspended' ? (
                      <div>
                        <span className="tag late">dayandırılıb</span>
                      </div>
                    ) : null}
                  </td>
                  <td>{r.reporter ? `@${r.reporter.username}` : '—'}</td>
                  <td>
                    <Link href={`/reports/${r.publicId}`}>Bax →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
