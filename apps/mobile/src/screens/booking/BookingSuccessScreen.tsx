import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Loading, Screen, Text } from '@/components';
import { useTicket } from '@/api/hooks/booking';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 19 — rezervasiya təsdiqi və bilet. */
export function BookingSuccessScreen({ route, navigation }: AppScreenProps<'BookingSuccess'>) {
  const { publicId } = route.params;
  const ticket = useTicket(publicId);

  if (ticket.isLoading) return <Loading label="Bilet hazırlanır…" />;

  return (
    <Screen padded={false}>
      <View style={styles.hero}>
        <View style={styles.check}>
          <Icon name="check" size={40} color="#fff" strokeWidth={2.6} />
        </View>
        <Text variant="titleLg" center style={styles.title}>
          Rezervasiya təsdiqləndi!
        </Text>
        <Text variant="meta" center>
          Planla, yola çıx, xatirələr topla
        </Text>
      </View>

      {ticket.data ? (
        <View style={styles.body}>
          <Card padded style={styles.ticket}>
            <Text variant="h3">{ticket.data.title}</Text>

            <View style={styles.rows}>
              <Row label="Tarix" value={ticket.data.startAt ? ticket.data.startAt.slice(0, 10) : '—'} />
              <Row
                label="Vaxt"
                value={ticket.data.startAt ? ticket.data.startAt.slice(11, 16) : '—'}
              />
              <Row
                label="Nəfər"
                value={`${ticket.data.guests.adults} böyük${ticket.data.guests.children ? ` + ${ticket.data.guests.children} uşaq` : ''}`}
              />
              <Row label="Ödənilib" value={`${ticket.data.totalAzn} AZN`} />
              {ticket.data.subtitle ? <Row label="Təqdim edir" value={ticket.data.subtitle} /> : null}
            </View>

            <View style={styles.dashed} />

            <View style={styles.codeBlock}>
              <Text variant="caption">Bron kodu</Text>
              <Text variant="titleLg" color="green900" style={styles.code}>
                {ticket.data.code}
              </Text>
            </View>
          </Card>

          <View style={styles.actions}>
            <Button
              label="Rezervasiyalarım"
              variant="soft"
              onPress={() => navigation.replace('MyBookings')}
            />
            <Button
              label="Ana səhifəyə qayıt"
              variant="ghost"
              onPress={() => navigation.navigate('Tabs')}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="meta">{label}</Text>
      <Text variant="body" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: t.spacing.xxl, paddingHorizontal: t.spacing.page, gap: 4 },
  check: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.md,
  },
  title: { marginTop: 4 },
  body: { paddingHorizontal: t.spacing.page, marginTop: t.spacing.xl, gap: t.spacing.lg },
  ticket: { gap: t.spacing.md },
  rows: { gap: t.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.md },
  rowValue: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  dashed: { borderTopWidth: 1.5, borderTopColor: t.colors.line, borderStyle: 'dashed', marginVertical: 4 },
  codeBlock: { alignItems: 'center', gap: 2 },
  code: { letterSpacing: 2 },
  actions: { gap: t.spacing.sm },
});
