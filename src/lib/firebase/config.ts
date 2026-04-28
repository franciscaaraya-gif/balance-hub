import { initializeFirebase } from "@/firebase";

// Centralizamos la inicialización para evitar múltiples instancias de Firebase
const { firebaseApp, auth, firestore: db } = initializeFirebase();

export { auth, db, firebaseApp as app };
