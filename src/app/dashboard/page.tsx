"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group, Debt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Users, Wallet, ChevronRight, Loader2, ReceiptText, AlertCircle, Clock, CheckCircle2, CreditCard } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup, orderBy } from "firebase/firestore";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [newGroupName, setNewGroupName] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const { toast } = useToast();

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: myGroups, isLoading: myGroupsLoading } = useCollection<Group>(myGroupsQuery);

  const myDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collectionGroup(firestore, 'debts'), where('debtorId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user?.uid]);
  const { data: myDebts, isLoading: myDebtsLoading } = useCollection<Debt>(myDebtsQuery);

  const pendingDebts = useMemo(() => myDebts?.filter(d => d.status !== 'paid') || [], [myDebts]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, 'variable', user.uid);
      toast({ title: "Grupo creado", description: "El grupo se ha guardado correctamente." });
      setNewGroupName("");
      setOpen(false);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Error al crear grupo", 
        description: e.message || "Asegúrate de tener permisos." 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 text-[9px] font-bold"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pendiente</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 text-[9px] font-bold animate-pulse"><Clock className="h-2.5 w-2.5 mr-1" /> En Revisión</Badge>;
      default: return null;
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName}!</h1>
          <p className="text-muted-foreground">Monitorea deudas, saldos grupales e ingresos transparentes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 px-6 shadow-lg shadow-accent/20 rounded-2xl">
              <PlusCircle className="h-5 w-5 mr-2" /> Nuevo Grupo de Cobro
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none p-8">
            <DialogHeader><DialogTitle className="text-2xl font-headline">Crear Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1"><Label>Nombre del Grupo</Label><Input placeholder="Ej: Amigos del Padel / Asados" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-xl h-12" /></div>
            </div>
            <DialogFooter><Button onClick={handleCreateGroup} className="w-full h-12 rounded-xl">Crear Grupo</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Mis Grupos Activos</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {myGroupsLoading ? [1,2].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />) : myGroups?.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                  <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group">
                    <div className="h-1.5 bg-primary w-full" />
                    <CardHeader className="pb-4"><CardTitle className="mt-2 text-lg font-headline group-hover:text-primary transition-colors">{g.name}</CardTitle></CardHeader>
                    <CardContent><div className="flex justify-between text-[10px] text-muted-foreground pt-4 border-t font-bold uppercase tracking-wider"><span><Users className="h-3 w-3 inline mr-1" /> {g.memberIds.length} MIEMBROS</span><span className="text-primary group-hover:translate-x-1 transition-transform">VER PANEL <ChevronRight className="h-3 w-3 inline" /></span></div></CardContent>
                  </Card>
                </Link>
              ))}
              {myGroups?.length === 0 && (
                <p className="text-xs italic text-muted-foreground opacity-60">Aún no eres miembro de ningún grupo. Crea uno arriba o únete por enlace.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Billetera Consolidada</h2>
          <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <div className="bg-primary p-8 text-primary-foreground text-center">
               <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">Total que Debes Settlear</p>
               <p className="text-5xl font-headline font-bold">${pendingDebts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</p>
            </div>
            <CardContent className="p-6 space-y-3">
              {myDebtsLoading ? [1,2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />) : pendingDebts.length === 0 ? (
                <div className="py-6 text-center opacity-30"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase tracking-widest">Al día con todos tus grupos</p></div>
              ) : pendingDebts.map(debt => (
                <div key={debt.id} className="flex flex-col p-4 bg-muted/10 rounded-2xl gap-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black uppercase text-muted-foreground">{debt.groupName || "Grupo"}</p>
                      <p className="text-xs font-bold truncate max-w-[140px]">{debt.description}</p>
                    </div>
                    <span className="text-sm font-bold text-accent">${debt.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    {getStatusBadge(debt.status)}
                    <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase" onClick={() => setSelectedDebt(debt)}>Instrucciones de Pago</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedDebt} onOpenChange={val => !val && setSelectedDebt(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none p-8">
          <DialogHeader className="text-center pb-6"><div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><CreditCard className="h-8 w-8 text-accent" /></div><DialogTitle className="text-2xl font-headline font-bold">Detalle de Depósito</DialogTitle><p className="text-[10px] font-black uppercase tracking-widest opacity-50">{selectedDebt?.groupName}</p></DialogHeader>
          {selectedDebt && (
            <div className="space-y-6 text-center">
              <div className="bg-muted/30 p-8 rounded-[2rem] space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monto Neto a Transferir</p><p className="text-5xl font-headline font-bold text-primary">${selectedDebt.amount.toFixed(2)}</p></div>
              <div className="space-y-3 text-left">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Datos Bancarios del Administrador</Label>
                <div className="bg-primary/5 p-5 rounded-2xl font-mono text-xs text-primary border border-primary/10 whitespace-pre-wrap">{selectedDebt.transferDetails || "El administrador del grupo no ha cargado datos de transferencia todavía."}</div>
              </div>
              <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" onClick={() => setSelectedDebt(null)}>Entendido</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
