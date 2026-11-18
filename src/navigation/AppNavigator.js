import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import PlanScreen from '../screens/PlanScreen';
import ChatScreen from '../screens/ChatScreen';
import CirculosScreen from '../screens/CirculosScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS = {
  Inicio: 'home-outline',
  Plan: 'restaurant-outline',
  Asistente: 'chatbubble-ellipses-outline',
  Círculos: 'people-outline',
  Perfil: 'person-outline',
};

export default function AppNavigator() {
  // En navegadores móviles (sobre todo Safari en iOS) la barra de
  // direcciones puede quedar encima del contenido fijo al fondo de la
  // pantalla si no se le resta el "safe area inset" inferior — por eso el
  // menú se veía recortado en web. `insets.bottom` ya trae ese valor
  // calculado (en nativo normalmente es 0, salvo iPhone con home indicator).
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 56 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 6,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Plan" component={PlanScreen} />
      <Tab.Screen name="Asistente" component={ChatScreen} />
      <Tab.Screen name="Círculos" component={CirculosScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
