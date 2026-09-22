"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup, getGroupMembersDetails, bulkUpdateDebtStatus } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Users, Wallet, ChevronRight, Loader2, ReceiptText, AlertCircle, Clock, CheckCircle2, CreditCard, User, Send } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [newGroupName, setNewGroupName] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDebtGroup, setSelectedDebtGroup] = useState<{ creditorId: string; total: number; debts: Debt[]; name: string } | null>(null);
  const [creditorProfiles, setCreditorProfiles] = useState<Record<string, UserProfile>>({});
  const [isReporting, setIsReporting] = useState(false);
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

  // Filtrar deudas pendientes o en revisión (excluyendo auto-deudas pagadas)
  const pendingDebts = useMemo(() => {
    if (!myDebts || !user?.uid) return [];
    return myDebts.filter(d => d.status !== 'paid');
  }, [myDebts, user?.uid]);

  // Resolver nombres de acreedores
  useEffect(() => {
    if (pendingDebts.length > 0) {
      const uids = Array.from(new Set(pendingDebts.map(d => d.creditorId)));
      getGroupMembersDetails(uids).then(profiles => {
        const map: Record<string, UserProfile> = {};
        profiles.forEach(p => {
          if (p.uid) map[p.uid] = p;
        });
        setCreditorProfiles(map);
      });
    }
  }, [pendingDebts]);

  // Agrupar deudas por acreedor
  const groupedDebts = useMemo(() => {
    const groups: Record<string, { creditorId: string; total: number; debts: Debt[] }> = {};
    
    pendingDebts.forEach(debt => {
      if (!groups[debt.creditorId]) {
        groups[debt.creditorId] = { creditorId: debt.creditorId, total: 0, debts: [] };
      }
      groups[debt.creditorId].total += debt.amount;
      groups[debt.creditorId].debts.push(debt);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [pendingDebts]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, user.uid);
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

  const handleReportTransfer = async () => {
    if (!selectedDebtGroup || !user) return;
    setIsReporting(true);
    try {
      const pendingIds = selectedDebtGroup.debts
        .filter(d => d.status === 'pending')
        .map(d => d.id);
      
      if (pendingIds.length > 0) {
        // Asumiendo que las deudas están en diferentes grupos, necesitamos actualizarlas individualmente o por lote si conocemos sus groupId
        // Por simplicidad en esta iteración, el bulkUpdateDebtStatus en store.ts se ajustará para ser genérico o usaremos bucle.
        // Aquí usaremos el bulkUpdateDebtStatus ya mejorado en store.ts.
        // Nota: En Firestore real, las subcolecciones requieren el path completo. 
        // Ajustamos la lógica para iterar sobre los debtIds si pertenecen a distintos grupos.
        for (const debt of selectedDebtGroup.debts) {
          if (debt.status === 'pending') {
            await bulkUpdateDebtStatus(debt.groupId, [debt.id], 'under_review');
          }
        }
      }
      
      toast({ title: "Transferencia Reportada", description: "El acreedor ha sido notificado para validar el pago." });
      setSelectedDebtGroup(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo reportar el pago." });
    } finally {
      setIsReporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 text-[9px] font-bold border-orange-200"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pendiente</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 text-[9px] font-bold animate-pulse border-blue-200"><Clock className="h-2.5 w-2.5 mr-1" /> En Revisión</Badge>;
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
            <Button className="bg-accent h-12 w-full md:w-auto px-6 shadow-lg shadow-accent/20 rounded-2xl font-bold text-white hover:bg-accent/90">
              <PlusCircle className="h-5 w-5 mr-2" /> Nuevo Grupo de Cobro
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem] border-none p-6 sm:p-8 mx-4">
            <DialogHeader><DialogTitle className="text-xl sm:text-2xl font-headline font-bold">Crear Grupo</DialogTitle></DialogHeader>
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
                  <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group shadow-sm border border-primary/5">
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
          <Card className="border-none shadow-md bg-white rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-primary/5">
            <div className="bg-primary p-6 sm:p-8 text-primary-foreground text-center">
               <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">Total que Debes Pagar</p>
               <p className="text-3xl sm:text-5xl font-headline font-bold">${pendingDebts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</p>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-8">
              {myDebtsLoading ? [1,2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />) : groupedDebts.length === 0 ? (
                <div className="py-6 text-center opacity-30"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase tracking-widest">Al día con todos tus grupos</p></div>
              ) : groupedDebts.map(group => {
                const creditor = creditorProfiles[group.creditorId];
                const hasPending = group.debts.some(d => d.status === 'pending');
                
                return (
                  <div key={group.creditorId} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-primary truncate">
                          Debes <span className="text-accent">${group.total.toFixed(2)}</span> a {creditor?.displayName || 'Cargando...'}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-[8px] font-black uppercase tracking-widest rounded-lg text-accent hover:bg-accent/5"
                          onClick={() => setSelectedDebtGroup({ 
                            ...group, 
                            name: creditor?.displayName || 'Acreedor' 
                          })}
                        >
                          <CreditCard className="h-3 w-3 mr-1" /> Pagar
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 pl-2 border-l-2 border-accent/20">
                      {group.debts.map(debt => (
                        <div key={debt.id} className="flex flex-col p-4 bg-muted/20 rounded-2xl gap-2 border border-transparent hover:border-primary/10 transition-colors">
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-[8px] font-black uppercase text-muted-foreground truncate">{debt.groupName || "Grupo"}</p>
                              <p className="text-xs font-bold truncate">{debt.description}</p>
                            </div>
                            <span className="text-sm font-bold text-accent shrink-0">${debt.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            {getStatusBadge(debt.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedDebtGroup} onOpenChange={val => !val && setSelectedDebtGroup(null)}>
        <DialogContent className="rounded-[2rem] border-none p-6 sm:p-8 mx-4 max-w-sm sm:max-w-md shadow-2xl">
          <DialogHeader className="text-center pb-4">
            <div className="bg-accent/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-accent">
              <CreditCard className="h-7 w-7 sm:h-8" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Detalle de Pago</DialogTitle>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Pago total a {selectedDebtGroup?.name}</p>
          </DialogHeader>
          
          {selectedDebtGroup && (
            <div className="space-y-6 text-center">
              <div className="bg-muted/30 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] space-y-1 border border-primary/5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Monto a Transferir</p>
                <p className="text-3xl sm:text-5xl font-headline font-bold text-primary">${selectedDebtGroup.total.toFixed(2)}</p>
              </div>
              <div className="space-y-2 text-left bg-primary/5 p-4 rounded-xl border border-primary/10">
                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2 block">Datos de Transferencia</Label>
                <div className="font-mono text-[11px] text-primary whitespace-pre-wrap leading-relaxed">
                  {creditorProfiles[selectedDebtGroup.creditorId]?.transferDetails || "El acreedor no ha cargado sus datos de pago."}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  disabled={isReporting || !selectedDebtGroup.debts.some(d => d.status === 'pending')}
                  className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-primary/20 text-white gap-2" 
                  onClick={handleReportTransfer}
                >
                  {isReporting ? <Loader2 className="animate-spin" /> : <><Send className="h-5 w-5" /> Reportar Transferencia</>}
                </Button>
                <Button variant="ghost" className="w-full h-10 rounded-xl" onClick={() => setSelectedDebtGroup(null)}>Cerrar</Button>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Info className="h-4 w-4 shrink-0" />
                <p className="text-[10px] text-left leading-relaxed font-medium">
                  Al reportar, tus deudas pasarán a <strong>"En Revisión"</strong> hasta que el acreedor confirme la recepción del dinero.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
