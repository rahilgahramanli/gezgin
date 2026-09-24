import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { ageLabel, when } from '@/lib/format';

interface Stats {
  reports: { open: number; last24h: number; oldestOpenAt: string | null; slaBreached: boolean };
  users: { total: number; suspended: number; new24h: number };
  posts: { total: number; new24h: number };
}

interface QueueRow {
  publicId: string;
  reason: string;
  status: string;
  ageHours: number;
  reportedUser: { username: string } | null;
  target: { type: string; text: string | null };
}

export default async function DashboardPage() {
  const [stats, queue] = await Promise.all([
    api<Stats>('/admin/stats'),
    api<{ data: QueueRow[] }>('/admin/reports?status=open&limit=5'),
  ]);

  return (
    <Shell current="/" openReports={stats.reports.open}>
      <h1>Panel</h1>
      <p className="sub">Son 24 saatın mənzərəsi</p>

      <div className="cards">
        <div className={`card${stats.reports.slaBreached ? ' alert' : ''}`}>
          <div className="value">{stats.reports.open}</div>
          <div className="label">Açıq şikayət</div>
          {stats.reports.oldestOpenAt ? (
            <div className="label" style={{ marginTop: 6 }}>
              ən köhnəsi: {when(stats.reports.oldestOpenAt)}
              {stats.reports.slaBreached ? ' · 24 saat keçib' : ''}
            </div>
          ) : null}
        </div>
        <div className="card">
          <div className="value">{stats.reports.last24h}</div>
          <div className="label">24 saatda yeni şikayət</div>
        </div>
        <div className="card">
          <div className="value">{stats.users.total.toLocaleString('az-AZ')}</div>
          <div className="label">İstifadəçi · {stats.users.new24h} yeni</div>
        </div>
        <div className="card">
          <div className="value">{stats.users.suspended}</div>
          <div className="label">Dayandırılmış hesab</div>
        </div>
        <div className="card">
          <div className="value">{stats.posts.total.toLocaleString('az-AZ')}</div>
          <div className="label">Paylaşım · {stats.posts.new24h} yeni</div>
        </div>
      </div>

      <h2>Növbənin başı</h2>
      {queue.data.length === 0 ? (
        <div className="empty">Açıq şikayət yoxdur — növbə təmizdir.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Yaş</th>
              <th>Səbəb</th>
              <th>Kontent</th>
              <th>Müəllif</th>
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
                  </td>
                  <td>{r.reason}</td>
                  <td className="snippet">{r.target.text ?? '—'}</td>
                  <td>{r.reportedUser ? `@${r.reportedUser.username}` : '—'}</td>
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
