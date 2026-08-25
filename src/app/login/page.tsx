"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createUserProfile } from "@/lib/firebase/store";

export default function Login() {
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isUserLoading) setShowReset(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isUserLoading]);

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  // Maneja el resultado del signInWithRedirect al volver de Google
  useEffect(() => {
    console.log('🔍 Verificando resultado de redirect...');
    getRedirectResult(auth)
      .then(async (result) => {
        console.log('🔍 Resultado de getRedirectResult:', result);
        if (result?.user) {
          console.log('✅ Usuario encontrado:', result.user.uid);
          await createUserProfile(
            result.user.uid,
            result.user.email || "",
            result.user.displayName || "Usuario de Google"
          );
          toast({ title: "¡Éxito!", description: "Sesión iniciada con Google." });
        } else {
          console.log('⚠️ No hay resultado de redirect (result es null)');
        }
      })
      .catch((error: any) => {
        console.error('❌ Error en getRedirectResult:', error);
        toast({ variant: "destructive", title: "Error con Google", description: error.message });
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "¡Bienvenido!", description: "Sesión iniciada correctamente." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error con Google", description: error.message });
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
        <p className="text-muted-foreground animate-pulse">Cargando BalanceHub...</p>
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
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-2xl text-primary-foreground">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight text-primary">Iniciar Sesión</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Accede a tu cuenta de BalanceHub</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            variant="outline"
            type="button"
            className="w-full py-6 flex gap-3 border-primary/20 hover:bg-primary/5 text-base font-medium"
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
              <span className="bg-background px-2 text-muted-foreground">O con tu correo</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-primary py-6 text-lg" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta? <Link href="/register" className="text-accent font-semibold hover:underline">Regístrate</Link>
          </p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">Volver al inicio</Link>
        </CardFooter>
      </Card>
    </div>
  );
}