import { initializeFirebase } from "@/firebase";

// Usamos la inicialización centralizada que ya tiene la configuración correcta
const { firebaseApp, auth, firestore: db } = initializeFirebase();

export { auth, db, firebaseApp as app };
