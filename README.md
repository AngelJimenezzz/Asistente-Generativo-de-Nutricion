# Starter de la app — Asistente de Nutrición

Este paquete contiene el código fuente (App.js + carpeta `src/`) de las 5 pantallas
núcleo, ya navegables entre sí, trabajando con datos de ejemplo (`src/data/mockData.js`)
mientras el backend (Fase 2-3 del roadmap) no esté listo.

## 1. Crear el proyecto Expo (en tu terminal, dentro de tu repo)

```bash
npx create-expo-app nutri-app
cd nutri-app
```

## 2. Instalar dependencias de navegación e íconos

```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
```

(`@expo/vector-icons` y `expo-status-bar` ya vienen incluidos en cualquier proyecto Expo,
no hace falta instalarlos aparte.)

## 3. Copiar este código a tu proyecto

- Reemplaza el `App.js` que generó Expo por el `App.js` de este paquete.
- Copia la carpeta `src/` completa dentro de la raíz de `nutri-app/`.

## 4. Correr la app

```bash
npx expo start
```

Escanea el código QR con la app **Expo Go** en tu celular (Android/iOS) o presiona
`i` / `a` en la terminal para abrir un simulador si lo tienes configurado.

## Qué vas a ver

- **Inicio**: racha de constancia, resumen del plan del día, logros/insignias
- **Plan**: comidas del día con explicabilidad clínica ("¿Por qué este alimento?"),
  y accesos (por ahora simulados con una alerta) al Plan B y a la sustitución por presupuesto
- **Asistente**: chat con respuesta simulada — aquí se conecta después tu endpoint de
  FastAPI (RAG + guardrails + modelo LoRA)
- **Círculos**: constancia del grupo (rachas), nunca peso ni medidas corporales, y el
  reto semanal del círculo
- **Perfil**: datos del usuario, condición clínica, presupuesto, racha

## Siguiente paso

Cuando tengas el backend de FastAPI corriendo, reemplaza los datos de
`src/data/mockData.js` y el `TODO` en `src/screens/ChatScreen.js` por llamadas reales
con `fetch` o `axios` a tus endpoints.
