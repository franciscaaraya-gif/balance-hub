
"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addAndMarkPresent } from "@/lib/firebase/store";
import { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle, Calendar, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";

export default function CheckInPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [checkingIn, setCheckingIn] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id]);

  const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

  useEffect(() => {
    if (isUserLoading || eventLoading) return;

    if (!user) {
      router.push(`/login?redirect=/attendance/check-in/${params.id}?token=${token}`);
      return;
    }

    if (!event || event.checkInToken !== token) {
      setError("El código QR no es válido o ha expirado.");
      setCheckingIn(false);
      return;
    }

    const performCheckIn = async () => {
      try {
        await addAndMarkPresent(params.id, user.uid);
        setSuccess(true);
        toast({ title: "Check-in Exitoso", description: "Tu asistencia ha sido registrada." });
      } catch (err) {
        setError("Hubo un error al registrar tu asistencia.");
      } finally {
        setCheckingIn(false);
      }
    };

    performCheckIn();
  }, [user, isUserLoading, event, eventLoading, params.id, token, router, toast]);

  if (isUserLoading || eventLoading || checkingIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Procesando Check-in...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden bg-white rounded-[2.5rem] text-center">
        <div className={`h-2 ${success ? 'bg-emerald-500' : 'bg-destructive'}`} />
        <CardHeader className="pt-10 pb-6 space-y-4">
          <div className={`mx-auto p-4 rounded-full w-fit ${success ? 'bg-emerald-50' : 'bg-destructive/5'}`}>
            {success ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            ) : (
              <AlertCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl font-headline font-bold">
            {success ? "¡Check-in Confirmado!" : "Error en Check-in"}
          </CardTitle>
          <CardDescription className="text-sm px-4">
            {success 
              ? `Has registrado tu llegada a "${event?.title}". ¡Disfruta el evento!` 
              : error}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10 px-8 space-y-4">
          {success && (
            <div className="bg-muted/30 p-4 rounded-2xl flex items-center justify-between text-left">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fecha</p>
                <p className="text-sm font-bold">{event?.date}</p>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground opacity-30" />
            </div>
          )}
          
          <Button 
            className="w-full h-14 rounded-2xl font-bold text-lg gap-2" 
            onClick={() => router.push("/dashboard/attendance")}
          >
            Ir a mis eventos <ArrowRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
