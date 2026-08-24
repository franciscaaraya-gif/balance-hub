# BalanceHub - Gestión Inteligente de Deudas

Esta es una aplicación Next.js diseñada para la gestión de deudas grupales, cobros fijos y división de cuentas mediante IA.

## 🚀 Cómo publicar tu aplicación

Para poner esta aplicación en línea, sigue estos pasos:

### 1. Preparar el Repositorio
Asegúrate de que tu código esté en un repositorio de **GitHub**. Si no es así:
- Crea un nuevo repositorio en GitHub.
- Inicializa git localmente: `git init`.
- Agrega los archivos: `git add .`.
- Haz commit: `git commit -m "Initial commit"`.
- Sube el código: `git push origin main`.

### 2. Configurar Firebase App Hosting
Firebase App Hosting es el servicio ideal para esta app.
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Selecciona tu proyecto actual (`studio-469682222-689b2`).
3. En el menú de la izquierda, busca **Compilación** y luego **App Hosting**.
4. Haz clic en **Comenzar** y conecta tu cuenta de GitHub.
5. Selecciona tu repositorio y la rama (usualmente `main` o `master`).
6. Firebase detectará automáticamente la configuración de Next.js.
7. Haz clic en **Finalizar y desplegar**.

### 3. Configuración de Seguridad (Importante)
Una vez desplegada, asegúrate de:
- Habilitar **Google Sign-In** en la sección de Authentication si planeas usarlo en producción.
- Verificar que las **Reglas de Firestore** estén desplegadas desde la pestaña "Reglas" en la consola para proteger tus datos.

## 🛠️ Tecnologías utilizadas
- **Next.js 15** (App Router)
- **Firebase Auth & Firestore**
- **Genkit** (Gemini AI para escaneo de boletas)
- **Shadcn UI & Tailwind CSS**

---
© 2024 BalanceHub. Prototipo generado en Firebase Studio.
