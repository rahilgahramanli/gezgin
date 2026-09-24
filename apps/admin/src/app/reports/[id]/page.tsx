import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
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

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await api<ReportDetail>(`/admin/reports/${id}`);
  const closed = report.status === 'resolved' || report.status === 'rejected';

  async function resolve(form: FormData) {
    'use server';
    // `id` gizli sahə ilə gəlir — server action-ı closure-dan azad edir,
    // beləcə forma adi POST kimi yoxlana bilir
    const reportId = String(form.get('id'));
    const action = String(form.get('action'));
    const note = String(form.get('note') ?? '').trim();
    await api(`/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, ...(note ? { note } : {}) }),
    });
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
        <div className="label">Şikayət olunan kontent</div>
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
          <div className="label">Kontentin müəllifi</div>
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
          <input type="hidden" name="id" value={report.publicId} />
          <div>
            <div className="label">Qeyd (audit izinə düşür)</div>
            <textarea name="note" rows={2} placeholder="Qərarın səbəbi" />
          </div>
          <div className="row">
            <button className="btn ghost" name="action" value="dismiss" type="submit">
              Şikayəti rədd et
            </button>
            <button className="btn" name="action" value="delete_content" type="submit">
              Kontenti sil
            </button>
            <button className="btn danger" name="action" value="suspend_user" type="submit">
              Kontenti sil + hesabı dayandır
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}
