import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/**
 * Canlı hadisələrin tək çıxış nöqtəsi.
 *
 * Hər istifadəçi qoşulanda öz `user:<publicId>` otağına girir; servislər
 * gateway-dən asılı olmadan bu otağa göndərir. Server hələ qalxmayıbsa
 * (məs. testdə `listen` çağırılmayıb) hadisə səssizcə atılır.
 */
@Injectable()
export class RealtimeService {
  private server: Namespace | null = null;

  attach(server: Namespace): void {
    this.server = server;
  }

  /** Ekran 09 başlığındakı "onlayn" — istifadəçinin ən azı bir açıq socket-i var. */
  async isOnline(userPublicId: string): Promise<boolean> {
    if (!this.server) return false;
    const sockets = await this.server.in(`user:${userPublicId}`).fetchSockets();
    return sockets.length > 0;
  }

  /** Payload-da BigInt olmamalıdır — socket.io JSON-u onu seriallaşdıra bilmir. */
  emitToUser(userPublicId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userPublicId}`).emit(event, payload);
  }
}
