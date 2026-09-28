import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Icon, Screen, Text, TopBar, type IconName } from '@/components';
import { useBlockedUsers, useDeleteAccount, useMe, useSettings, useUnblock, useUpdateSettings } from '@/api/hooks/me';
import { useLogout } from '@/api/hooks/auth';
import { applyLanguage } from '@/lib/language';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const LANGS = [
  { code: 'az', label: 'Azərbaycan' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
] as const;

const VISIBILITY = [
  { code: 'public', label: 'Hamı' },
  { code: 'followers', label: 'İzləyicilər' },
  { code: 'private', label: 'Yalnız mən' },
] as const;

/** Bölmə başlığı — sıx siyahıda oxu ritmini saxlayır. */
function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="small" color="muted" style={styles.sectionTitle}>
      {children.toLocaleUpperCase('az')}
    </Text>
  );
}

/** Bölmənin sətirləri bir kartın içində, aralarında nazik bölücü ilə. */
function Group({ children }: { children: React.ReactNode }) {
  return <Card style={styles.group}>{children}</Card>;
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && onPress && styles.pressed]}
    >
      <Icon name={icon} size={20} color={t.colors.ink2} />
      <Text variant="body" style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text variant="small" color="muted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevronRight" size={18} color={t.colors.muted} /> : null}
    </Pressable>
  );
}

/** Dil və məxfilik seçimləri — üç variant sətir kimi, sağda işarə. */
function ChoiceRow({
  label,
  active,
  onPress,
  last,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}
    >
      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>
      {active ? <Icon name="check" size={18} color={t.colors.green700} /> : null}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  last,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
}) {
  // Bütün sətir toxunula bilir — açarın özü 50×30 pikseldir, barmaq üçün kiçikdir.
  // Açar accessibility ağacından çıxarılır ki, sətir bir element kimi oxunsun.
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={t.colors.ink2} />
      <View style={styles.rowLabel}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="meta" color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: t.colors.line, true: t.colors.green700 }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Pressable>
  );
}

/** Ekran 34 — tənzimləmələr: hesab, dil, bildirişlər, məxfilik, hüquqi, çıxış. */
export function SettingsScreen({ navigation }: AppScreenProps<'Settings'>) {
  const me = useMe();
  const settings = useSettings();
  const update = useUpdateSettings();
  const blocked = useBlockedUsers();
  const unblock = useUnblock();
  const logout = useLogout();
  const removeAccount = useDeleteAccount();
  const [blockedOpen, setBlockedOpen] = useState(false);

  const s = settings.data;

  const qc = useQueryClient();

  // Sənəd tətbiqin içində açılır — gezgin.app saytı hələ yoxdur
  const openLegal = (slug: 'terms' | 'privacy') => navigation.navigate('Legal', { slug });

  const confirmLogout = () =>
    Alert.alert('Çıxış', 'Hesabdan çıxmaq istəyirsən?', [
      { text: 'İmtina', style: 'cancel' },
      { text: 'Çıxış', style: 'destructive', onPress: () => logout.mutate() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      'Hesabı silmək?',
      'Paylaşımların, rəylərin və marşrutların anonimləşdiriləcək. Bu əməliyyat geri qaytarılmır.',
      [
        { text: 'İmtina', style: 'cancel' },
        { text: 'Hesabı sil', style: 'destructive', onPress: () => removeAccount.mutate() },
      ],
    );

  return (
    <Screen padded={false}>
      <TopBar title="Tənzimləmələr" onBack={navigation.goBack} />

      <View style={styles.body}>
        <SectionTitle>Hesab</SectionTitle>
        <Group>
          <Row
            icon="user"
            label="Profili redaktə et"
            value={me.data?.username ? `@${me.data.username}` : undefined}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Row
            icon="heart"
            label="Maraqlarım"
            value={`${me.data?.interests.length ?? 0} seçim`}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Row icon="coins" label="Ödəniş üsullarım" onPress={() => navigation.navigate('PaymentMethods')} />
          <Row icon="mail" label="E-mail" value={me.data?.email ?? '—'} last />
        </Group>

        <SectionTitle>Kontent dili</SectionTitle>
        <Text variant="caption" color="muted" style={styles.hint}>
          Məkan, marşrut və region adları seçilmiş dildə göstərilir. Tətbiqin interfeysi hazırda azərbaycancadır.
        </Text>
        <Group>
          {LANGS.map((l, i) => (
            <ChoiceRow
              key={l.code}
              label={l.label}
              active={(s?.language ?? 'az') === l.code}
              last={i === LANGS.length - 1}
              onPress={() => {
                update.mutate({ language: l.code });
                // Kontent (məkan, marşrut, region adları) seçilmiş dildə yenidən yüklənir
                void applyLanguage(l.code, qc);
              }}
            />
          ))}
        </Group>

        <SectionTitle>Bildirişlər</SectionTitle>
        <Group>
          <ToggleRow
            icon="bell"
            label="Push bildirişləri"
            hint="Bəyənmə, şərh, izləyici və rezervasiya"
            value={s?.pushEnabled ?? true}
            onChange={(v) => update.mutate({ pushEnabled: v })}
          />
          <ToggleRow
            icon="mail"
            label="E-mail bildirişləri"
            value={s?.emailEnabled ?? true}
            onChange={(v) => update.mutate({ emailEnabled: v })}
            last
          />
        </Group>

        <SectionTitle>Məxfilik</SectionTitle>
        <Text variant="meta" color="muted" style={styles.hint}>
          Profilini kim görə bilər
        </Text>
        <Group>
          {VISIBILITY.map((v, i) => (
            <ChoiceRow
              key={v.code}
              label={v.label}
              active={(s?.profileVisibility ?? 'public') === v.code}
              last={i === VISIBILITY.length - 1}
              onPress={() => update.mutate({ profileVisibility: v.code })}
            />
          ))}
        </Group>
        <View style={styles.groupGap} />
        <Group>
          <ToggleRow
            icon="pin"
            label="Yerləşmə"
            hint="Check-in və “Yaxınlıqda” lenti üçün"
            value={s?.locationEnabled ?? true}
            onChange={(v) => update.mutate({ locationEnabled: v })}
          />
          <Row
            icon="users"
            label="Bloklanmış hesablar"
            value={`${blocked.data?.length ?? 0}`}
            onPress={() => setBlockedOpen((o) => !o)}
            last
          />
        </Group>
        {blockedOpen ? (
          <View style={styles.blockedList}>
            {blocked.data?.length ? (
              blocked.data.map((b) => (
                <View key={b.username} style={styles.blockedRow}>
                  <Avatar uri={b.avatarUrl} size={36} name={b.fullName} />
                  <View style={styles.rowLabel}>
                    <Text variant="body">{b.fullName}</Text>
                    <Text variant="meta" color="muted">
                      @{b.username}
                    </Text>
                  </View>
                  <Button
                    label="Bloku götür"
                    variant="soft"
                    onPress={() => unblock.mutate(b.username)}
                    style={styles.unblock}
                  />
                </View>
              ))
            ) : (
              <Text variant="small" color="muted" style={styles.empty}>
                Heç kimi bloklamamısan.
              </Text>
            )}
          </View>
        ) : null}

        <SectionTitle>Yükləmə</SectionTitle>
        <Group>
          <ToggleRow
            icon="download"
            label="Yalnız Wi-Fi ilə yüklə"
            hint="Offline xəritə paketləri"
            value={s?.wifiOnlyDownload ?? true}
            onChange={(v) => update.mutate({ wifiOnlyDownload: v })}
            last
          />
        </Group>

        <SectionTitle>Hüquqi</SectionTitle>
        <Group>
          <Row icon="info" label="İstifadə şərtləri" onPress={() => openLegal('terms')} />
          <Row icon="lock" label="Məxfilik siyasəti" onPress={() => openLegal('privacy')} last />
        </Group>

        <View style={styles.footer}>
          <Button block label="Çıxış" variant="outline" onPress={confirmLogout} loading={logout.isPending} />
          <Button block label="Hesabı sil" variant="ghost" textColor={t.colors.danger} onPress={confirmDelete} loading={removeAccount.isPending} />
          <Text variant="meta" color="muted" style={styles.version}>
            GEZGIN 1.0.0
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: t.spacing.page, paddingTop: 0 },
  sectionTitle: { marginTop: t.spacing.xl, marginBottom: t.spacing.sm, letterSpacing: 0.6 },
  hint: { marginBottom: t.spacing.sm, marginTop: -t.spacing.xs },
  group: { paddingHorizontal: t.spacing.lg, overflow: 'hidden' },
  groupGap: { height: t.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: 14 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
  pressed: { opacity: 0.6 },
  rowLabel: { flex: 1, gap: 2 },
  rowValue: { maxWidth: 170 },
  blockedList: { paddingVertical: t.spacing.sm, gap: t.spacing.md },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  unblock: { paddingHorizontal: t.spacing.md },
  empty: { paddingVertical: t.spacing.md },
  footer: { marginTop: t.spacing.xxl, gap: t.spacing.md, alignItems: 'stretch' },
  version: { textAlign: 'center', marginTop: t.spacing.sm },
});
