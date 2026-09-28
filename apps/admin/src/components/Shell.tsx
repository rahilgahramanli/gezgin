import Link from 'next/link';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, revoke } from '@/lib/api';
import { dropSession } from '@/lib/session';
import { redirect } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Panel' },
  { href: '/reports', label: 'Şikayətlər' },
  { href: '/users', label: 'İstifadəçilər' },
  { href: '/audit', label: 'Audit izi' },
];

/** Panelin çərçivəsi — sol menyu və çıxış. */
export function Shell({
  children,
  current,
  openReports,
  who,
}: {
  children: React.ReactNode;
  current: string;
  openReports?: number;
  who?: string;
}) {
  async function logout() {
    'use server';
    const jar = await cookies();
    const session = dropSession(jar.get(SESSION_COOKIE)?.value);
    if (session) await revoke(session.refreshToken);
    jar.delete(SESSION_COOKIE);
    redirect('/login');
  }

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">GEZGIN</div>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined}>
            {item.label}
            {item.href === '/reports' && openReports ? <span className="tag late">{openReports}</span> : null}
          </Link>
        ))}
        <div className="spacer" />
        {who ? <div className="who">@{who}</div> : null}
        <form action={logout}>
          <button className="btn ghost" type="submit" style={{ width: '100%' }}>
            Çıxış
          </button>
        </form>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
