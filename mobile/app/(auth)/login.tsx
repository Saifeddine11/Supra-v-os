import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { ErrorBanner, PrimaryButton } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { supabaseConfigError } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.brandMark}>SUPRA</Text>
          <Text style={styles.brandSub}>Agency OS — Mobile</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Utilisez vos identifiants Supra OS habituels.
          </Text>

          {error ? <ErrorBanner message={error} /> : null}

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="prenom@agence.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!submitting}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="password"
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          </View>

          <PrimaryButton
            title="Se connecter"
            onPress={onSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />

          <Text style={styles.hint}>
            Mot de passe oublié ou premier accès ? Passez par l’application web.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  brandMark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.black,
  },
  brandSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.orange,
    fontWeight: '600',
    letterSpacing: 1,
  },
  form: { gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: -spacing.sm },
  field: { gap: spacing.xs + 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.black },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.black,
  },
  hint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
