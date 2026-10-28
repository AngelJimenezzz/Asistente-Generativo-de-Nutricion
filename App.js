import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RootGate from './src/navigation/RootGate';
import { UserProvider } from './src/context/UserContext';
import { PlanProvider } from './src/context/PlanContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <UserProvider>
        <PlanProvider>
          <NavigationContainer>
            <RootGate />
          </NavigationContainer>
        </PlanProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
