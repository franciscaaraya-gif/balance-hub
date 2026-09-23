"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { 
  getGroupMembersDetails, 
  reportPayment, 
  validatePayment 
} from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Users, ChevronRight, Loader2, 
  AlertCircle, Clock, CheckCircle2, 
  CreditCard, User, Send, ArrowUpRight, ArrowDownLeft, Calendar,
  ChevronDown, ChevronUp, Zap, Sparkles, Pin
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup, orderBy, doc } from "firebase/firestore";
import { cn, formatCurrency } from "@/lib/utils";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedDebtGroup, setSelectedDebtGroup] = useState<{ creditorId: string; total: number; debts: Debt[]; name: string } | null>(null);
  const [selectedValidationGroup, setSelectedValidationGroup] = useState<{ id: string; debtorId: string; total: number; debts: Debt[]; name: string } | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: myGroups } = useCollection<Group>(myGroupsQuery);

  const pinnedGroups = useMemo(() => {
    if (!myGroups || !profile?.pinnedGroupIds) return [];
    return myGroups.filter(g => profile.pinnedGroupIds?.includes(g.id));
  }, [myGroups, profile?.pinnedGroupIds]);

  const groupIds = myGroups?.map(g => g.id) || [];
  const groupIdsKey = groupIds.join(',');

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || groupIds.length === 0) return null;
    return query(collection(firestore, 'events'), where('groupId', 'in', groupIds));
  }, [firestore, user?.uid, groupIdsKey]);
  const { data: allEvents } = useCollection<Event>(eventsQuery);
  
  const activeEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents
      .filter(e => !e.isCharged && !e.isArchived)
      .sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeB === timeA) return b.id.localeCompare(a.id);
        return timeB - timeA;
      });
  }, [allEvents]);

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
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-10 px-1 sm:px-4">
      <div className="px-2 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName?.split(' ')[0]}!</h1>
        <p className="text-sm text-muted-foreground">Bienvenido a Zygos — cuentas claras con tu grupo.</p>
      </div>

      <div className="block md:hidden space-y-6">
        <div className="space-y-6">
          <WalletSection 
            outgoingGroups={outgoingGroups} 
            incomingResult={incomingResult} 
            myDebtsLoading={myDebtsLoading} 
            myIncomingLoading={myIncomingLoading} 
            profilesMap={profilesMap} 
            getStatusBadge={getStatusBadge} 
            setSelectedDebtGroup={setSelectedDebtGroup} 
            setSelectedValidationGroup={setSelectedValidationGroup} 
            myDebts={myDebts || []}
            myIncomingDebts={myIncomingDebts || []}
          />
        </div>

        <div className="space-y-4 px-2 sm:px-0">
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white border-primary/10 shadow-sm active:scale-[0.98] transition-all">
              <Link href="/dashboard/groups">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-tight text-primary">Mis grupos</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-white border-primary/10 shadow-sm active:scale-[0.98] transition-all">
              <Link href="/dashboard/attendance">
                <Calendar className="h-4 w-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-tight text-primary">Eventos</span>
              </Link>
            </Button>
          </div>

          {pinnedGroups.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                <Pin className="h-3 w-3 text-accent" /> Accesos Rápidos
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {pinnedGroups.map(g => (
                  <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="bg-white p-4 rounded-2xl border border-primary/5 shadow-sm active:scale-[0.98] transition-all">
                    <p className="text-xs font-bold text-primary truncate">{g.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1 uppercase font-black">
                      Ir <ChevronRight className="h-2 w-2" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <WalletSection 
            outgoingGroups={outgoingGroups} 
            incomingResult={incomingResult} 
            myDebtsLoading={myDebtsLoading} 
            myIncomingLoading={myIncomingLoading} 
            profilesMap={profilesMap} 
            getStatusBadge={getStatusBadge} 
            setSelectedDebtGroup={setSelectedDebtGroup} 
            setSelectedValidationGroup={setSelectedValidationGroup} 
            myDebts={myDebts || []}
            myIncomingDebts={myIncomingDebts || []}
            defaultExpanded={true}
          />
        </div>

        <div className="space-y-6">
          {pinnedGroups.length > 0 && (
            <Card className="border-accent/20 border-2 shadow-sm bg-white rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-3 border-b bg-accent/5">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Pin className="h-4 w-4" /> Accesos Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {pinnedGroups.map(g => (
                  <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-bold text-primary truncate pr-2">{g.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Users className="h-4 w-4" /> Mis Grupos
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs font-bold text-accent p-0 h-auto hover:bg-transparent">
                <Link href="/dashboard/groups">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {myGroups?.slice(0, 3).map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-bold text-primary truncate pr-2">{g.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
              {(!myGroups || myGroups.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin grupos activos.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Eventos Activos
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs font-bold text-accent p-0 h-auto hover:bg-transparent">
                <Link href="/dashboard/attendance">Gestionar</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {activeEvents.slice(0, 3).map(e => (
                <Link key={e.id} href={`/dashboard/attendance/${e.id}`} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{e.title}</p>
                    <p className="text-[9px] text-muted-foreground">{e.date}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
              {activeEvents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin eventos próximos.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedDebtGroup} onOpenChange={val => !val && setSelectedDebtGroup(null)}>
        <DialogContent className="rounded-[2.5rem] border-none p-8 w-[95vw] max-w-sm text-center mx-auto">
          <DialogHeader>
            <div className="mx-auto bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-accent"><Send className="h-8 w-8" /></div>
            <DialogTitle className="text-2xl font-headline font-bold text-primary">Reportar Transferencia</DialogTitle>
            <DialogDescription className="text-xs pt-2">
              ¿Confirmas que transferiste <strong>{formatCurrency(selectedDebtGroup?.total || 0)}</strong> a <strong>{selectedDebtGroup?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
             <div className="bg-primary/5 p-4 rounded-xl text-left space-y-2 border border-primary/10">
                <Label className="text-[9px] uppercase font-black text-muted-foreground">Cuentas de {selectedDebtGroup?.name}</Label>
                <div className="font-mono text-[10px] whitespace-pre-wrap leading-relaxed break-words">
                  {profilesMap[selectedDebtGroup?.creditorId || '']?.transferDetails || "Sin datos."}
                </div>
             </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button disabled={isProcessing} className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg" onClick={handleReportPayment}>
              {isProcessing ? <Loader2 className="animate-spin" /> : `Confirmar Envío`}
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedDebtGroup(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedValidationGroup} onOpenChange={val => !val && setSelectedValidationGroup(null)}>
        <DialogContent className="rounded-[2.5rem] border-none p-8 w-[95vw] max-w-sm text-center mx-auto">
          <DialogHeader>
            <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <DialogTitle className="text-2xl font-headline font-bold text-primary">Validar Cobro</DialogTitle>
            <DialogDescription className="text-xs pt-2">
              ¿Confirmas que recibiste <strong>{formatCurrency(selectedValidationGroup?.total || 0)}</strong> de <strong>{selectedValidationGroup?.name}</strong> en tu cuenta?
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

interface WalletSectionProps {
  outgoingGroups: any[];
  incomingResult: any;
  myDebtsLoading: boolean;
  myIncomingLoading: boolean;
  profilesMap: Record<string, UserProfile>;
  getStatusBadge: (status: string) => React.ReactNode;
  setSelectedDebtGroup: (val: any) => void;
  setSelectedValidationGroup: (val: any) => void;
  myDebts: Debt[];
  myIncomingDebts: Debt[];
  defaultExpanded?: boolean;
}

function WalletSection({
  outgoingGroups,
  incomingResult,
  myDebtsLoading,
  myIncomingLoading,
  profilesMap,
  getStatusBadge,
  setSelectedDebtGroup,
  setSelectedValidationGroup,
  myDebts,
  myIncomingDebts,
  defaultExpanded = false
}: WalletSectionProps) {
  const [isDebesExpanded, setIsDebesExpanded] = useState(defaultExpanded);
  const [isTeDebenExpanded, setIsTeDebenExpanded] = useState(defaultExpanded);
  const [expandedNettingPersonId, setExpandedNettingPersonId] = useState<string | null>(null);

  const pendingReviewTotal = incomingResult.review.reduce((sum: number, r: any) => sum + r.total, 0);
  const pendingNormalTotal = incomingResult.pending.reduce((sum: number, p: any) => sum + p.total, 0);
  const totalTeDebenConsolidado = pendingReviewTotal + pendingNormalTotal;

  const totalOutgoingAmount = outgoingGroups.reduce((sum, g) => sum + g.total, 0);
  const totalOutgoingCount = outgoingGroups.reduce((sum, g) => sum + g.debts.length, 0);

  const totalIncomingCount = incomingResult.review.reduce((sum: number, g: any) => sum + g.debts.length, 0) +
                             incomingResult.pending.reduce((sum: number, g: any) => sum + g.debts.length, 0);

  const smartNettings = useMemo(() => {
    const netMap: Record<string, { owesMe: number; iOweThem: number; myDebtsList: Debt[]; theirDebtsList: Debt[] }> = {};

    myDebts.filter(d => d.status !== 'paid' && d.debtorId !== d.creditorId).forEach(debt => {
      const cid = debt.creditorId;
      if (!netMap[cid]) {
        netMap[cid] = { owesMe: 0, iOweThem: 0, myDebtsList: [], theirDebtsList: [] };
      }
      netMap[cid].iOweThem += debt.amount;
      netMap[cid].myDebtsList.push(debt);
    });

    myIncomingDebts.filter(d => d.status !== 'paid' && d.debtorId !== d.creditorId).forEach(debt => {
      const did = debt.debtorId;
      if (!netMap[did]) {
        netMap[did] = { owesMe: 0, iOweThem: 0, myDebtsList: [], theirDebtsList: [] };
      }
      netMap[did].owesMe += debt.amount;
      netMap[did].theirDebtsList.push(debt);
    });

    return Object.entries(netMap)
      .map(([personId, data]) => {
        const netValue = data.iOweThem - data.owesMe;
        return {
          personId,
          netValue,
          totalInvolvedDebts: data.myDebtsList.length + data.theirDebtsList.length,
          ...data
        };
      })
      .filter(item => item.iOweThem > 0 && item.owesMe > 0 && Math.abs(item.netValue) > 0.01);
  }, [myDebts, myIncomingDebts]);

  return (
    <div className="space-y-4">
      {smartNettings.length > 0 && (
        <section className="space-y-2 px-2 sm:px-0">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary ml-2">
            <Zap className="h-4 w-4 text-accent animate-bounce" /> Pago Inteligente (Neteo)
          </h2>
          <Card className="border-2 border-accent/20 bg-amber-50/20 shadow-sm rounded-[2rem] overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground px-1 pb-2 border-b border-dashed">
                <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p className="font-medium text-[10px] sm:text-[11px] leading-snug">
                  Zygos detectó deudas cruzadas. Sugerimos resolver el saldo neto en una transferencia.
                </p>
              </div>
              <div className="space-y-2">
                {smartNettings.map(netItem => {
                  const personProfile = profilesMap[netItem.personId];
                  const personName = personProfile?.displayName || "Miembro";
                  const isExpanded = expandedNettingPersonId === netItem.personId;

                  return (
                    <div key={netItem.personId} className="border bg-white rounded-2xl overflow-hidden shadow-sm transition-all">
                      <div 
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/10 active:bg-muted/20"
                        onClick={() => setExpandedNettingPersonId(isExpanded ? null : netItem.personId)}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-[11px] sm:text-xs font-bold text-primary">
                            {netItem.netValue > 0 
                              ? `Pagas ${formatCurrency(netItem.netValue)} a ${personName}`
                              : `${personName} te paga ${formatCurrency(Math.abs(netItem.netValue))}`
                            }
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium mt-0.5">
                            Resuelven {netItem.totalInvolvedDebts} cuentas.
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-xl text-accent font-black text-[9px] uppercase">
                          <span>Ver</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-muted/10 p-3 border-t space-y-2 text-xs">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Cuentas Involucradas:</p>
                          {netItem.myDebtsList.map(debt => (
                            <div key={debt.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-100 shadow-inner">
                              <div className="min-w-0 pr-2">
                                <span className="text-[8px] bg-red-50 text-red-700 px-1 py-0.5 rounded font-bold uppercase tracking-tight mr-1.5">Debes</span>
                                <span className="font-medium text-[10px] sm:text-[11px] text-primary truncate">{debt.description}</span>
                              </div>
                              <span className="font-bold text-red-600 shrink-0 text-[10px] sm:text-[11px]">{formatCurrency(debt.amount)}</span>
                            </div>
                          ))}
                          {netItem.theirDebtsList.map(debt => (
                            <div key={debt.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-emerald-100 shadow-inner">
                              <div className="min-w-0 pr-2">
                                <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded font-bold uppercase tracking-tight mr-1.5">Te debe</span>
                                <span className="font-medium text-[10px] sm:text-[11px] text-primary truncate">{debt.description}</span>
                              </div>
                              <span className="font-bold text-emerald-600 shrink-0 text-[10px] sm:text-[11px]">{formatCurrency(debt.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 text-orange-600 ml-2">
          <ArrowUpRight className="h-4 w-4" /> Billetera: Pagos
        </h2>
        <Card className={cn(
          "border-none shadow-md bg-white rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden transition-all duration-300",
          !isDebesExpanded && "cursor-pointer hover:shadow-lg active:scale-[0.99]"
        )} onClick={() => !isDebesExpanded && setIsDebesExpanded(true)}>
          <div className={cn(
            "bg-primary p-5 sm:p-8 text-primary-foreground text-center relative transition-all",
            !isDebesExpanded ? "py-4" : "py-6 sm:py-8"
          )}>
             <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Debes</p>
             <div className="flex flex-col items-center">
               <p className={cn("font-headline font-bold transition-all", !isDebesExpanded ? "text-2xl" : "text-3xl sm:text-5xl")}>
                 {formatCurrency(totalOutgoingAmount)}
               </p>
               {!isDebesExpanded && (
                 <p className="text-[9px] font-bold opacity-70 mt-0.5">
                   {totalOutgoingCount} {totalOutgoingCount === 1 ? 'pendiente' : 'pendientes'}
                 </p>
               )}
             </div>
             {isDebesExpanded && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white/50 hover:text-white hover:bg-white/10"
                 onClick={(e) => { e.stopPropagation(); setIsDebesExpanded(false); }}
               >
                 <ChevronUp className="h-5 w-5" />
               </Button>
             )}
          </div>
          {isDebesExpanded && (
            <CardContent className="p-3 sm:p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
              {myDebtsLoading ? <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : outgoingGroups.length === 0 ? (
                <div className="py-6 text-center opacity-30"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase">Al día</p></div>
              ) : outgoingGroups.map(group => {
                const creditor = profilesMap[group.creditorId];
                return (
                  <div key={group.creditorId} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0"><User className="h-3.5 w-3.5" /></div>
                        <span className="text-[10px] font-black uppercase text-primary truncate">A {creditor?.displayName || '...'}</span>
                      </div>
                      <Button 
                        size="sm" 
                        className="h-8 rounded-xl text-[9px] font-black uppercase bg-accent text-white shrink-0"
                        onClick={() => setSelectedDebtGroup({ ...group, name: creditor?.displayName || 'Acreedor' })}
                      >
                        Pagar
                      </Button>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-accent/20">
                      {group.debts.map((debt: any) => (
                        <div key={debt.id} className="flex justify-between items-center p-2.5 sm:p-3 bg-muted/20 rounded-xl text-xs">
                           <div className="min-w-0 pr-2">
                             <p className="text-[8px] font-black opacity-50 uppercase truncate">{debt.groupName}</p>
                             <p className="font-bold truncate text-[10px] sm:text-xs">{debt.description}</p>
                           </div>
                           <div className="text-right shrink-0">
                             <p className="font-bold text-accent text-[10px] sm:text-xs">{formatCurrency(debt.amount)}</p>
                             {getStatusBadge(debt.status)}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-600 ml-2">
          <ArrowDownLeft className="h-4 w-4" /> Billetera: Cobros
        </h2>
        <Card className={cn(
          "border-none shadow-md bg-white rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden transition-all duration-300",
          !isTeDebenExpanded && "cursor-pointer hover:shadow-lg active:scale-[0.99]"
        )} onClick={() => !isTeDebenExpanded && setIsTeDebenExpanded(true)}>
          <div className={cn(
            "bg-secondary p-5 sm:p-8 text-white text-center relative transition-all",
            !isTeDebenExpanded ? "py-4" : "py-6 sm:py-8"
          )}>
             <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Te Deben</p>
             <div className="flex flex-col items-center">
               <p className={cn("font-headline font-bold transition-all", !isTeDebenExpanded ? "text-2xl" : "text-3xl sm:text-5xl")}>
                 {formatCurrency(totalTeDebenConsolidado)}
               </p>
               {!isTeDebenExpanded && (
                 <p className="text-[9px] font-bold opacity-70 mt-0.5">
                   {totalIncomingCount} {totalIncomingCount === 1 ? 'cobro' : 'cobros'}
                 </p>
               )}
             </div>
             {isTeDebenExpanded && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white/50 hover:text-white hover:bg-white/10"
                 onClick={(e) => { e.stopPropagation(); setIsTeDebenExpanded(false); }}
               >
                 <ChevronUp className="h-5 w-5" />
               </Button>
             )}
          </div>
          {isTeDebenExpanded && (
            <CardContent className="p-3 sm:p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
              {myIncomingLoading ? <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : totalTeDebenConsolidado === 0 ? (
                <div className="py-6 text-center opacity-30 font-bold uppercase text-[10px]">Sin cobros pendientes</div>
              ) : (
                <>
                  {incomingResult.review.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded">Por Validar</h3>
                      {incomingResult.review.map((group: any) => {
                        const debtor = profilesMap[group.debtorId];
                        return (
                          <div key={group.id} className="space-y-3 p-3 border rounded-2xl bg-blue-50/10 border-blue-100">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div className="h-7 w-7 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0"><User className="h-3.5 w-3.5" /></div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-black uppercase text-primary block truncate">{debtor?.displayName || '...'} reportó</span>
                                  <span className="text-[7px] text-muted-foreground uppercase">{new Date(group.updatedAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                className="h-8 rounded-xl text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
                                onClick={() => setSelectedValidationGroup({ ...group, name: debtor?.displayName || 'Usuario' })}
                              >
                                Validar
                              </Button>
                            </div>
                            <div className="space-y-2 pl-2 border-l-2 border-secondary/20">
                              {group.debts.map((debt: any) => (
                                <div key={debt.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl text-[10px] sm:text-xs shadow-inner">
                                   <div className="min-w-0 pr-2">
                                     <p className="text-[8px] font-black opacity-50 uppercase truncate">{debt.groupName}</p>
                                     <p className="font-bold truncate">{debt.description}</p>
                                   </div>
                                   <span className="font-bold text-secondary shrink-0">{formatCurrency(debt.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {incomingResult.pending.length > 0 && (
                    <div className="space-y-4 pt-2 border-t border-dashed">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 w-fit px-2 py-1 rounded">Pendientes</h3>
                      {incomingResult.pending.map((group: any) => {
                        const debtor = profilesMap[group.debtorId];
                        return (
                          <div key={group.debtorId} className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0"><User className="h-3.5 w-3.5" /></div>
                                <span className="text-[10px] font-black uppercase text-primary truncate">{debtor?.displayName || '...'} te debe</span>
                              </div>
                              <span className="text-xs sm:text-sm font-black text-primary font-headline shrink-0">{formatCurrency(group.total)}</span>
                            </div>
                            <div className="space-y-2 pl-2 border-l-2 border-muted">
                              {group.debts.map((debt: any) => (
                                <div key={debt.id} className="flex justify-between items-center p-2.5 sm:p-3 bg-muted/20 rounded-xl text-[10px] sm:text-xs">
                                   <div className="min-w-0 pr-2">
                                     <p className="text-[8px] font-black opacity-50 uppercase truncate">{debt.groupName}</p>
                                     <p className="font-bold truncate">{debt.description}</p>
                                   </div>
                                   <span className="font-bold text-muted-foreground shrink-0">{formatCurrency(debt.amount)}</span>
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
        )}
      </Card>
    </section>
  </div>
);
}
