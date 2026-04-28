"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, Wallet, UserCircle, Briefcase, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where } from "firebase/firestore";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAdminView, setIsAdminView] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Consultamos solo los grupos para simplificar y evitar errores de permisos de collectionGroup
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: allGroups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const adminGroups = useMemo(() => {
    if (!allGroups || !user) return [];
    return allGroups.filter(g => g.adminId === user.uid);
  }, [allGroups, user]);

  const handleCreateGroup = () => {
    if (!newGroupName || !user) return;
    createGroup(newGroupName, newGroupType, user.uid);
    toast({ title: "¡Éxito!", description: "Grupo creado." });
    setNewGroupName("");
    setOpen(false);
  };

  const isGlobalLoading = isUserLoading || groupsLoading;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${isAdminView ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
            {isAdminView ? <Briefcase className="h-6 w-6" /> : <UserCircle className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold text-primary">
              {isAdminView ? "Panel de Administrador" : "Mis Deudas"}
            </h1>
            <p className="text-muted-foreground text-sm">Gestiona tus finanzas grupales</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-full px-4 border">
          <span className="text-sm font-medium">Usuario</span>
          <Switch checked={isAdminView} onCheckedChange={setIsAdminView} />
          <span className="text-sm font-medium">Admin</span>
        </div>
      </div>

      {isAdminView ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-headline font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Tus Grupos</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-accent gap-2"><PlusCircle className="h-4 w-4" /> Crear Grupo</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Grupo</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={newGroupType} onValueChange={(v: any) => setNewGroupType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="variable">Variable</SelectItem><SelectItem value="fixed">Fijo</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={handleCreateGroup}>Crear</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {isGlobalLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {adminGroups.length === 0 ? (
                <div className="col-span-full py-20 text-center border-dashed border-2 rounded-xl">
                  <p className="text-muted-foreground">No eres administrador de ningún grupo.</p>
                </div>
              ) : (
                adminGroups.map(g => (
                  <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                    <Card className="hover:shadow-md transition-all cursor-pointer">
                      <CardHeader><Badge variant="outline" className="w-fit">{g.type}</Badge><CardTitle className="mt-2">{g.name}</CardTitle></CardHeader>
                      <CardContent className="flex justify-between items-center text-sm"><span>{g.memberIds.length} Miembros</span><ChevronRight className="h-4 w-4" /></CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-semibold flex items-center gap-2"><Wallet className="h-5 w-5" /> Deudas Pendientes</h2>
          <Card className="p-20 text-center border-dashed border-2 bg-transparent">
            <CardTitle className="text-muted-foreground font-headline">Selecciona un grupo para ver tus deudas detalladas</CardTitle>
          </Card>
        </div>
      )}
    </div>
  );
}