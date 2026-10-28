import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Recordatorio diario local para que el usuario vuelva a abrir la app — es la
// otra mitad de la decisión de generar el plan día por día (no la semana
// completa de un jalón): sin esto, nada le avisa al usuario que ya puede
// generar el plan de hoy y el cambio pierde parte de su sentido.
//
// Es una notificación LOCAL (programada en el propio teléfono), no push desde
// el backend — no depende de que el backend esté corriendo ni de internet, y
// es lo único práctico en Expo Go (el push remoto real requiere un build de
// desarrollo con EAS, fuera de alcance del proyecto).
//
// La hora y si está activo o no se guardan en el dispositivo (Ajustes en
// Perfil) — por defecto es a las 9am y está activado.

const REMINDER_IDENTIFIER = 'daily-plan-reminder';
const PREFERENCE_KEY = 'nutricion:reminderPreference';
const DEFAULT_PREFERENCE = { enabled: true, hour: 9 };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getReminderPreference() {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCE, ...JSON.parse(raw) };
  } catch {
    // si falla la lectura, se usa el default — no es crítico
  }
  return { ...DEFAULT_PREFERENCE };
}

// Pide permiso y programa el recordatorio a la hora dada. Programar de nuevo
// con el mismo identifier reemplaza al anterior en vez de sumar otro, así que
// se puede llamar cada vez que arranca la app sin duplicar notificaciones.
export async function scheduleDailyReminder(hour = DEFAULT_PREFERENCE.hour) {
  try {
    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: 'Tu plan de hoy te espera 🍽️',
        body: 'Abre la app para generar tu plan nutricional de hoy.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute: 0,
        repeats: true,
      },
    });
    return true;
  } catch {
    // Un fallo aquí (ej. permisos negados, simulador sin soporte) nunca debe
    // tumbar el flujo de la app — el recordatorio es una mejora, no algo
    // crítico para que la app funcione.
    return false;
  }
}

export async function cancelDailyReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
  } catch {
    // no pasa nada si no había nada programado
  }
}

// Lee la preferencia guardada (o el default) y programa/cancela según
// corresponda — pensado para llamarse al arrancar la app o iniciar sesión.
export async function applyStoredReminderPreference() {
  const preference = await getReminderPreference();
  if (preference.enabled) {
    await scheduleDailyReminder(preference.hour);
  } else {
    await cancelDailyReminder();
  }
  return preference;
}

// Se llama desde Ajustes cuando el usuario cambia la hora o activa/desactiva
// el recordatorio — guarda la preferencia y la aplica de inmediato.
export async function setReminderPreference(preference) {
  try {
    await AsyncStorage.setItem(PREFERENCE_KEY, JSON.stringify(preference));
  } catch {
    // si no se pudo guardar, se aplica igual para esta sesión
  }
  if (preference.enabled) {
    await scheduleDailyReminder(preference.hour);
  } else {
    await cancelDailyReminder();
  }
}
