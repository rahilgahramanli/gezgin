import type { IconName } from './Icon';
import { useT } from '@/i18n';
import { Button } from './Button';
import { EmptyState } from './Screen';
import { useAuth } from '@/store/auth';

/**
 * Qonağa bağlı bölmə (Planım, Mesajlar, İstəklərim): boş siyahı əvəzinə
 * niyə boş olduğunu deyir və birbaşa qeydiyyata aparır.
 */
export function GuestEmpty({ title, message, icon = 'user' }: { title: string; message: string; icon?: IconName }) {
  const upgrade = useAuth((s) => s.upgradeGuest);
  const { t } = useT();
  return (
    <EmptyState
      icon={icon}
      title={title}
      message={message}
      action={<Button label={t('actions.createAccount')} onPress={() => void upgrade()} />}
    />
  );
}
