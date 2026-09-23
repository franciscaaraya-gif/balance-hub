"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { updateUserProfile, getUserProfile } from "@/lib/firebase/store";
import { UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, CreditCard, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    transferDetails: "",
  });

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user?.uid]);

  const { data: profile, isLoading: profileLoading } = useDoc<UserProfile>(profileRef);

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || "",
        transferDetails: profile.transferDetails || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateUserProfile(user.uid, formData);
      toast({ title: "Perfil actualizado", description: "Tus datos han sido guardados correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los cambios." });
    } finally {
      setIsLoading(false);
    }
  };

  if (profileLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 px-2 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Ajustes de Perfil</h1>
        <p className="text-sm text-muted-foreground">Configura tu identidad y datos de cobro personales.</p>
      </div>

      <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b bg-muted/10 px-4 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black px-1">Nombre para mostrar</Label>
            <Input 
              value={formData.displayName} 
              onChange={e => setFormData({...formData, displayName: e.target.value})}
              className="rounded-xl h-12"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black px-1">Correo Electrónico</Label>
            <Input 
              value={user?.email || ""} 
              disabled
              className="rounded-xl h-12 bg-muted/50 cursor-not-allowed"
            />
            <p className="text-[9px] text-muted-foreground px-1">El email no se puede cambiar por seguridad.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b bg-secondary/10 px-4 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2 text-secondary">
            <CreditCard className="h-4 w-4" /> Datos de Cobro Personales
          </CardTitle>
          <CardDescription className="text-[10px] sm:text-xs">Estos datos se mostrarán a otros miembros cuando tú seas el acreedor de un gasto.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black px-1">Instrucciones de Transferencia</Label>
            <Textarea 
              placeholder="Ej: CBU 000000000, Alias: mi.alias.personal, Banco: Galicia" 
              value={formData.transferDetails} 
              onChange={e => setFormData({...formData, transferDetails: e.target.value})}
              className="rounded-xl min-h-[120px] bg-muted/20 border-none font-mono text-xs sm:text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={isLoading}
        className="w-full h-14 rounded-2xl text-base sm:text-lg font-bold shadow-lg shadow-primary/20"
      >
        {isLoading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Guardar Cambios</>}
      </Button>
    </div>
  );
}
