import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { REASONS, TARGET_LABELS, when } from '@/lib/format';

interface UserDetail {
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  role: string;
  status: string;
  level: number;
  xp: number;
  createdAt: string;
  lastActiveAt: string | null;
  counts: { posts: number; reviews: number; followers: number; reports: number };
  recentReports: Array<{ publicId: string; reason: string; status: string; createdAt: string; targetType: string }>;
}

export default async function UserDetailPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await api<UserDetail>(`/admin/users/${username}`);

  async function suspend(form: FormData) {
    'use server';
    const target = String(form.get('username'));
    const reason = String(form.get('reason') ?? '').trim();
    await api(`/admin/users/${target}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
    revalidatePath(`/users/${target}`);
  }

  async function restore(form: FormData) {
    'use server';
    const target = String(form.get('username'));
    await api(`/admin/users/${target}/restore`, { method: 'POST' });
    revalidatePath(`/users/${target}`);
  }

  return (
    <Shell current="/users">
      <Link href="/users">← İstifadəçilər</Link>
      <h1 style={{ marginTop: 12 }}>{user.fullName}</h1>
      <p className="sub">
        @{user.username} · {user.email ?? '—'} · Level {user.level} ({user.xp.toLocaleString('az-AZ')} XP)
      </p>

      <div className="cards">
        <div className="card">
          <div className="value">{user.counts.posts}</div>
          <div className="label">Paylaşım</div>
        </div>
        <div className="card">
          <div className="value">{user.counts.reviews}</div>
          <div className="label">Rəy</div>
        </div>
        <div className="card">
          <div className="value">{user.counts.followers}</div>
          <div className="label">İzləyici</div>
        </div>
        <div className={`card${user.counts.reports > 0 ? ' alert' : ''}`}>
          <div className="value">{user.counts.reports}</div>
          <div className="label">Haqqında şikayət</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="label">Hesab</div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className={`tag ${user.status === 'active' ? 'ok' : 'late'}`}>
            {user.status === 'active' ? 'aktiv' : user.status === 'suspended' ? 'dayandırılıb' : 'silinib'}
          </span>
          <span className="tag muted">qeydiyyat: {when(user.createdAt)}</span>
          <span className="tag muted">son fəaliyyət: {when(user.lastActiveAt)}</span>
        </div>
        {user.bio ? <p style={{ marginBottom: 0 }}>{user.bio}</p> : null}
      </div>

      {user.status === 'active' ? (
        <form action={suspend} className="card" style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <input type="hidden" name="username" value={user.username} />
          <div className="label">Hesabı dayandır — aktiv sessiyalar dərhal bağlanır</div>
          <input type="text" name="reason" placeholder="Daxili səbəb (audit izinə düşür)" required minLength={3} />
          <div>
            <button className="btn danger" type="submit" disabled={user.role === 'admin'}>
              Dayandır
            </button>
          </div>
        </form>
      ) : user.status === 'suspended' ? (
        <form action={restore} className="card" style={{ marginTop: 14 }}>
          <input type="hidden" name="username" value={user.username} />
          <div className="label">Hesab dayandırılıb</div>
          <button className="btn" type="submit" style={{ marginTop: 10 }}>
            Bərpa et
          </button>
        </form>
      ) : null}

      <h2>Son şikayətlər</h2>
      {user.recentReports.length === 0 ? (
        <div className="empty">Bu istifadəçi haqqında şikayət yoxdur.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tarix</th>
              <th>Növ</th>
              <th>Səbəb</th>
              <th>Vəziyyət</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {user.recentReports.map((r) => (
              <tr key={r.publicId}>
                <td>{when(r.createdAt)}</td>
                <td>{TARGET_LABELS[r.targetType] ?? r.targetType}</td>
                <td>{REASONS[r.reason] ?? r.reason}</td>
                <td>
                  <span className={`tag ${r.status === 'open' ? 'warn' : 'muted'}`}>{r.status}</span>
                </td>
                <td>
                  <Link href={`/reports/${r.publicId}`}>Bax →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
