import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Icon, Text, type IconName } from '@/components';
import { ApiError, api } from '@/api/client';
import {
  REPORT_REASONS, useConversations, useDeletePost, useReportPost, useSharePost, type ConversationItem, type Post,
} from '@/api/hooks/social';
import { t } from '@/theme';
import { useT } from '@/i18n';

interface Props {
  post: Post | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Ekran 43 — paylaş paneli.
 *
 * "Linki kopyala" ayrıca düymə deyil: sistem paylaşma pəncərəsində (Digər
 * tətbiqlər) "Kopyala" var — clipboard üçün əlavə native modul lazım olmur.
 */
export function ShareSheet({ post, onClose, onDeleted }: Props) {
  const { t: tr } = useT('social');
  const [step, setStep] = useState<'main' | 'report'>('main');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const qc = useQueryClient();
  const conversations = useConversations('all');
  const share = useSharePost();
  const report = useReportPost();
  const remove = useDeletePost();

  const close = () => {
    setStep('main');
    onClose();
  };

  if (!post) return null;

  const link = async () => (await share.mutateAsync(post.publicId)).shareUrl;
  const quick = (conversations.data?.data ?? []).filter((c) => c.other).slice(0, 6);

  const sendTo = async (c: ConversationItem) => {
    setSendingTo(c.publicId);
    try {
      const url = await link();
      await api(`/conversations/${c.publicId}/messages`, {
        method: 'POST',
        body: { body: tr('shareSheet.messageBody', { name: post.author.fullName, url }) },
      });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      Alert.alert(tr('shareSheet.sentTitle'), tr('shareSheet.sentMessage', { name: c.title }));
      close();
    } catch (e) {
      Alert.alert(tr('shared.sendFailed'), e instanceof ApiError ? e.message : tr('shared.tryAgain'));
    } finally {
      setSendingTo(null);
    }
  };

  const shareExternal = async () => {
    try {
      const url = await link();
      await Share.share({ message: tr('shareSheet.externalMessage', { name: post.author.fullName, url }), url });
      close();
    } catch {
      // İstifadəçi pəncərəni bağlayıb — xəta deyil
    }
  };

  const sendReport = (reason: string) =>
    report.mutate(
      { publicId: post.publicId, reason },
      {
        onSuccess: (res) => {
          Alert.alert(
            tr('shared.thanks'),
            res.duplicate ? tr('shareSheet.reportDuplicate') : tr('shared.reportSent'),
          );
          close();
        },
        onError: (e) => Alert.alert(tr('shared.sendFailed'), e instanceof ApiError ? e.message : tr('shared.tryAgain')),
      },
    );

  const confirmDelete = () =>
    Alert.alert(tr('shareSheet.deletePost'), tr('shareSheet.deleteMessage'), [
      { text: tr('common:actions.cancel'), style: 'cancel' },
      {
        text: tr('common:actions.delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(post.publicId, {
            onSuccess: () => {
              close();
              onDeleted?.();
            },
          }),
      },
    ]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {step === 'report' ? (
          <View style={styles.section}>
            <Text variant="h2">{tr('shared.whyReport')}</Text>
            {REPORT_REASONS.map((r) => (
              <Row key={r.code} icon="flag" label={r.label} onPress={() => sendReport(r.code)} />
            ))}
            <Button label={tr('common:actions.back')} variant="ghost" onPress={() => setStep('main')} />
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="h2">{tr('common:actions.share')}</Text>

            {quick.length ? (
              <View>
                <Text variant="small" color="muted" style={styles.caption}>
                  {tr('shareSheet.quickSend')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
                  {quick.map((c) => (
                    <Pressable key={c.publicId} style={styles.quickItem} onPress={() => void sendTo(c)} disabled={!!sendingTo}>
                      <Avatar uri={c.other?.avatarUrl} size={52} name={c.other?.fullName} />
                      <Text variant="caption" numberOfLines={1}>
                        {sendingTo === c.publicId ? tr('shareSheet.sending') : c.title.split(' ')[0]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Row icon="share" label={tr('shareSheet.otherApps')} onPress={() => void shareExternal()} />
            {post.viewer.isMine ? (
              <Row icon="trash" label={tr('shareSheet.deletePost')} danger onPress={confirmDelete} />
            ) : (
              <Row icon="flag" label={tr('shared.report')} danger onPress={() => setStep('report')} />
            )}
            <Button label={tr('shared.cancel')} variant="soft" onPress={close} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function Row({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon name={icon} size={19} color={danger ? t.colors.danger : t.colors.green900} />
      </View>
      <Text variant="body" color={danger ? 'danger' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,20,0.45)' },
  sheet: {
    backgroundColor: t.colors.paper, borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl,
    paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm, paddingBottom: 36,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.line, marginBottom: t.spacing.md },
  section: { gap: t.spacing.md },
  caption: { marginBottom: t.spacing.sm },
  quick: { gap: t.spacing.lg },
  quickItem: { alignItems: 'center', gap: 4, width: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: 4 },
  rowIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: '#FBE9E7' },
});
