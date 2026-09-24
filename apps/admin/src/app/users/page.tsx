import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { when } from '@/lib/format';

interface UserRow {
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  level: number;
  createdAt: string;
  postCount: number;
  reportCount: number;
}

const ROLES: Record<string, string> = {
  gezgin: 'Gezgin',
  local_expert: 'Local Expert',
  business: 'Biznes',
  admin: 'Admin',
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = '', status = '' } = await searchParams;
  const query = new URLSearchParams();
  if (q.trim().length >= 2) query.set('q', q.trim());
  if (status) query.set('status', status);
  query.set('limit', '50');

  const users = await api<{ total: number; data: UserRow[] }>(`/admin/users?${query.toString()}`);

  return (
    <Shell current="/users">
      <h1>İstifadəçilər</h1>
      <p className="sub">{users.total.toLocaleString('az-AZ')} hesab</p>

      <form className="row" style={{ marginBottom: 16 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Ad, username və ya e-mail" style={{ maxWidth: 320 }} />
        <button className="btn" type="submit">
          Axtar
        </button>
        <Link href="/users?status=suspended" className="tag muted" style={{ textDecoration: 'none', padding: '6px 14px' }}>
          Dayandırılmışlar
        </Link>
      </form>

      {users.data.length === 0 ? (
        <div className="empty">Nəticə yoxdur.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>İstifadəçi</th>
              <th>Rol</th>
              <th>Vəziyyət</th>
              <th>Level</th>
              <th>Paylaşım</th>
              <th>Şikayət</th>
              <th>Qeydiyyat</th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.username}>
                <td>
                  <Link href={`/users/${u.username}`}>{u.fullName}</Link>
                  <div className="label" style={{ color: 'var(--muted)' }}>@{u.username}</div>
                </td>
                <td>{ROLES[u.role] ?? u.role}</td>
                <td>
                  <span className={`tag ${u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'late' : 'muted'}`}>
                    {u.status === 'active' ? 'aktiv' : u.status === 'suspended' ? 'dayandırılıb' : 'silinib'}
                  </span>
                </td>
                <td>{u.level}</td>
                <td>{u.postCount}</td>
                <td>{u.reportCount > 0 ? <span className="tag warn">{u.reportCount}</span> : '—'}</td>
                <td>{when(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
