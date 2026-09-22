"use client";

import { useState, useEffect, Suspense } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useUser } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createUserProfile } from "@/lib/firebase/store";
import { Logo } from "@/components/logo";

function LoginContent() {
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "¡Bienvenido!", description: "Sesión iniciada correctamente." });
      router.push(redirectTo);
    } catch (error: any) {
      console.error("Error en login:", error);
      toast({ variant: "destructive", title: "Error de acceso", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await createUserProfile(
          result.user.uid,
          result.user.email || "",
          result.user.displayName || "Usuario de Google"
        );
      }
      toast({ title: "¡Éxito!", description: "Sesión iniciada con Google." });
      router.push(redirectTo);
    } catch (error: any) {
      console.error("Error en Google Login:", error);
      toast({ variant: "destructive", title: "Error con Google", description: error.message });
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
              <Logo className="h-16 w-16 filter drop-shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight text-primary font-bold">Iniciar Sesión</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Accede a tu panel en Zygos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            variant="outline"
            type="button"
            className="w-full py-6 flex gap-3 border-primary/20 hover:bg-primary/5 text-base font-medium rounded-xl"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-bold">O con tu correo</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
            </div>
            <Button type="submit" className="w-full bg-primary text-white py-6 text-lg rounded-xl font-bold shadow-md" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center pb-8">
          <p className="text-sm text-muted-foreground font-medium">
            ¿No tienes cuenta? <Link href={`/register${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-accent font-bold hover:underline">Regístrate</Link>
          </p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline font-medium">Volver al inicio</Link>
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
