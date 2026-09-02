
"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group, Debt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Users, Wallet, ChevronRight, Loader2, PiggyBank, ReceiptText, AlertCircle, Clock, CheckCircle2, CreditCard, Calendar } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup, orderBy } from "firebase/firestore";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const { toast } = useToast();

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: myGroups, isLoading: myGroupsLoading, error: groupsError } = useCollection<Group>(myGroupsQuery);

  const myDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    // Agregamos orderBy para mejor UX, requiere índice compuesto
    return query(
      collectionGroup(firestore, 'debts'),
      where('debtorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.uid]);
  const { data: myDebts, isLoading: myDebtsLoading, error: debtsError } = useCollection<Debt>(myDebtsQuery);

  // Mapeo de IDs de grupos donde soy miembro para filtrado
  const myGroupIds = useMemo(() => new Set(myGroups?.map(g => g.id) || []), [myGroups]);

  const pendingDebts = useMemo(() => {
    if (!myDebts) return [];
    return myDebts.filter(d => d.status !== 'paid');
  }, [myDebts]);

  // Deudas de eventos donde NO soy miembro del grupo (Acceso nivel 2)
  const externalEventDebts = useMemo(() => {
    return pendingDebts.filter(d => !myGroupIds.has(d.groupId) && d.eventId);
  }, [pendingDebts, myGroupIds]);

  // Deudas de mis grupos (Acceso nivel 1)
  const memberDebts = useMemo(() => {
    return pendingDebts.filter(d => myGroupIds.has(d.groupId));
  }, [pendingDebts, myGroupIds]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, newGroupType, user.uid);
      toast({ title: "¡Éxito!", description: "Grupo creado correctamente." });
      setNewGroupName("");
      setOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el grupo." });
    }
  };

  const showPaymentInfo = (debt: Debt) => {
    if (!debt.transferDetails) {
      toast({ title: "Sin datos", description: "El administrador no ha subido datos de pago." });
      return;
    }
    setSelectedDebt(debt);
  };

  const copyTransferDetails = (details: string) => {
    navigator.clipboard.writeText(details);
    toast({ title: "Copiado", description: "Datos de transferencia copiados." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 text-[10px]"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pendiente</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 text-[10px] animate-pulse"><Clock className="h-2.5 w-2.5 mr-1" /> En Revisión</Badge>;
      default: return null;
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName}!</h1>
          <p className="text-muted-foreground">Gestiona tus cobros y pagos desde un solo lugar.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 gap-2 h-12 px-6 shadow-lg shadow-accent/20 rounded-2xl">
              <PlusCircle className="h-5 w-5" /> Nuevo Cobro Grupal
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline">Crear Grupo de Cobro</DialogTitle>
              <DialogDescription>Define el nombre de la deuda y el tipo de cobro.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Grupo / Deuda</Label>
                <Input 
                  placeholder="Ej: Asado Familiar, Luz Agosto" 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Cobro</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    type="button"
                    variant={newGroupType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('fixed')}
                    className="w-full h-24 flex-col gap-1 rounded-2xl"
                  >
                    <Users className="h-6 w-6" />
                    <span className="font-bold">Partes Iguales</span>
                    <span className="text-[10px] opacity-70">Mismo monto para todos</span>
                  </Button>
                  <Button 
                    type="button"
                    variant={newGroupType === 'variable' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('variable')}
                    className="w-full h-24 flex-col gap-1 rounded-2xl"
                  >
                    <Wallet className="h-6 w-6" />
                    <span className="font-bold">Variable</span>
                    <span className="text-[10px] opacity-70">Diferente por miembro</span>
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateGroup} className="bg-primary rounded-xl">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          
          {/* SECCIÓN: PAGOS DE EVENTOS EXTERNOS */}
          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" /> Pagos de Eventos (Externos)
            </h2>
            
            {externalEventDebts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {externalEventDebts.map(debt => (
                  <Card key={debt.id} className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-md transition-all">
                    <div className="h-1 bg-accent w-full" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">{debt.groupName || 'Sin Grupo'}</p>
                           <CardTitle className="text-base font-headline">{debt.eventName}</CardTitle>
                         </div>
                         {getStatusBadge(debt.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase">Monto a pagar</div>
                        <div className="text-2xl font-headline font-bold text-accent">${debt.amount.toFixed(2)}</div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full h-11 rounded-xl text-xs font-bold gap-2 border-accent text-accent hover:bg-accent/5"
                        onClick={() => showPaymentInfo(debt)}
                      >
                        <CreditCard className="h-4 w-4" /> Ver Datos y Pagar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed bg-transparent py-10 rounded-[2rem]">
                <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                  <Calendar className="h-10 w-10 text-muted-foreground opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">No tienes deudas de eventos externos</p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* SECCIÓN: MIS GRUPOS */}
          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" /> Mis Grupos
            </h2>
            
            {myGroupsLoading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {[1, 2].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)}
              </div>
            ) : !myGroups || myGroups.length === 0 ? (
              <Card className="border-dashed bg-transparent py-10 rounded-[2rem]">
                <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                  <Users className="h-10 w-10 text-muted-foreground opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Aún no eres miembro de ningún grupo</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {myGroups?.map(g => (
                  <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                    <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] group relative overflow-hidden">
                      <div className="h-1.5 bg-primary w-full" />
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                          <Badge variant={g.type === 'fixed' ? 'default' : 'secondary'} className="text-[9px] rounded-lg border-none px-2 py-0.5">
                            {g.type === 'fixed' ? 'IGUALES' : 'VARIABLE'}
                          </Badge>
                          {g.adminId === user?.uid && <Badge variant="outline" className="text-[8px] border-primary text-primary font-bold">ADMIN</Badge>}
                        </div>
                        <CardTitle className="mt-2 text-lg font-headline group-hover:text-primary transition-colors">{g.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t border-muted/50 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.memberIds?.length || 0} MIEMBROS</span>
                          <span className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform">IR AL GRUPO <ChevronRight className="h-3 w-3" /></span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* SIDEBAR: RESUMEN DE PAGOS (MIEMBROS) */}
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Mi Billetera
          </h2>
          
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="bg-primary p-6 text-primary-foreground">
               <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-70 mb-1">Deuda Total Pendiente</p>
               <p className="text-4xl font-headline font-bold">
                 ${pendingDebts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
               </p>
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Desglose de Membresía</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myDebtsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />)}
                </div>
              ) : memberDebts.length === 0 ? (
                <div className="py-6 text-center space-y-2 opacity-40">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Al día en tus grupos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberDebts.map(debt => (
                    <div key={debt.id} className="flex flex-col p-4 bg-muted/10 rounded-2xl border border-transparent hover:border-primary/20 transition-all gap-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-muted-foreground uppercase font-black">{debt.groupName}</p>
                          <p className="text-xs font-bold truncate max-w-[120px]">{debt.eventName || debt.description}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">${debt.amount.toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                         {getStatusBadge(debt.status)}
                         <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase tracking-tighter" onClick={() => showPaymentInfo(debt)}>Ver Pago</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL DE PAGO (Nivel 2) */}
      <Dialog open={!!selectedDebt} onOpenChange={(val) => !val && setSelectedDebt(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none p-8">
          <DialogHeader className="text-center pb-6">
            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold">Detalle de Pago</DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold tracking-widest mt-1">
              {selectedDebt?.groupName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDebt && (
            <div className="space-y-6">
              <div className="bg-muted/30 p-6 rounded-[2rem] border border-muted/50 text-center space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monto Final</p>
                <p className="text-4xl font-headline font-bold text-primary">${selectedDebt.amount.toFixed(2)}</p>
                <p className="text-[10px] font-bold text-accent">{selectedDebt.eventName}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Datos de Transferencia</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold text-primary" onClick={() => copyTransferDetails(selectedDebt.transferDetails || "")}>
                    Copiar Todo
                  </Button>
                </div>
                <div className="bg-primary/5 p-5 rounded-[1.5rem] border border-primary/10 font-mono text-xs whitespace-pre-wrap leading-relaxed text-primary">
                  {selectedDebt.transferDetails || "El administrador no ha proporcionado datos de transferencia."}
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20" onClick={() => setSelectedDebt(null)}>
                  Entendido
                </Button>
                <p className="text-[9px] text-center text-muted-foreground mt-4 leading-relaxed px-6">
                  Una vez realizada la transferencia, el administrador del grupo marcará tu deuda como pagada.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

