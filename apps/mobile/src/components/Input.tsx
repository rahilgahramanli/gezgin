import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { t } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  error?: string | null;
  /** Şifrə sahələri üçün göz düyməsi. */
  secure?: boolean;
  right?: React.ReactNode;
}

export function Input({ label, icon, error, secure, right, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure ?? false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="small" color="ink2" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View style={[styles.field, focused && styles.focused, !!error && styles.errored]}>
        {icon ? <Icon name={icon} size={20} color={t.colors.muted} /> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={t.colors.muted}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Icon name="eye" size={20} color={t.colors.muted} filled={!hidden} />
          </Pressable>
        ) : null}
        {right}
      </View>

      {error ? (
        <Text variant="small" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: t.spacing.sm },
  label: { fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    height: 52,
    paddingHorizontal: t.spacing.lg,
    backgroundColor: t.colors.paper,
    borderWidth: 1,
    borderColor: t.colors.line,
    borderRadius: t.radius.md,
  },
  focused: { borderColor: t.colors.green900 },
  errored: { borderColor: t.colors.danger },
  input: { flex: 1, fontSize: 15, color: t.colors.ink, padding: 0 },
  error: { marginTop: -2 },
});
