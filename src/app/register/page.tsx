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
import { createUserProfile, getUserProfile } from "@/lib/firebase/store";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";

function RegisterContent() {
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    if (user && !isUserLoading && !isSubmitting) {
      router.push(redirectTo);
    }
  }, [user, isUserLoading, router, redirectTo, isSubmitting]);

  const handleGoogleRegister = async () => {
    if (!acceptedTerms) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const existingProfile = await getUserProfile(result.user.uid);
        const hasInviteContext = redirectTo.includes("/join/") || redirectTo.includes("/attendance/join/");

        if (!existingProfile && !hasInviteContext) {
          toast({
            variant: "destructive",
            title: "Registro denegado",
            description: "Zygos funciona solo por invitación. Pídele a un amigo que ya use la app que te comparta un link de grupo o evento."
          });
          try {
            await result.user.delete();
          } catch (e) {
            console.error(e);
          }
          await signOut(auth);
          setIsSubmitting(false);
          return;
        }

        if (!existingProfile) {
          await createUserProfile(
            result.user.uid,
            result.user.email || "",
            result.user.displayName || "Usuario de Google"
          );
        }

        toast({ title: "¡Bienvenido!", description: "Cuenta creada con éxito." });
        router.push(redirectTo);
      }
    } catch (error: any) {
      console.error("Error en Google Register:", error);
      toast({ variant: "destructive", title: "Error con Google", description: error.message });
      await signOut(auth);
    } finally {
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
      <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="space-y-3 text-center pt-10">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/5 rounded-3xl border border-primary/10 shadow-sm">
              <Logo className="h-16 w-16 filter drop-shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight text-primary font-bold">Crear Cuenta</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Únete a Zygos mediante tu cuenta de Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          
          <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
            <div className="flex items-start gap-3">
              <Checkbox 
                id="terms" 
                checked={acceptedTerms} 
                onCheckedChange={(checked) => setAcceptedTerms(!!checked)}
                className="h-4 w-4 rounded mt-0.5"
              />
              <Label htmlFor="terms" className="text-xs text-muted-foreground leading-normal font-medium cursor-pointer">
                Acepto los <Link href="/terminos" className="text-primary font-bold underline hover:text-accent">Términos de Uso</Link> y la <Link href="/privacidad" className="text-primary font-bold underline hover:text-accent">Política de Privacidad</Link> de la plataforma.
              </Label>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full py-7 flex gap-3 border-primary/20 hover:bg-primary/5 text-base font-bold rounded-xl shadow-sm transition-all"
            onClick={handleGoogleRegister}
            disabled={isSubmitting || !acceptedTerms}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                Registrarse con Google
              </>
            )}
          </Button>

          {/* Formulario tradicional de email comentado por requerimiento
          <form className="space-y-4">
             ...
          </form> 
          */}
        </CardContent>
        <CardFooter className="flex justify-center pb-8 pt-2 border-t bg-muted/10">
          <p className="text-sm text-muted-foreground font-medium mt-4">
            ¿Ya eres miembro? <Link href="/login" className="text-primary font-bold hover:underline">Inicia Sesión</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
