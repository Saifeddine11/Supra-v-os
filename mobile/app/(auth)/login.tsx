/**
 * Connexion — coquille « liquid glass » premium.
 *
 * ⚠️ Le flux d'authentification est INCHANGÉ : même appel signIn()
 * (Supabase signInWithPassword + contrôles profil employé côté hook).
 * Cet écran ne touche qu'à la présentation, aux animations et aux haptics.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { AmbientBackground, GlassCard } from '@/components/glass-card';
import { PrimaryButton } from '@/components/ui';
import { hapticError, hapticLight } from '@/lib/haptics';
import { colors, glass, layout, radius, spacing, type } from '@/constants/theme';
import { supabaseConfigError } from '@/lib/supabase';

/** Entrée douce : opacity + léger translate (native driver). */
function useEntrance(delay: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 460,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [delay, v]);
  return {
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  };
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [submitting, setSubmitting] = useState(false);

  const brandAnim = useEntrance(0);
  const cardAnim = useEntrance(120);
  const hintAnim = useEntrance(260);

  const errorAnim = useRef(new Animated.Value(error ? 1 : 0)).current;
  useEffect(() => {
    const anim = Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [error, errorAnim]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    hapticLight();
    setSubmitting(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      hapticError();
      setError(err);
      return;
    }
    router.replace('/(tabs)');
  };

  const fieldStyle = (name: 'email' | 'password') => [
    styles.input,
    focused === name && styles.inputFocused,
  ];

  return (
    <View style={styles.flex}>
      <AmbientBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.brand, brandAnim]}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brandName}>Supra v OS</Text>
          </Animated.View>

          <Animated.View style={cardAnim}>
            <GlassCard strong borderRadius={radius.lg + 6}>
              <View style={styles.cardInner}>
                <View style={styles.headings}>
                  <Text style={styles.title} accessibilityRole="header">
                    Connexion
                  </Text>
                  <Text style={styles.subtitle}>
                    Accédez à votre espace Supra v OS.
                  </Text>
                </View>

                {error ? (
                  <Animated.View style={[styles.errorBanner, { opacity: errorAnim }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                ) : null}

                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={fieldStyle('email')}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="prenom@agence.com"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    editable={!submitting}
                    returnKeyType="next"
                    accessibilityLabel="Adresse e-mail"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[fieldStyle('password'), styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      placeholder="••••••••"
                      placeholderTextColor={colors.muted}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      editable={!submitting}
                      returnKeyType="go"
                      onSubmitEditing={onSubmit}
                      accessibilityLabel="Mot de passe"
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      }
                      hitSlop={8}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                </View>

                <PrimaryButton
                  title="Se connecter"
                  onPress={onSubmit}
                  loading={submitting}
                  disabled={!canSubmit}
                />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View style={[styles.hintWrap, hintAnim]}>
            <Text style={styles.hint}>Votre accès est fourni par l’équipe Supra.</Text>
            <Text style={styles.hintSmall}>
              Mot de passe oublié ou premier accès ? Passez par l’application web.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  brand: { alignItems: 'center', gap: spacing.sm + 2 },
  logoMark: {
    width: 62,
    height: 62,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.orange, fontSize: 30, fontWeight: '800' },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  cardInner: { padding: spacing.lg, gap: spacing.md },
  headings: { gap: spacing.xs },
  title: { ...type.largeTitle, fontSize: 26 },
  subtitle: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214, 69, 69, 0.28)',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13.5, fontWeight: '500' },
  field: { gap: spacing.xs + 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    // Fond warm + hairline sombre : un fond blanc sur carte blanche rendait
    // les champs quasi invisibles (constaté au simulateur).
    backgroundColor: colors.offWhite,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  inputFocused: {
    borderColor: glass.orangeBorderStrong,
    backgroundColor: colors.white,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: layout.touch + spacing.xs },
  eyeButton: {
    position: 'absolute',
    right: spacing.xs,
    width: layout.touch,
    height: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: { gap: spacing.xs, alignItems: 'center' },
  hint: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  hintSmall: { fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
