"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { 
  getGroupMembersDetails, 
  addDebt, 
  addFixedDebtToAll, 
  createReceipt, 
  claimReceiptItem, 
  finalizeReceipt, 
  updateDebtStatusInGroup, 
  getUserProfile,
  generateDebtSummary
} from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem, Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, Share2, AlertCircle, CheckCircle2, QrCode, 
  UserPlus, ScanLine, Loader2, DollarSign, Users, 
  CreditCard, Copy, BrainCircuit, ReceiptText, ChevronRight, User, TextCursorInput
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, query, orderBy, where, updateDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseMode, setExpenseMode] = useState<'manual' | 'event' | 'item'>('manual');
  const [divideEqually, setDivideEqually] = useState(true);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  
  const [pastedText, setPastedText] = useState("");
  const [parsedItems, setParsedItems] = useState<Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>>([]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creditorId, setCreditorId] = useState<string>("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [expandedGastoId, setExpandedGastoId] = useState<string | null>(null);

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [creditorProfile, setCreditorProfile] = useState<UserProfile | null>(null);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return doc(firestore, 'groups', params.id);
  }, [firestore, params.id, user?.uid]);
  const { data: group, isLoading: groupLoading } = useDoc<Group>(groupRef);

  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(collection(firestore, 'groups', params.id, 'debts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user?.uid]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const receiptsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(collection(firestore, 'groups', params.id, 'receipts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user?.uid]);
  const { data: receipts } = useCollection<Receipt>(receiptsQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(
      collection(firestore, 'events'), 
      where('groupId', '==', params.id), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore, params.id, user?.uid]);
  const { data: events } = useCollection<Event>(eventsQuery);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
    if (user?.uid) {
      setCreditorId(user.uid);
    }
  }, [group?.memberIds, user?.uid]);

  const handleEventSelect = (eventId: string) => {
    const event = events?.find(e => e.id === eventId);
    if (event) {
      setSelectedEventId(eventId);
      setExpenseTitle(event.costConcept || event.title);
      setExpenseAmount(event.totalCost.toString());
      setCreditorId(event.creatorId);

      // Lógica de candidatos consolidados: Presentes + Ausentes (si aplica)
      const absentIds = event.participantIds.filter(id => !event.presentIds.includes(id));
      const candidates = [...(event.presentIds || [])];
      if (event.chargeAbsentees) {
        absentIds.forEach(id => {
          if (!candidates.includes(id)) candidates.push(id);
        });
      }
      setSelectedMembers(candidates);

      // Precarga precisa de manualAmounts mapeando cabezas + invitados
      const totalPresentParticipants = event.presentIds?.length || 0;
      const totalPresentGuests = event.externalGuests?.filter(g => g.present).length || 0;
      const totalAbsents = absentIds.length;
      const totalHeads = totalPresentParticipants + totalPresentGuests + (event.chargeAbsentees ? totalAbsents : 0);
      const costPerPerson = totalHeads > 0 ? event.totalCost / totalHeads : 0;

      const initialManuals: Record<string, string> = {};
      candidates.forEach(uid => {
        const isPresent = event.presentIds.includes(uid);
        const myGuestsCount = event.externalGuests?.filter(g => g.addedBy === uid && g.present).length || 0;
        
        let multiplier = 0;
        if (isPresent) multiplier += 1;
        multiplier += myGuestsCount;
        if (!isPresent && event.chargeAbsentees) multiplier += 1;

        initialManuals[uid] = (costPerPerson * multiplier).toFixed(2);
      });
      setManualAmounts(initialManuals);
    }
  };

  // Intercepta los query params del Punto 2 para abrir automáticamente el Registrar Gasto basado en Evento
  useEffect(() => {
    if (typeof window !== 'undefined' && events && events.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const openExpense = urlParams.get('openExpense');
      const evId = urlParams.get('eventId');
      if (openExpense === 'true' && evId) {
        // Limpiamos los query params para evitar loops
        window.history.replaceState({}, document.title, window.location.pathname);
        setAddingExpense(true);
        setExpenseMode('event');
        handleEventSelect(evId);
      }
    }
  }, [events]);

  const isAdmin = group?.adminId === user?.uid;

  const groupedExpenses = useMemo(() => {
    if (!debts) return [];
    const groupsMap: Record<string, Debt[]> = {};
    debts.forEach(debt => {
      const gid = debt.chargeGroupId || debt.id;
      if (!groupsMap[gid]) groupsMap[gid] = [];
      groupsMap[gid].push(debt);
    });
    return Object.entries(groupsMap).map(([id, debtsList]) => ({
      id,
      creditorId: debtsList[0].creditorId,
      description: debtsList[0].description,
      totalAmount: debtsList.reduce((sum, d) => sum + d.amount, 0),
      createdAt: debtsList[0].createdAt,
      debts: debtsList,
      paidCount: debtsList.filter(d => d.status === 'paid').length,
      totalCount: debtsList.length
    })).sort((a, b) => b.createdAt - a.createdAt);
  }, [debts]);

  const manualSum = useMemo(() => {
    return Object.values(manualAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  }, [manualAmounts]);

  const totalTarget = useMemo(() => {
    return parseFloat(expenseAmount) || 0;
  }, [expenseAmount]);

  const difference = useMemo(() => {
    return totalTarget - manualSum;
  }, [totalTarget, manualSum]);

  const handleGenerateAiSummary = async () => {
    if (!group || !debts || !members) return;
    setIsGeneratingSummary(true);
    try {
      const result = await generateDebtSummary({
        groupName: group.name,
        members: members.map(m => ({ id: m.uid, name: m.displayName || 'Usuario' })),
        debts: debts.map(d => ({
          id: d.id,
          debtorId: d.debtorId,
          amount: d.amount,
          description: d.description,
          status: d.status
        }))
      });
      setAiSummary(result.summary);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el resumen con IA." });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleParseItems = () => {
    const lines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
    const items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length < 2) {
        toast({ variant: "destructive", title: "Error de formato", description: `Línea ${i + 1} inválida.` });
        return;
      }
      const name = parts[0].trim();
      const quantity = parseInt(parts[1]) || 1;
      const unitPrice = parseFloat(parts[2]) || 0;
      const totalPrice = parseFloat(parts[3]) || (quantity * unitPrice) || 0;
      items.push({ name, quantity, unitPrice, totalPrice });
    }
    
    setParsedItems(items);
    const sum = items.reduce((acc, item) => acc + item.totalPrice, 0);
    setExpenseAmount(sum.toString());
    toast({ title: "Boleta Procesada", description: `Extraídos ${items.length} ítems.` });
  };

  const handleRegisterExpense = async () => {
    if (expenseMode === 'item') {
      if (parsedItems.length === 0) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Procesa la boleta primero." });
        return;
      }
      setIsActionLoading(true);
      try {
        await createReceipt(params.id, parsedItems.map(it => ({ name: it.name, price: it.totalPrice })), creditorId || user!.uid);
        toast({ title: "Boleta Activa Creada" });
        setAddingExpense(false);
        resetExpenseForm();
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    if (!expenseTitle || !expenseAmount || !creditorId) {
      toast({ variant: "destructive", title: "Faltan datos" });
      return;
    }

    setIsActionLoading(true);
    try {
      if (divideEqually) {
        if (selectedMembers.length === 0) {
          toast({ variant: "destructive", title: "Selecciona participantes" });
          setIsActionLoading(false);
          return;
        }
        const amountPerPerson = parseFloat(expenseAmount) / selectedMembers.length;
        await addFixedDebtToAll(params.id, amountPerPerson, expenseTitle, selectedMembers, creditorId);
      } else {
        if (Math.abs(difference) > 0.01) {
          toast({ variant: "destructive", title: "Monto no cuadra", description: `Diferencia: $${difference.toFixed(2)}` });
          setIsActionLoading(false);
          return;
        }
        const chargeGroupId = Math.random().toString(36).substring(7);
        for (const uid of Object.keys(manualAmounts)) {
          const amt = parseFloat(manualAmounts[uid]) || 0;
          if (amt > 0) {
            await addDebt(params.id, uid, amt, expenseTitle, creditorId, chargeGroupId);
          }
        }
      }

      // Cumplimiento del Punto 2: Si el gasto provino de un evento, se congela y liquida dicho evento
      if (expenseMode === 'event' && selectedEventId) {
        await updateDoc(doc(firestore, 'events', selectedEventId), { isCharged: true });
        toast({ title: "¡Evento Liquidado con Éxito!", description: "El evento quedó cerrado y las deudas asignadas." });
      } else {
        toast({ title: "Gasto Registrado Correctamente" });
      }

      setAddingExpense(false);
      resetExpenseForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseTitle("");
    setExpenseAmount("");
    setSelectedMembers([]);
    setCreditorId(user?.uid || "");
    setSelectedEventId(null);
    setDivideEqually(true);
    setManualAmounts({});
    setPastedText("");
    setParsedItems([]);
  };

  const copyAiPrompt = () => {
    const promptText = `Analiza la imagen de esta boleta/factura y devuélveme SOLO una lista, un ítem por línea, en este formato exacto sin encabezados ni texto adicional:
nombre_item;cantidad;precio_unitario;precio_total

Ejemplo:
Cerveza;4;2500;10000
Papas fritas;2;3500;7000`;
    navigator.clipboard.writeText(promptText);
    toast({ title: "Prompt Copiado" });
  };

  const showCreditorDetails = async (cid: string) => {
    const profile = await getUserProfile(cid);
    setCreditorProfile(profile);
  };

  if (groupLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 opacity-50 mb-4" /><p>Grupo no encontrado.</p></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="rounded-lg">Balance BalanceHub</Badge>
            • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl h-10" onClick={handleGenerateAiSummary} disabled={isGeneratingSummary}>
            {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-accent" />}
            Resumen IA
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl h-10" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          <Button size="sm" onClick={() => setAddingExpense(true)} className="bg-primary hover:bg-primary/90 gap-2 rounded-xl h-10 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Registrar Gasto
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="border-b pb-6">
            <CardTitle className="text-lg font-headline">Historial de Gastos</CardTitle>
            <CardDescription className="text-xs">Cobros agrupados por evento o registro manual colaborativo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {groupedExpenses.map(expense => (
                <div key={expense.id} className="group">
                  <div 
                    className={cn(
                      "flex items-center justify-between p-5 hover:bg-muted/30 cursor-pointer transition-colors",
                      expandedGastoId === expense.id && "bg-muted/20"
                    )}
                    onClick={() => setExpandedGastoId(expandedGastoId === expense.id ? null : expense.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{expense.description}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                          <User className="h-2.5 w-2.5" /> Acreedor: {members.find(m => m.uid === expense.creditorId)?.displayName || '...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">${expense.totalAmount.toFixed(2)}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {expense.paidCount}/{expense.totalCount} PAGADOS
                        </p>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedGastoId === expense.id && "rotate-90")} />
                    </div>
                  </div>
                  
                  {expandedGastoId === expense.id && (
                    <div className="bg-muted/10 p-4 space-y-3 border-t">
                      <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desglose Individual</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-accent hover:text-accent hover:bg-accent/10 rounded-lg"
                          onClick={() => showCreditorDetails(expense.creditorId)}
                        >
                          <CreditCard className="h-3 w-3 mr-1" /> Ver Datos de Pago
                        </Button>
                      </div>
                      {expense.debts.map(debt => (
                        <div key={debt.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-primary/5 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                              {members.find(m => m.uid === debt.debtorId)?.displayName?.[0] || '?'}
                            </div>
                            <span className="text-xs font-bold">{members.find(m => m.uid === debt.debtorId)?.displayName || 'Usuario'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-primary">${debt.amount.toFixed(2)}</span>
                            {debt.status === 'paid' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] border-orange-200 text-orange-600 bg-orange-50 font-bold px-1.5">Pendiente</Badge>
                                {(isAdmin || expense.creditorId === user?.uid) && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                    onClick={() => updateDebtStatusInGroup(params.id, debt.id, 'paid')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {groupedExpenses.length === 0 && (
                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                  <ReceiptText className="h-12 w-12 mb-2" />
                  <p className="font-bold text-xs uppercase tracking-widest">Sin gastos registrados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
           {receipts?.filter(r => r.status === 'open').map(receipt => (
            <Card key={receipt.id} className="border-accent/30 shadow-md rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-accent/5 pb-3 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ScanLine className="h-4 w-4" /> Boleta Activa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                <div className="divide-y">
                  {receipt.items.map(item => (
                    <div key={item.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-primary">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">${item.price.toFixed(2)}</p>
                      </div>
                      
                      <div className="space-y-2 bg-muted/20 p-2.5 rounded-xl text-[11px]">
                        <div className="grid grid-cols-1 gap-2">
                          {members.map(m => {
                            const claimKey = `${item.id}_${m.uid}`;
                            const currentPercentage = receipt.claims?.[claimKey] || 0;
                            const isClaimed = currentPercentage > 0;
                            
                            return (
                              <div key={m.uid} className="flex items-center justify-between bg-white p-2 rounded-lg border border-transparent">
                                <div className="flex items-center gap-2 truncate max-w-[150px]">
                                  <Checkbox 
                                    checked={isClaimed} 
                                    onCheckedChange={(val) => {
                                      claimReceiptItem(params.id, receipt.id, item.id, m.uid, val ? 100 : 0);
                                    }} 
                                    className="h-4 w-4 rounded" 
                                  />
                                  <span className="font-bold text-xs truncate">{m.displayName}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="p-4 bg-accent/5 border-t flex flex-col gap-2">
                <Button className="w-full bg-accent text-xs font-black uppercase" onClick={() => finalizeReceipt(params.id, receipt.id, receipt.items, receipt.claims, receipt.creditorId)}>Finalizar Boleta</Button>
              </CardFooter>
            </Card>
          ))}

          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3 text-xs p-2.5 rounded-2xl bg-muted/20">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{m.displayName?.[0] || 'U'}</div>
                  <div className="flex-1 min-w-0"><p className="font-bold truncate text-primary/80">{m.displayName}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-8 border-none overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold">Registrar Gasto</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1 rounded-2xl">
              <Button variant={expenseMode === 'manual' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[11px] font-bold" onClick={() => setExpenseMode('manual')}>Manual</Button>
              <Button variant={expenseMode === 'event' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[11px] font-bold" onClick={() => setExpenseMode('event')}>Por Evento</Button>
              <Button variant={expenseMode === 'item' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[11px] font-bold" onClick={() => setExpenseMode('item')}>Por Ítem (IA)</Button>
            </div>

            {expenseMode === 'event' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1">Seleccionar Evento</Label>
                <Select onValueChange={handleEventSelect} value={selectedEventId || ""}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Elegir un evento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map(ev => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({ev.date}) - ${ev.totalCost}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1">Acreedor (Quién pagó)</Label>
              <Select value={creditorId} onValueChange={setCreditorId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Seleccionar acreedor" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.uid} value={m.uid} className="text-xs">{m.displayName} {m.uid === user?.uid ? "(Tú)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {expenseMode !== 'item' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1">Concepto del Gasto</Label>
                    <Input placeholder="Ej: Pizza post-partido" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1">Monto Total ($)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-12 pl-9 rounded-xl font-bold" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border">
                  <div className="space-y-0.5"><Label className="text-xs font-bold">Dividir en partes iguales</Label></div>
                  <Switch checked={divideEqually} onCheckedChange={(val) => { setDivideEqually(val); }} />
                </div>

                {divideEqually ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 bg-muted/20 p-4 rounded-[2rem] max-h-48 overflow-y-auto">
                      {members.map(m => (
                        <div key={m.uid} className={cn("flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer", selectedMembers.includes(m.uid) ? "bg-primary/5 border-primary/20" : "bg-white")} onClick={() => setSelectedMembers(prev => prev.includes(m.uid) ? prev.filter(id => id !== m.uid) : [...prev, m.uid])}>
                          <Checkbox checked={selectedMembers.includes(m.uid)} className="h-4 w-4 rounded-md" />
                          <span className="text-[11px] font-bold truncate">{m.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 bg-muted/20 p-4 rounded-[2rem] max-h-60 overflow-y-auto">
                      {members.map(m => (
                        <div key={m.uid} className="flex items-center justify-between bg-white p-3 rounded-xl border">
                          <span className="text-xs font-bold truncate">{m.displayName}</span>
                          <Input type="number" placeholder="0.00" className="h-9 w-32 font-bold" value={manualAmounts[m.uid] || ""} onChange={(e) => setManualAmounts({ ...manualAmounts, [m.uid]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <div className={cn("p-4 rounded-2xl text-xs font-bold flex justify-between", Math.abs(difference) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                      <span>Total Asignado: ${manualSum.toFixed(2)} / Objetivo: ${totalTarget.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <Button type="button" onClick={copyAiPrompt} className="w-full">Copiar prompt para IA</Button>
                <Textarea placeholder="Pega el resultado estructurado aquí" className="min-h-[110px]" value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
                <Button type="button" className="w-full" onClick={handleParseItems}>Procesar Texto de Boleta</Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button className="rounded-xl px-8 h-12" onClick={handleRegisterExpense} disabled={isActionLoading || (!divideEqually && expenseMode !== 'item' && Math.abs(difference) > 0.01)}>Confirmar Gasto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditorProfile} onOpenChange={() => setCreditorProfile(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none text-center">
          <DialogHeader><DialogTitle className="text-2xl font-headline font-bold">Datos de Pago</DialogTitle></DialogHeader>
          <div className="bg-muted/30 p-6 rounded-[2rem] font-mono text-left whitespace-pre-wrap">
            {creditorProfile?.transferDetails || "El acreedor no cargó sus instrucciones bancarias."}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 text-center border-none">
          <DialogHeader><DialogTitle>Enlace de Invitación</DialogTitle></DialogHeader>
          <Input readOnly value={group.inviteLink} className="text-center h-11" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
