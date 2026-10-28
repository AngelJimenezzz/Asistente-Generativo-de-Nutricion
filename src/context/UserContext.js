import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { applyStoredReminderPreference, cancelDailyReminder } from '../utils/notifications';

const USER_ID_KEY = 'nutricion:userId';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storedId = await AsyncStorage.getItem(USER_ID_KEY);
      let currentUser = null;

      if (storedId) {
        try {
          currentUser = await api.getUser(storedId);
          // No se espera (await) a propósito: si el usuario niega el permiso
          // o tarda, no debe retrasar la carga de la app.
          applyStoredReminderPreference();
        } catch (err) {
          // El id guardado ya no existe en el backend (ej. se reinició la base
          // de datos de desarrollo) — se pide el registro de nuevo.
          await AsyncStorage.removeItem(USER_ID_KEY);
          currentUser = null;
        }
      }

      setUser(currentUser);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Se llama desde la pantalla de registro (nueva cuenta) o desde "editar perfil"
  // (cuenta existente). Decide sola si debe crear o actualizar en el backend.
  const submitOnboarding = useCallback(
    async (formData) => {
      const payload = { ...formData, onboardingComplete: true };
      let saved = user ? await api.updateUser(user.id, payload) : await api.createUser(payload);
      await AsyncStorage.setItem(USER_ID_KEY, saved.id);
      applyStoredReminderPreference();
      setUser(saved);
      setEditingProfile(false);
      return saved;
    },
    [user]
  );

  const needsOnboarding = !loading && !error && (!user || !user.onboardingComplete || editingProfile);

  // Cierra sesión: borra el id guardado en el dispositivo y limpia el estado,
  // así el siguiente arranque pide el registro de nuevo (permite crear otro
  // perfil sin reinstalar la app ni tocar la base de datos).
  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(USER_ID_KEY);
    await cancelDailyReminder();
    setUser(null);
    setEditingProfile(false);
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        needsOnboarding,
        refresh: bootstrap,
        submitOnboarding,
        startEditingProfile: () => setEditingProfile(true),
        cancelEditingProfile: () => setEditingProfile(false),
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser debe usarse dentro de <UserProvider>');
  return ctx;
}
