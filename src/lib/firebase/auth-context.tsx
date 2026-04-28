
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
      if (currentUser) {
        try {
          // Intentar obtener el perfil
          let p = await getUserProfile(currentUser.uid);
          
          // Si no existe (primer login con Google por ejemplo), crearlo
          if (!p) {
            await createUserProfile(
              currentUser.uid, 
              currentUser.email || "", 
              currentUser.displayName || "Usuario"
            );
            p = await getUserProfile(currentUser.uid);
          }
          
          setProfile(p);
          setUser(currentUser);
        } catch (error) {
          console.error("Error al sincronizar perfil:", error);
          setUser(currentUser); // Al menos mantenemos la sesión de auth
        }
      } else {
        setUser(null);
        setProfile(null);
      }
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
