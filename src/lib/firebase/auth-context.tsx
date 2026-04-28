"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./config";
import { getUserProfile, createUserProfile } from "./store";
import { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Establecemos el usuario inmediatamente para desbloquear el estado 'loading'
      setUser(currentUser);
      
      if (currentUser) {
        // La carga del perfil no debe bloquear el estado inicial de la app
        try {
          let p = await getUserProfile(currentUser.uid);
          if (!p) {
            await createUserProfile(
              currentUser.uid, 
              currentUser.email || "", 
              currentUser.displayName || "Usuario"
            );
            p = await getUserProfile(currentUser.uid);
          }
          setProfile(p);
        } catch (error) {
          console.error("Error al sincronizar perfil:", error);
        }
      } else {
        setProfile(null);
      }
      
      // Una vez que Firebase Auth nos dice si hay alguien o no, dejamos de cargar
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);