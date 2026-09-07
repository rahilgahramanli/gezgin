import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM') ?? 'GEZGIN <no-reply@gezgin.app>';
    const user = this.config.get<string>('MAIL_USER');
    this.transporter = createTransport({
      host: this.config.get<string>('MAIL_HOST'),
      port: this.config.get<number>('MAIL_PORT'),
      secure: false,
      ...(user ? { auth: { user, pass: this.config.get<string>('MAIL_PASSWORD') } } : {}),
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (e) {
      // E-mail göndərilməməsi əməliyyatı bloklamamalıdır — loglayıb davam edirik.
      this.logger.error(`E-mail göndərilmədi (${to}): ${(e as Error).message}`);
    }
  }

  async sendOtp(to: string, code: string, purpose: string): Promise<void> {
    const titles: Record<string, string> = {
      register: 'Qeydiyyatı tamamla',
      login: 'Girişi təsdiqlə',
      password_reset: 'Şifrəni bərpa et',
      email_change: 'E-mail dəyişikliyini təsdiqlə',
    };
    const title = titles[purpose] ?? 'Təsdiq kodu';
    await this.send(
      to,
      `GEZGIN — ${title}`,
      `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="font-size:24px;font-weight:700;color:#0F3D3A;letter-spacing:-.5px">GEZGIN</div>
        <p style="color:#6B7776;font-size:14px;margin:4px 0 28px">Gəz, yaşa, paylaş!</p>
        <h1 style="font-size:20px;color:#182726;margin:0 0 8px">${title}</h1>
        <p style="color:#2E3D3C;font-size:15px;line-height:1.6;margin:0 0 24px">Təsdiq kodun:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0F3D3A;background:#E4EEEB;padding:20px;border-radius:14px;text-align:center">${code}</div>
        <p style="color:#6B7776;font-size:13px;margin:24px 0 0">Kod 10 dəqiqə ərzində etibarlıdır. Bu sorğunu sən etməmisənsə, bu məktubu nəzərə alma.</p>
      </div>`,
    );
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.send(
      to,
      'GEZGIN-ə xoş gəldin!',
      `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="font-size:24px;font-weight:700;color:#0F3D3A">GEZGIN</div>
        <h1 style="font-size:20px;color:#182726;margin:24px 0 8px">Xoş gəldin, ${name}!</h1>
        <p style="color:#2E3D3C;font-size:15px;line-height:1.6">Hər səyahət bir hekayədir. Maraqlarını seç, ilk marşrutunu qur və kəşf etməyə başla — hər addımda XP qazanacaqsan.</p>
      </div>`,
    );
  }
}
