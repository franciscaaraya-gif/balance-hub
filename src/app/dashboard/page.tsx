"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { 
  createGroup, 
  getGroupMembersDetails, 
  reportPayment, 
  validatePayment 
} from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  PlusCircle, Users, ChevronRight, Loader2, 
  ReceiptText, AlertCircle, Clock, CheckCircle2, 
  CreditCard, User, Send, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup, orderBy } from "firebase/firestore";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [newGroupName, setNewGroupName] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDebtGroup, setSelectedDebtGroup] = useState<{ creditorId: string; total: number; debts: Debt[]; name: string } | null>(null);
  const [selectedValidationGroup, setSelectedValidationGroup] = useState<{ id: string; debtorId: string; total: number; debts: Debt[]; name: string } | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [isProcessing, setIsProcessing] = useState(false);

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

  const incomingDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collectionGroup(firestore, 'debts'), where('creditorId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user?.uid]);
  const { data: myIncomingDebts, isLoading: myIncomingLoading } = useCollection<Debt>(incomingDebtsQuery);

  useEffect(() => {
    const uids = new Set<string>();
    myDebts?.forEach(d => uids.add(d.creditorId));
    myIncomingDebts?.forEach(d => {
      uids.add(d.debtorId);
      uids.add(d.creditorId);
    });
    
    if (uids.size > 0) {
      getGroupMembersDetails(Array.from(uids)).then(profiles => {
        const map: Record<string, UserProfile> = {};
        profiles.forEach(p => { if (p.uid) map[p.uid] = p; });
        setProfilesMap(prev => ({ ...prev, ...map }));
      });
    }
  }, [myDebts, myIncomingDebts]);

  const outgoingGroups = useMemo(() => {
    if (!myDebts || !user?.uid) return [];
    const groups: Record<string, { creditorId: string; total: number; debts: Debt[] }> = {};
    
    myDebts.filter(d => d.status !== 'paid' && d.debtorId !== d.creditorId).forEach(debt => {
      if (!groups[debt.creditorId]) {
        groups[debt.creditorId] = { creditorId: debt.creditorId, total: 0, debts: [] };
      }
      groups[debt.creditorId].total += debt.amount;
      groups[debt.creditorId].debts.push(debt);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [myDebts, user?.uid]);

  const incomingResult = useMemo(() => {
    if (!myIncomingDebts || !user?.uid) return { pending: [], review: [], total: 0 };
    
    const pendingGroups: Record<string, { debtorId: string; total: number; debts: Debt[] }> = {};
    const reviewGroups: Record<string, { id: string; debtorId: string; total: number; debts: Debt[]; updatedAt: number }> = {};
    let totalIncoming = 0;

    myIncomingDebts.filter(d => d.status !== 'paid' && d.debtorId !== d.creditorId).forEach(debt => {
      totalIncoming += debt.amount;

      if (debt.status === 'under_review') {
        const rid = debt.paymentRequestId || `legacy_${debt.debtorId}_${debt.createdAt}`;
        if (!reviewGroups[rid]) {
          reviewGroups[rid] = { id: rid, debtorId: debt.debtorId, total: 0, debts: [], updatedAt: debt.updatedAt || debt.createdAt };
        }
        reviewGroups[rid].total += debt.amount;
        reviewGroups[rid].debts.push(debt);
      } else {
        if (!pendingGroups[debt.debtorId]) {
          pendingGroups[debt.debtorId] = { debtorId: debt.debtorId, total: 0, debts: [] };
        }
        pendingGroups[debt.debtorId].total += debt.amount;
        pendingGroups[debt.debtorId].debts.push(debt);
      }
    });

    return {
      pending: Object.values(pendingGroups).sort((a, b) => b.total - a.total),
      review: Object.values(reviewGroups).sort((a, b) => b.updatedAt - a.updatedAt),
      total: totalIncoming
    };
  }, [myIncomingDebts, user?.uid]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, user.uid);
      toast({ title: "Grupo creado" });
      setNewGroupName("");
      setOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleReportPayment = async () => {
    if (!selectedDebtGroup) return;
    setIsProcessing(true);
    try {
      const pending = selectedDebtGroup.debts.filter(d => d.status === 'pending');
      await reportPayment(pending);
      toast({ title: "Transferencia Reportada" });
      setSelectedDebtGroup(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidatePayment = async () => {
    if (!selectedValidationGroup) return;
    setIsProcessing(true);
    try {
      await validatePayment(selectedValidationGroup.debts);
      toast({ title: "Pago Validado" });
      setSelectedValidationGroup(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsProcessing(false);
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
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName}!</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus deudas y cobros de forma transparente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 w-full md:w-auto px-6 shadow-lg rounded-2xl font-bold text-white">
              <PlusCircle className="h-5 w-5 mr-2" /> Nuevo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none p-8">
            <DialogHeader><DialogTitle className="text-2xl font-headline font-bold">Crear Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black px-1">Nombre</Label>
                <Input placeholder="Ej: Amigos Padel" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-xl h-12" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGroup} className="w-full h-12 rounded-xl font-bold">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Mis Grupos</h2>
            <div className="relative px-1">
              {myGroupsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)}
                </div>
              ) : myGroups?.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed rounded-[2rem] opacity-30 font-bold uppercase text-[10px]">Sin grupos activos</div>
              ) : myGroups && myGroups.length <= 4 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {myGroups.map(g => <GroupCard key={g.id} g={g} />)}
                </div>
              ) : (
                <Carousel opts={{ align: "start" }} className="w-full">
                  <CarouselContent className="-ml-4">
                    {myGroups?.map((g) => (
                      <CarouselItem key={g.id} className="pl-4 sm:basis-1/2">
                        <GroupCard g={g} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="hidden sm:block">
                    <CarouselPrevious className="-left-6 rounded-xl h-10 w-10 border-2" />
                    <CarouselNext className="-right-6 rounded-xl h-10 w-10 border-2" />
                  </div>
                </Carousel>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2 text-orange-600"><ArrowUpRight className="h-5 w-5" /> Billetera: Pagos Pendientes</h2>
            <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
              <div className="bg-primary p-8 text-primary-foreground text-center">
                 <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">Total que Debes</p>
                 <p className="text-5xl font-headline font-bold">${outgoingGroups.reduce((sum, g) => sum + g.total, 0).toFixed(2)}</p>
              </div>
              <CardContent className="p-6 space-y-8">
                {myDebtsLoading ? <Loader2 className="animate-spin mx-auto" /> : outgoingGroups.length === 0 ? (
                  <div className="py-6 text-center opacity-30"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase">Al día</p></div>
                ) : outgoingGroups.map(group => {
                  const creditor = profilesMap[group.creditorId];
                  return (
                    <div key={group.creditorId} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-accent"><User className="h-4 w-4" /></div>
                          <span className="text-[11px] font-black uppercase text-primary">A {creditor?.displayName || '...'}</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="h-8 rounded-xl text-[9px] font-black uppercase bg-accent text-white"
                          onClick={() => setSelectedDebtGroup({ ...group, name: creditor?.displayName || 'Acreedor' })}
                        >
                          <CreditCard className="h-3 w-3 mr-1" /> Pagar ${group.total.toFixed(2)}
                        </Button>
                      </div>
                      <div className="space-y-2 pl-2 border-l-2 border-accent/20">
                        {group.debts.map(debt => (
                          <div key={debt.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-xl text-xs">
                             <div className="min-w-0 pr-2">
                               <p className="text-[8px] font-black opacity-50 uppercase">{debt.groupName}</p>
                               <p className="font-bold truncate">{debt.description}</p>
                             </div>
                             <div className="text-right shrink-0">
                               <p className="font-bold text-accent">${debt.amount.toFixed(2)}</p>
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
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2 text-emerald-600"><ArrowDownLeft className="h-5 w-5" /> Billetera: Te Deben</h2>
            <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
              <div className="bg-secondary p-8 text-white text-center">
                 <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">Total que Te Deben</p>
                 <p className="text-5xl font-headline font-bold">${incomingResult.total.toFixed(2)}</p>
              </div>
              <CardContent className="p-6 space-y-8">
                {myIncomingLoading ? <Loader2 className="animate-spin mx-auto" /> : incomingResult.total === 0 ? (
                  <div className="py-6 text-center opacity-30 font-bold uppercase text-[10px]">No tienes cobros pendientes</div>
                ) : (
                  <>
                    {incomingResult.review.length > 0 && (
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded">Pendientes de Validación</h3>
                        {incomingResult.review.map(group => {
                          const debtor = profilesMap[group.debtorId];
                          return (
                            <div key={group.id} className="space-y-3">
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary"><User className="h-4 w-4" /></div>
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-black uppercase text-primary block">{debtor?.displayName || '...'} reportó pago</span>
                                    <span className="text-[8px] text-muted-foreground uppercase">{new Date(group.updatedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <Button 
                                  size="sm" 
                                  className="h-8 rounded-xl text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => setSelectedValidationGroup({ ...group, name: debtor?.displayName || 'Usuario' })}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Validar ${group.total.toFixed(2)}
                                </Button>
                              </div>
                              <div className="space-y-2 pl-2 border-l-2 border-secondary/20">
                                {group.debts.map(debt => (
                                  <div key={debt.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-xl text-xs">
                                     <div className="min-w-0 pr-2">
                                       <p className="text-[8px] font-black opacity-50 uppercase">{debt.groupName}</p>
                                       <p className="font-bold truncate">{debt.description}</p>
                                     </div>
                                     <span className="font-bold text-secondary shrink-0">${debt.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {incomingResult.pending.length > 0 && (
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 w-fit px-2 py-1 rounded">Deudas Pendientes</h3>
                        {incomingResult.pending.map(group => {
                          const debtor = profilesMap[group.debtorId];
                          return (
                            <div key={group.debtorId} className="space-y-3">
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><User className="h-4 w-4" /></div>
                                  <span className="text-[11px] font-black uppercase text-primary">{debtor?.displayName || '...'} te debe</span>
                                </div>
                                <span className="text-sm font-black text-primary font-headline">${group.total.toFixed(2)}</span>
                              </div>
                              <div className="space-y-2 pl-2 border-l-2 border-muted">
                                {group.debts.map(debt => (
                                  <div key={debt.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-xl text-xs">
                                     <div className="min-w-0 pr-2">
                                       <p className="text-[8px] font-black opacity-50 uppercase">{debt.groupName}</p>
                                       <p className="font-bold truncate">{debt.description}</p>
                                     </div>
                                     <span className="font-bold text-muted-foreground shrink-0">${debt.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <Dialog open={!!selectedDebtGroup} onOpenChange={val => !val && setSelectedDebtGroup(null)}>
        <DialogContent className="rounded-[2.5rem] border-none p-8 max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-accent"><Send className="h-8 w-8" /></div>
            <DialogTitle className="text-2xl font-headline font-bold">Reportar Transferencia</DialogTitle>
            <DialogDescription className="text-xs pt-2">
              ¿Confirmas que transferiste <strong>${selectedDebtGroup?.total.toFixed(2)}</strong> a <strong>{selectedDebtGroup?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
             <div className="bg-primary/5 p-4 rounded-xl text-left space-y-2 border border-primary/10">
                <Label className="text-[9px] uppercase font-black text-muted-foreground">Cuentas de {selectedDebtGroup?.name}</Label>
                <div className="font-mono text-[10px] whitespace-pre-wrap leading-relaxed">
                  {profilesMap[selectedDebtGroup?.creditorId || '']?.transferDetails || "Sin datos."}
                </div>
             </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button disabled={isProcessing} className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg" onClick={handleReportPayment}>
              {isProcessing ? <Loader2 className="animate-spin" /> : "Confirmar Envío"}
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedDebtGroup(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedValidationGroup} onOpenChange={val => !val && setSelectedValidationGroup(null)}>
        <DialogContent className="rounded-[2.5rem] border-none p-8 max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <DialogTitle className="text-2xl font-headline font-bold">Validar Cobro</DialogTitle>
            <DialogDescription className="text-xs pt-2">
              ¿Confirmas que recibiste <strong>${selectedValidationGroup?.total.toFixed(2)}</strong> de <strong>{selectedValidationGroup?.name}</strong> en tu cuenta?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-[10px] text-muted-foreground bg-emerald-50 p-4 rounded-2xl border border-emerald-100 font-medium">
             Al validar, estas deudas se marcarán como pagadas definitivamente para ambos.
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <Button disabled={isProcessing} className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold text-lg shadow-lg" onClick={handleValidatePayment}>
              {isProcessing ? <Loader2 className="animate-spin" /> : "Confirmar Recepción"}
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedValidationGroup(null)}>Aún no recibí nada</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({ g }: { g: Group }) {
  return (
    <Link href={`/dashboard/groups/${g.id}`}>
      <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group shadow-sm border border-primary/5 h-full">
        <div className="h-1.5 bg-primary w-full" />
        <CardHeader className="pb-4">
          <CardTitle className="mt-2 text-lg font-headline group-hover:text-primary transition-colors truncate">{g.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t font-bold uppercase">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.memberIds.length} MIEMBROS</span>
            <span className="text-primary flex items-center">VER <ChevronRight className="h-3 w-3" /></span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
