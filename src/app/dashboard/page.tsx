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
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName}!</h1>
          <p className="text-sm text-muted-foreground">Monitorea deudas, saldos grupales e ingresos transparentes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 w-full md:w-auto px-6 shadow-lg shadow-accent/20 rounded-2xl font-bold">
              <PlusCircle className="h-5 w-5 mr-2" /> Nuevo Grupo de Cobro
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem] border-none p-6 sm:p-8 mx-4">
            <DialogHeader><DialogTitle className="text-xl sm:text-2xl font-headline">Crear Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Nombre del Grupo</Label>
                <Input placeholder="Ej: Amigos del Padel / Asados" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-xl h-12" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGroup} className="w-full h-12 rounded-xl text-base font-bold">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 space-y-6 sm:space-y-10">
          <section className="space-y-4 sm:space-y-6">
            <h2 className="text-lg sm:text-xl font-headline font-bold flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Mis Grupos Activos</h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {myGroupsLoading ? [1,2].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />) : myGroups?.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                  <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group">
                    <div className="h-1.5 bg-primary w-full" />
                    <CardHeader className="pb-4">
                      <CardTitle className="mt-2 text-base sm:text-lg font-headline group-hover:text-primary transition-colors truncate">{g.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.memberIds.length} MIEMBROS</span>
                        <span className="text-primary group-hover:translate-x-1 transition-transform flex items-center">VER <ChevronRight className="h-3 w-3" /></span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {myGroups?.length === 0 && (
                <div className="col-span-full py-10 text-center border-2 border-dashed rounded-[2rem] opacity-30">
                  <p className="text-xs italic font-bold uppercase tracking-widest">Aún no tienes grupos activos</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-lg sm:text-xl font-headline font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Billetera Consolidada</h2>
          <Card className="border-none shadow-md bg-white rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
            <div className="bg-primary p-6 sm:p-8 text-primary-foreground text-center">
               <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">Total que Debes Pagar</p>
               <p className="text-3xl sm:text-5xl font-headline font-bold">${pendingDebts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</p>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-3">
              {myDebtsLoading ? [1,2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />) : pendingDebts.length === 0 ? (
                <div className="py-6 text-center opacity-30"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase tracking-widest">Al día con todos tus grupos</p></div>
              ) : pendingDebts.map(debt => (
                <div key={debt.id} className="flex flex-col p-4 bg-muted/10 rounded-2xl gap-2 border border-transparent hover:border-primary/10 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[8px] font-black uppercase text-muted-foreground truncate">{debt.groupName || "Grupo"}</p>
                      <p className="text-xs font-bold truncate">{debt.description}</p>
                    </div>
                    <span className="text-sm font-bold text-accent shrink-0">${debt.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    {getStatusBadge(debt.status)}
                    <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase tracking-tighter sm:tracking-widest rounded-lg" onClick={() => setSelectedDebt(debt)}>Ver Pago</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedDebt} onOpenChange={val => !val && setSelectedDebt(null)}>
        <DialogContent className="rounded-[2rem] border-none p-6 sm:p-8 mx-4 max-w-sm sm:max-w-md">
          <DialogHeader className="text-center pb-4">
            <div className="bg-accent/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-accent">
              <CreditCard className="h-7 w-7 sm:h-8 sm:h-8" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Detalle de Depósito</DialogTitle>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{selectedDebt?.groupName}</p>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-6 text-center">
              <div className="bg-muted/30 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] space-y-1 border">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Monto a Transferir</p>
                <p className="text-3xl sm:text-5xl font-headline font-bold text-primary">${selectedDebt.amount.toFixed(2)}</p>
              </div>
              <div className="space-y-2 text-left bg-primary/5 p-4 rounded-xl border border-primary/10">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2 block">Datos de Transferencia</Label>
                <div className="font-mono text-[11px] text-primary whitespace-pre-wrap leading-relaxed">{selectedDebt.transferDetails || "El acreedor no ha cargado sus datos de pago."}</div>
              </div>
              <Button className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-primary/20" onClick={() => setSelectedDebt(null)}>Entendido</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
