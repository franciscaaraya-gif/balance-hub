# BalanceHub - Gestión Inteligente de Deudas

Esta es una aplicación Next.js diseñada para la gestión de deudas grupales, cobros fijos y división de cuentas mediante IA.

## 🚀 Cómo publicar tu aplicación

Para poner esta aplicación en línea, sigue estos pasos:

### 1. Preparar el Repositorio en GitHub
Primero, crea un repositorio vacío en [GitHub](https://github.com/new). Luego, ejecuta estos comandos en tu terminal desde la carpeta raíz del proyecto:

```bash
# Inicializar el repositorio local
git init

# Agregar todos los archivos
git add .

# Crear el primer commit
git commit -m "Initial commit - BalanceHub"

# Renombrar la rama a main (opcional pero recomendado)
git branch -M main

# Conectar con tu repositorio de GitHub (reemplaza con TU URL)
# Ejemplo: git remote add origin https://github.com/tu-usuario/balance-hub.git
git remote add origin <TU_URL_DE_GITHUB>

# Subir el código
git push -u origin main
```

### 2. Configurar Firebase App Hosting
Firebase App Hosting es el servicio ideal para esta app.
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Selecciona tu proyecto actual (`studio-469682222-689b2`).
3. En el menú de la izquierda, busca **Compilación** y luego **App Hosting**.
4. Haz clic en **Comenzar** y conecta tu cuenta de GitHub.
5. Selecciona el repositorio que acabas de crear y la rama `main`.
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
