import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Shell } from '@/components/Shell';
import { api, attempt } from '@/lib/api';
import { REASONS, TARGET_LABELS, when } from '@/lib/format';

interface ReportDetail {
  publicId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reporter: { username: string; fullName: string } | null;
  reportedUser: { username: string; fullName: string; status: string; resolvedReportCount: number } | null;
  target: {
    type: string;
    publicId: string | null;
    text: string | null;
    author: string | null;
    createdAt: string | null;
    deleted: boolean;
    missing?: boolean;
  };
  otherReportCount: number;
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const report = await api<ReportDetail>(`/admin/reports/${id}`);
  const closed = report.status === 'resolved' || report.status === 'rejected';

  async function resolve(form: FormData) {
    'use server';
    // `id` gizli sahə ilə gəlir — server action-ı closure-dan azad edir,
    // beləcə forma adi POST kimi yoxlana bilir
    // Sahə adları `id`/`action` ola bilməz: `form.id`/`form.action` xassələrini kölgələyir və
    // React basılan düymənin dəyərini FormData-ya qoşa bilmir — qərar itirdi
    const reportId = String(form.get('reportId'));
    const action = String(form.get('decision'));
    const note = String(form.get('note') ?? '').trim();
    const failed = await attempt(() =>
      api(`/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action, ...(note ? { note } : {}) }),
      }),
    );
    // İki moderator eyni şikayətə baxanda ikincisi "artıq bağlanıb" alır — səhifə yıxılmır
    if (failed) redirect(`/reports/${reportId}?error=${encodeURIComponent(failed)}`);
    revalidatePath('/reports');
    redirect('/reports');
  }

  return (
    <Shell current="/reports">
      <Link href="/reports">← Növbəyə qayıt</Link>
      <h1 style={{ marginTop: 12 }}>{REASONS[report.reason] ?? report.reason}</h1>
      <p className="sub">
        {when(report.createdAt)} · {TARGET_LABELS[report.target.type] ?? report.target.type}
        {report.otherReportCount > 0 ? ` · bu kontentə daha ${report.otherReportCount} şikayət var` : ''}
      </p>

      <div className="card">
        <div className="label">{report.target.type === 'user' ? 'Şikayət olunan profil' : 'Şikayət olunan kontent'}</div>
        <p style={{ fontSize: 15, whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>
          {report.target.missing ? 'Kontent tapılmadı (silinib).' : (report.target.text ?? '—')}
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          {report.target.author ? <span className="tag muted">@{report.target.author}</span> : null}
          {report.target.createdAt ? <span className="tag muted">{when(report.target.createdAt)}</span> : null}
          {report.target.deleted ? <span className="tag late">artıq silinib</span> : null}
        </div>
      </div>

      {report.details ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="label">Şikayətçinin izahı</div>
          <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{report.details}</p>
        </div>
      ) : null}

      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="label">Şikayətçi</div>
          <div className="value" style={{ fontSize: 18 }}>
            {report.reporter ? `@${report.reporter.username}` : '—'}
          </div>
        </div>
        <div className="card">
          <div className="label">{report.target.type === 'user' ? 'Hesab' : 'Kontentin müəllifi'}</div>
          <div className="value" style={{ fontSize: 18 }}>
            {report.reportedUser ? (
              <Link href={`/users/${report.reportedUser.username}`}>@{report.reportedUser.username}</Link>
            ) : (
              '—'
            )}
          </div>
          {report.reportedUser ? (
            <div className="label" style={{ marginTop: 6 }}>
              {report.reportedUser.resolvedReportCount} təsdiqlənmiş şikayət ·{' '}
              {report.reportedUser.status === 'suspended' ? 'dayandırılıb' : 'aktiv'}
            </div>
          ) : null}
        </div>
      </div>

      {closed ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="label">Qərar</div>
          <div style={{ marginTop: 6 }}>
            <span className={`tag ${report.status === 'resolved' ? 'ok' : 'muted'}`}>
              {report.status === 'resolved' ? 'Həll olundu' : 'Rədd edildi'}
            </span>{' '}
            {report.resolvedBy ? `— @${report.resolvedBy}` : ''} {when(report.resolvedAt)}
          </div>
        </div>
      ) : (
        <form action={resolve} className="card" style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          <input type="hidden" name="reportId" value={report.publicId} />
          <div>
            <div className="label">Qeyd (audit izinə düşür)</div>
            <textarea name="note" rows={2} placeholder="Qərarın səbəbi" />
          </div>
          {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
          <div className="row">
            <button className="btn ghost" name="decision" value="dismiss" type="submit">
              Şikayəti rədd et
            </button>
            {/* Profil şikayətində silinəcək kontent yoxdur; yer/təcrübə kataloqdur — müəllifi yoxdur */}
            {report.target.type !== 'user' ? (
              <button className="btn" name="decision" value="delete_content" type="submit">
                {report.reportedUser ? 'Kontenti sil' : 'Şikayəti qəbul et'}
              </button>
            ) : null}
            {report.reportedUser ? (
              <button className="btn danger" name="decision" value="suspend_user" type="submit">
                {report.target.type === 'user' ? 'Hesabı dayandır' : 'Kontenti sil + hesabı dayandır'}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </Shell>
  );
}
