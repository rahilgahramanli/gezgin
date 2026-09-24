import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { JwtPayload } from '@/modules/auth/token.service';
import { RealtimeService } from './realtime.service';

/** Socket-ə bağlı istifadəçi. `id` sətirdir — BigInt socket.io JSON-una sığmır. */
export interface SocketUser {
  id: string;
  publicId: string;
  username: string;
}

/**
 * WebSocket — `/ws` namespace-i (TECH-PLAN §5 hadisələri).
 *
 * Token handshake-də gəlir: `io(url, { auth: { token } })`. Göndərmə HTTP
 * ilə gedir (POST /conversations/:id/messages) — socket yalnız çatdırma
 * kanalıdır. Beləliklə mesaj bazaya yazılmadan heç kimə getmir.
 */
@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit<Namespace>, OnGatewayConnection<Socket> {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Namespace): void {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) return this.reject(client, ERROR_CODES.UNAUTHORIZED, 'Token göndərilməyib');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch (e) {
      const expired = (e as { name?: string }).name === 'TokenExpiredError';
      return this.reject(
        client,
        expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.UNAUTHORIZED,
        expired ? 'Token vaxtı bitib' : 'Token etibarsızdır',
      );
    }
    if (payload.guest) return this.reject(client, ERROR_CODES.FORBIDDEN, 'Çat üçün hesab yaratmalısınız');

    const user = await this.prisma.user.findUnique({
      where: { publicId: payload.sub },
      select: { id: true, publicId: true, username: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.status !== 'active') {
      return this.reject(client, ERROR_CODES.UNAUTHORIZED, 'Hesab aktiv deyil');
    }

    const socketUser: SocketUser = { id: user.id.toString(), publicId: user.publicId, username: user.username };
    client.data.user = socketUser;
    await client.join(`user:${user.publicId}`);
    client.emit('ready', { username: user.username });
  }

  /** Ekran 09 "yazır…" — yalnız söhbət iştirakçılarına ötürülür. */
  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversation?: unknown; isTyping?: unknown },
  ): Promise<void> {
    const me = client.data.user as SocketUser | undefined;
    if (!me || typeof body?.conversation !== 'string') return;

    const members = await this.prisma.conversationParticipant.findMany({
      where: { conversation: { publicId: body.conversation } },
      select: { user: { select: { id: true, publicId: true } } },
    });
    if (!members.some((m) => m.user.id.toString() === me.id)) return;

    for (const m of members) {
      if (m.user.publicId === me.publicId) continue;
      this.realtime.emitToUser(m.user.publicId, 'typing', {
        conversation: body.conversation,
        username: me.username,
        isTyping: body.isTyping !== false,
      });
    }
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth) return fromAuth.replace(/^Bearer\s+/i, '');
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }

  private reject(client: Socket, code: string, message: string): void {
    client.emit('exception', { code, message });
    client.disconnect(true);
  }
}
