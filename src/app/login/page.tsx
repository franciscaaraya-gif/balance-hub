"use client";

import { useState, useEffect, Suspense } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useUser } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCcw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createUserProfile, getUserProfile } from "@/lib/firebase/store";
import { Logo } from "@/components/logo";

function LoginContent() {
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isUserLoading) setShowReset(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isUserLoading]);

  useEffect(() => {
    if (user && !isUserLoading && !isSubmitting) {
      router.push(redirectTo);
    }
  }, [user, isUserLoading, router, redirectTo, isSubmitting]);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        // REQUISITO: Verificar si es una cuenta nueva o existente
        const existingProfile = await getUserProfile(result.user.uid);
        
        // Determinar si viene de un contexto legítimo de invitación
        const hasInviteContext = redirectTo.includes("/join/") || redirectTo.includes("/attendance/join/");

        if (!existingProfile && !hasInviteContext) {
          // Es un usuario nuevo sin invitación -> Rechazar acceso y limpiar auth
          toast({
            variant: "destructive",
            title: "Acceso Restringido",
            description: "Zygos funciona solo por invitación. Pídele a un amigo que ya use la app que te comparta un link de grupo o evento."
          });
          
          try {
            await result.user.delete();
          } catch (deleteError) {
            console.error("Error al remover cuenta huérfana de auth:", deleteError);
          }
          
          await signOut(auth);
          setIsSubmitting(false);
          return;
        }

        // Si es nuevo pero tiene invitación válida, creamos su perfil
        if (!existingProfile) {
          await createUserProfile(
            result.user.uid,
            result.user.email || "",
            result.user.displayName || "Usuario de Google"
          );
        }

        toast({ title: "¡Bienvenido!", description: "Sesión iniciada con Google." });
        router.push(redirectTo);
      }
    } catch (error: any) {
      console.error("Error en Google Login:", error);
      toast({ variant: "destructive", title: "Error con Google", description: error.message });
      await signOut(auth);
    } finally {
      setIsSubmitting(false);
    }
  };

  const forceReset = () => {
    window.location.reload();
  };

  if (isUserLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando Zygos...</p>
        {showReset && (
          <Button variant="outline" onClick={forceReset} className="gap-2 mt-4">
            <RefreshCcw className="h-4 w-4" />
            Recargar página
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="space-y-3 text-center pt-10">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/5 rounded-3xl border border-primary/10 shadow-sm">
              <Logo className="h-16 w-16 filter drop-shadow-sm" variant="light" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight text-primary font-bold">Iniciar Sesión</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Accede de forma rápida y segura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2 pb-8">
          <div className="bg-primary/5 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-muted-foreground border border-primary/10 leading-relaxed">
            <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p>Zygos utiliza un sistema exclusivo por invitación. Si no posees una cuenta, debes ingresar inicialmente mediante un enlace provisto por un miembro.</p>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full py-7 flex gap-3 border-primary/20 hover:bg-primary/5 text-base font-bold rounded-xl shadow-sm transition-all"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                Continuar con Google
              </>
            )}
          </Button>

          {/* Formulario de Email/Contraseña oculto temporalmente por requerimiento de UX
          <form className="space-y-4">
            ...
          </form> 
          */}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center pb-8 pt-0 border-t bg-muted/10 px-6 py-4">
          <div className="flex gap-4 text-xs text-muted-foreground font-medium">
            <Link href="/terminos" className="hover:underline hover:text-primary">Términos de Uso</Link>
            <span>•</span>
            <Link href="/privacidad" className="hover:underline hover:text-primary">Política de Privacidad</Link>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:underline font-medium mt-2">Volver al inicio</Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Iniciando sesión...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
