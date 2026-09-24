import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { insertMessage, socialKeys, type ChatMessage } from '@/api/hooks/social';
import { connectRealtime, disconnectRealtime } from './socket';

/**
 * Canlı hadisələri React Query keşinə tökür — ekranlar ayrıca abunə olmadan
 * yenilənir (zəng nöqtəsi, söhbət siyahısı, açıq çat). Yalnız sessiya
 * olanda render olunur; çıxışda bağlantı bağlanır.
 */
export function RealtimeBridge(): null {
  const qc = useQueryClient();

  useEffect(() => {
    const s = connectRealtime();

    const onNotification = () => void qc.invalidateQueries({ queryKey: ['notifications'] });
    const onMessage = (e: { conversation: string; message: ChatMessage }) => {
      insertMessage(qc, e.conversation, e.message);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    const onConversation = () => void qc.invalidateQueries({ queryKey: ['conversations'] });
    const onRead = (e: { conversation: string }) =>
      void qc.invalidateQueries({ queryKey: socialKeys.messages(e.conversation) });

    s.on('notification.new', onNotification);
    s.on('message.new', onMessage);
    s.on('conversation.updated', onConversation);
    s.on('message.read', onRead);

    return () => {
      s.off('notification.new', onNotification);
      s.off('message.new', onMessage);
      s.off('conversation.updated', onConversation);
      s.off('message.read', onRead);
      disconnectRealtime();
    };
  }, [qc]);

  return null;
}
