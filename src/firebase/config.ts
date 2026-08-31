import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  projectId: "studio-469682222-689b2",
  appId: "1:590161106310:web:b9d094e5690f3085594807",
  apiKey: "AIzaSyD_qr2yNkeoxTDw6ngEEkSp361WaOOTilo",
  authDomain: "studio-469682222-689b2.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "590161106310",
};

// Reutiliza la app ya inicializada (por ejemplo, por src/firebase/index.ts)
// si existe; si no, la crea. Esto evita tener dos instancias de Firebase
// desincronizadas dentro de la misma aplicación.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);