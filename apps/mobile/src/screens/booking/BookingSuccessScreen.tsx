import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Loading, Screen, Text } from '@/components';
import { useTicket } from '@/api/hooks/booking';
import { bakuDate, bakuTime } from '@/lib/time';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { errorText } from './parts';

/**
 * Ekran 19 — rezervasiya təsdiqi və bilet.
 * Naviqasiya düymələri biletdən asılı deyil — əvvəl bilet sorğusu uğursuz
 * olanda ekranda heç bir düymə qalmırdı və istifadəçi ilişirdi.
 */
export function BookingSuccessScreen({ route, navigation }: AppScreenProps<'BookingSuccess'>) {
  const { publicId } = route.params;
  const ticket = useTicket(publicId);
  const tk = ticket.data;

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

      <View style={styles.body}>
        {ticket.isLoading ? (
          <Loading label="Bilet hazırlanır…" />
        ) : tk ? (
          <Card padded style={styles.ticket}>
            <Text variant="h3">{tk.title}</Text>

            <View style={styles.rows}>
              <Row label={tk.endAt ? 'Giriş' : 'Tarix'} value={tk.startAt ? bakuDate(tk.startAt) : '—'} />
              {tk.endAt ? (
                <Row label="Çıxış" value={bakuDate(tk.endAt)} />
              ) : (
                <Row label="Vaxt" value={tk.startAt ? `${bakuTime(tk.startAt)} (Bakı vaxtı)` : '—'} />
              )}
              <Row
                label="Nəfər"
                value={`${tk.guests.adults} böyük${tk.guests.children ? ` + ${tk.guests.children} uşaq` : ''}`}
              />
              <Row label="Ödənilib" value={`${tk.totalAzn} AZN`} />
              {tk.subtitle ? <Row label="Təqdim edir" value={tk.subtitle} /> : null}
            </View>

            <View style={styles.dashed} />

            <View style={styles.codeBlock}>
              <Text variant="caption">Bron kodu</Text>
              <Text variant="titleLg" color="green900" style={styles.code} accessibilityLabel={`Bron kodu ${tk.code}`}>
                {tk.code}
              </Text>
            </View>
          </Card>
        ) : (
          <Card padded style={styles.errorCard}>
            <Icon name="info" size={22} color={t.colors.brown700} />
            <View style={styles.flex}>
              <Text variant="h3">Bilet hələ yüklənmədi</Text>
              <Text variant="small" color="ink2">
                Rezervasiyan qeydə alınıb. Bileti bir az sonra "Rezervasiyalarım" bölməsində də aça bilərsən.
              </Text>
              <Text variant="caption" color="muted">
                {errorText(ticket.error)}
              </Text>
            </View>
            <Button label="Yenidən yüklə" size="sm" variant="soft" onPress={() => void ticket.refetch()} />
          </Card>
        )}

        <View style={styles.actions}>
          <Button
            label="Bileti aç"
            onPress={() => navigation.replace('BookingDetail', { publicId })}
            style={styles.wide}
          />
          <Button
            label="Rezervasiyalarım"
            variant="soft"
            onPress={() => navigation.replace('MyBookings')}
            style={styles.wide}
          />
          <Button label="Ana səhifəyə qayıt" variant="ghost" onPress={() => navigation.navigate('Tabs')} style={styles.wide} />
        </View>
      </View>
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
  errorCard: { gap: t.spacing.md, alignItems: 'flex-start' },
  flex: { gap: 4, alignSelf: 'stretch' },
  actions: { gap: t.spacing.sm },
  wide: { width: '100%' },
});
