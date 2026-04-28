
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { joinGroupByInvite } from "@/lib/firebase/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JoinGroup({ params: paramsPromise }: { params: Promise<{ token: string }> }) {
  const params = use(paramsPromise);
  const { user, isUserLoading: authLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Autenticación Requerida", description: "Por favor, inicia sesión para unirte al grupo." });
      router.push(`/login?redirect=/join/${params.token}`);
    }
  }, [user, authLoading, router, params.token]);

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const groupId = await joinGroupByInvite(user.uid, params.token);
      toast({ title: "¡Te has unido!", description: "Ahora eres miembro del grupo." });
      router.push(`/dashboard/groups/${groupId}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo al unirse", description: error.message });
      router.push("/dashboard");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-2xl text-primary-foreground">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight">¡Has sido invitado!</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Únete a este grupo en BalanceHub para empezar a gestionar deudas compartidas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button 
            className="w-full bg-accent hover:bg-accent/90 py-6 text-lg" 
            onClick={handleJoin}
            disabled={joining || !user}
          >
            {joining ? "Uniéndote..." : "Unirme al Grupo"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Rechazar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
