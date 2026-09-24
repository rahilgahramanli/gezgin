import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ApiError, TOKEN_COOKIE, login } from '@/lib/api';

/**
 * Admin girişi. Mobil tətbiqlə eyni `/auth/login` endpointi işlədilir, amma
 * panelə yalnız `admin` rolu buraxılır — rol yoxlaması həm burada, həm də hər
 * `admin/*` sorğusunda (RolesGuard) edilir.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function submit(form: FormData) {
    'use server';
    const identifier = String(form.get('identifier') ?? '').trim();
    const password = String(form.get('password') ?? '');

    let session;
    try {
      session = await login(identifier, password);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Giriş alınmadı';
      redirect(`/login?error=${encodeURIComponent(message)}`);
    }

    if (session.user.role !== 'admin') {
      redirect(`/login?error=${encodeURIComponent('Bu hesabın panelə girişi yoxdur')}`);
    }

    const jar = await cookies();
    jar.set(TOKEN_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
      secure: process.env.NODE_ENV === 'production',
    });
    redirect('/');
  }

  return (
    <main className="login">
      <form action={submit}>
        <div>
          <h1>GEZGIN admin</h1>
          <p className="sub">Moderasiya və istifadəçi idarəsi</p>
        </div>
        <label>
          İstifadəçi adı və ya e-mail
          <input type="text" name="identifier" autoComplete="username" required />
        </label>
        <label>
          Şifrə
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          Daxil ol
        </button>
      </form>
    </main>
  );
}
