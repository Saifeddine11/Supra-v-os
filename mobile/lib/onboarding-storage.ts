/**
 * Indicateur local « onboarding vu » — booléen non sensible.
 *
 * Stocké via expo-secure-store (déjà utilisé pour la session) afin de ne pas
 * ajouter de dépendance. AsyncStorage n'est pas installé dans le projet.
 *
 * ⚠️ iOS : le trousseau (keychain) peut survivre à une désinstallation de
 * l'app ; un « fresh install » sur le même appareil peut donc conserver le
 * flag et sauter l'onboarding. Comportement identique à la session Supabase
 * (déjà en SecureStore). Voir resetOnboarding() pour un reset manuel.
 */
import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'supra_mobile_onboarding_completed_v1';

export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === 'true';
  } catch {
    // Stockage indisponible : ne jamais bloquer l'accès à l'app.
    return true;
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, 'true');
  } catch {
    // Échec silencieux : l'onboarding se réaffichera, sans casser la nav.
  }
}

/** Reset manuel (debug / QA). Non exposé dans l'UI. */
export async function resetOnboarding(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* no-op */
  }
}

/** État du flag pour la porte d'entrée (app/index.tsx). */
export function useOnboardingStatus() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    let mounted = true;
    isOnboardingCompleted()
      .then((done) => {
        if (mounted) setCompleted(done);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const complete = useCallback(async () => {
    setCompleted(true);
    await setOnboardingCompleted();
  }, []);

  return { loading, completed, complete };
}
