"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { createUserProfile } from "@/lib/firebase/store";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await createUserProfile(userCredential.user.uid, email, name);
      toast({ title: "¡Bienvenido!", description: "Cuenta creada con éxito." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
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
      toast({ title: "¡Bienvenido!", description: "Cuenta creada con Google." });
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error con Google", description: error.message });
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <CardTitle className="text-3xl font-headline tracking-tight text-primary">Crear Cuenta</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Únete a BalanceHub hoy mismo</CardDescription>
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
                Registrarse con Google
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O usa tu correo</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-accent py-6 text-lg" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Registrarse"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta? <Link href="/login" className="text-primary font-semibold hover:underline">Inicia sesión</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
