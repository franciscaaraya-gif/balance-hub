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
  CreditCard, Copy, BrainCircuit, ReceiptText, ChevronRight, User
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
  const [includeTip, setIncludeTip] = useState(false);

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

      const absentIds = event.participantIds.filter(id => !event.presentIds.includes(id));
      const candidates = [...(event.presentIds || [])];
      if (event.chargeAbsentees) {
        absentIds.forEach(id => {
          if (!candidates.includes(id)) candidates.push(id);
        });
      }
      setSelectedMembers(candidates);

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

  useEffect(() => {
    if (typeof window !== 'undefined' && events && events.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const openExpense = urlParams.get('openExpense');
      const evId = urlParams.get('eventId');
      if (openExpense === 'true' && evId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setAddingExpense(true);
        setExpenseMode('event');
        handleEventSelect(evId);
      }
    }
  }, [events]);

  const isAdmin = group?.adminId === user?.uid;

  const aggregatedItemsTotal = useMemo(() => {
    return parsedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }, [parsedItems]);

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
        const event = selectedEventId ? events?.find(e => e.id === selectedEventId) : null;
        await createReceipt(
          params.id, 
          parsedItems.map(it => ({ name: it.name, price: it.totalPrice })), 
          creditorId || user!.uid, 
          includeTip,
          event?.externalGuests || []
        );
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
    setIncludeTip(false);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-0 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary truncate">{group.name}</h1>
          <div className="flex items-center gap-2 text-[10px] sm:text-sm text-muted-foreground font-medium mt-1">
            <Badge variant="secondary" className="rounded-lg text-[9px] uppercase font-black">Activo</Badge>
            <span>• {group.memberIds.length} Miembros</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-10 text-[10px] font-black uppercase" onClick={handleGenerateAiSummary} disabled={isGeneratingSummary}>
            {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-accent" />}
            Resumen IA
          </Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-10 text-[10px] font-black uppercase" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          <Button size="sm" onClick={() => setAddingExpense(true)} className="w-full md:w-auto bg-primary hover:bg-primary/90 gap-2 rounded-xl h-11 shadow-lg shadow-primary/20 text-[10px] font-black uppercase">
            <Plus className="h-4 w-4" /> Registrar Gasto
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b pb-6 px-4 sm:px-6">
              <CardTitle className="text-lg font-headline">Historial de Cobros</CardTitle>
              <CardDescription className="text-xs">Cobros agrupados por gasto o evento.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {groupedExpenses.map(expense => (
                  <div key={expense.id} className="group">
                    <div 
                      className={cn(
                        "flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 cursor-pointer transition-colors active:bg-muted/50",
                        expandedGastoId === expense.id && "bg-muted/20"
                      )}
                      onClick={() => setExpandedGastoId(expandedGastoId === expense.id ? null : expense.id)}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <ReceiptText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-primary truncate pr-2">{expense.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                              <User className="h-2.5 w-2.5" /> {members.find(m => m.uid === expense.creditorId)?.displayName?.split(' ')[0] || '...'}
                            </span>
                            <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-black uppercase tracking-tighter shrink-0">
                              {expense.paidCount}/{expense.totalCount} Pagos
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-6 shrink-0 ml-2">
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-black text-primary font-headline">${expense.totalAmount.toFixed(2)}</p>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", expandedGastoId === expense.id && "rotate-90")} />
                      </div>
                    </div>
                    
                    {expandedGastoId === expense.id && (
                      <div className="bg-muted/10 p-4 space-y-3 border-t">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-2 mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desglose Individual</span>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-9 text-[10px] font-bold text-accent hover:text-accent hover:bg-accent/10 rounded-xl w-full sm:w-auto"
                            onClick={() => showCreditorDetails(expense.creditorId)}
                          >
                            <CreditCard className="h-3 w-3 mr-2" /> Datos de Pago Acreedor
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {expense.debts.map(debt => (
                            <div key={debt.id} className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-primary/5 shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {members.find(m => m.uid === debt.debtorId)?.displayName?.[0] || '?'}
                                </div>
                                <span className="text-xs font-bold truncate pr-2">{members.find(m => m.uid === debt.debtorId)?.displayName || 'Usuario'}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-black text-primary">${debt.amount.toFixed(2)}</span>
                                {debt.status === 'paid' ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[8px] border-orange-200 text-orange-600 bg-orange-50 font-bold px-1.5 py-0.5">Pendiente</Badge>
                                    {(isAdmin || expense.creditorId === user?.uid) && (
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 border border-emerald-100"
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
                      </div>
                    )}
                  </div>
                ))}
                {groupedExpenses.length === 0 && (
                  <div className="text-center py-20 opacity-30 flex flex-col items-center">
                    <ReceiptText className="h-12 w-12 mb-2" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">Sin gastos registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
           {receipts?.filter(r => r.status === 'active').map(receipt => (
            <Card key={receipt.id} className="border-accent/30 shadow-lg rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-accent/5 pb-3 border-b px-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ScanLine className="h-4 w-4" /> Boleta Colaborativa {receipt.includeTip && " + 10% Propina"}
                </CardTitle>
                <p className="text-[9px] text-muted-foreground font-medium">Marca lo que consumiste, los cambios se ven al instante.</p>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] sm:max-h-[450px] overflow-y-auto">
                <div className="divide-y">
                  {receipt.items.map(item => (
                    <div key={item.id} className="p-4 space-y-3 hover:bg-muted/5 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-primary truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Checkboxes para miembros */}
                        {members.map(m => {
                          const claimKey = `${item.id}_${m.uid}`;
                          const currentPercentage = receipt.claims?.[claimKey] || 0;
                          const isClaimed = currentPercentage > 0;
                          
                          return (
                            <div 
                              key={m.uid} 
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-xl border transition-all active:scale-[0.98]",
                                isClaimed ? "bg-accent/5 border-accent/20" : "bg-muted/20 border-transparent"
                              )}
                              onClick={() => claimReceiptItem(params.id, receipt.id, item.id, m.uid, isClaimed ? 0 : 100)}
                            >
                              <Checkbox 
                                checked={isClaimed} 
                                onCheckedChange={() => {}} 
                                className="h-4 w-4 rounded pointer-events-none" 
                              />
                              <span className="font-bold text-[10px] truncate flex-1">{m.displayName?.split(' ')[0]}</span>
                            </div>
                          );
                        })}

                        {/* Checkboxes para invitados */}
                        {receipt.externalGuests?.map((guest, gIdx) => {
                          const guestId = `guest_${gIdx}`;
                          const claimKey = `${item.id}_${guestId}`;
                          const currentPercentage = receipt.claims?.[claimKey] || 0;
                          const isClaimed = currentPercentage > 0;
                          const responsibleName = members.find(m => m.uid === guest.addedBy)?.displayName?.split(' ')[0] || '...';

                          return (
                            <div 
                              key={guestId} 
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-xl border transition-all active:scale-[0.98] border-dashed",
                                isClaimed ? "bg-accent/5 border-accent/40" : "bg-muted/10 border-transparent"
                              )}
                              onClick={() => claimReceiptItem(params.id, receipt.id, item.id, guestId, isClaimed ? 0 : 100)}
                            >
                              <Checkbox 
                                checked={isClaimed} 
                                onCheckedChange={() => {}} 
                                className="h-4 w-4 rounded pointer-events-none" 
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[10px] truncate">{guest.name}</span>
                                <span className="text-[7px] text-muted-foreground font-medium truncate italic">De {responsibleName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="p-4 bg-accent/5 border-t">
                {user?.uid === receipt.creditorId ? (
                  <Button 
                    className="w-full bg-accent text-[10px] font-black uppercase tracking-widest h-11 rounded-xl shadow-lg" 
                    onClick={() => finalizeReceipt(
                      params.id, 
                      receipt.id, 
                      receipt.items, 
                      receipt.claims, 
                      receipt.creditorId, 
                      undefined, 
                      receipt.includeTip,
                      receipt.externalGuests
                    )}
                  >
                    Finalizar y Cobrar
                  </Button>
                ) : (
                  <div className="w-full text-center py-2 px-4 rounded-xl bg-muted/50 border border-dashed text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Esperando que el acreedor finalice
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}

          <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b px-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Miembros del Grupo ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 px-4">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3 text-xs p-2.5 rounded-xl bg-muted/30 border border-transparent hover:border-primary/5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">{m.displayName?.[0] || 'U'}</div>
                  <div className="flex-1 min-w-0"><p className="font-bold truncate text-primary/80">{m.displayName}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-[2rem] p-6 sm:p-8 border-none overflow-y-auto max-h-[90vh] mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Registrar Gasto</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-2xl">
              <Button variant={expenseMode === 'manual' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('manual')}>Manual</Button>
              <Button variant={expenseMode === 'event' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('event')}>Evento</Button>
              <Button variant={expenseMode === 'item' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('item')}>Boleta IA</Button>
            </div>

            {expenseMode === 'event' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Vincular a Evento</Label>
                <Select onValueChange={handleEventSelect} value={selectedEventId || ""}>
                  <SelectTrigger className="h-12 rounded-xl text-xs">
                    <SelectValue placeholder="Elegir un evento reciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map(ev => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({ev.date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">¿Quién pagó el gasto?</Label>
              <Select value={creditorId} onValueChange={setCreditorId}>
                <SelectTrigger className="h-12 rounded-xl text-xs">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Concepto</Label>
                    <Input placeholder="Ej: Pizza / Cancha / Luces" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className="h-12 rounded-xl text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Monto Total</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-12 pl-9 rounded-xl font-bold text-sm" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border">
                  <div className="space-y-0.5"><Label className="text-xs font-bold">Dividir en partes iguales</Label></div>
                  <Switch checked={divideEqually} onCheckedChange={(val) => { setDivideEqually(val); }} />
                </div>

                {divideEqually ? (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">¿Quiénes entran en la división?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/20 p-4 rounded-2xl max-h-48 overflow-y-auto">
                      {members.map(m => (
                        <div key={m.uid} className={cn("flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer active:scale-[0.98]", selectedMembers.includes(m.uid) ? "bg-white border-primary/20 shadow-sm" : "bg-transparent border-transparent")} onClick={() => setSelectedMembers(prev => prev.includes(m.uid) ? prev.filter(id => id !== m.uid) : [...prev, m.uid])}>
                          <Checkbox checked={selectedMembers.includes(m.uid)} className="h-4 w-4 rounded-md pointer-events-none" />
                          <span className="text-[11px] font-bold truncate">{m.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Montos Manuales</Label>
                    <div className="space-y-2 bg-muted/20 p-3 sm:p-4 rounded-2xl max-h-60 overflow-y-auto border border-dashed">
                      {members.map(m => (
                        <div key={m.uid} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
                          <span className="text-[11px] font-bold truncate pr-2">{m.displayName?.split(' ')[0]}</span>
                          <Input type="number" placeholder="0.00" className="h-9 w-24 sm:w-32 font-bold text-xs" value={manualAmounts[m.uid] || ""} onChange={(e) => setManualAmounts({ ...manualAmounts, [m.uid]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <div className={cn("p-4 rounded-xl text-[10px] font-bold flex justify-between items-center shadow-inner", Math.abs(difference) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                      <span>Asignado: ${manualSum.toFixed(2)}</span>
                      <span>{Math.abs(difference) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : `Falta: $${difference.toFixed(2)}`}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-3 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">Usa una IA para escanear tu boleta y pega aquí el resultado estructurado para que cada miembro pueda marcar sus ítems.</p>
                  <Button type="button" onClick={copyAiPrompt} variant="outline" className="w-full h-11 text-[10px] font-black uppercase rounded-xl gap-2">
                    <Copy className="h-4 w-4" /> Copiar Prompt para IA
                  </Button>
                </div>
                <Textarea placeholder="Pega aquí el resultado (ítem;cantidad;precio;total)" className="min-h-[150px] rounded-xl text-[11px] font-mono p-4" value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
                <Button type="button" className="w-full h-12 rounded-xl text-[11px] font-black uppercase" onClick={handleParseItems}>Procesar Texto de Boleta</Button>
                
                {parsedItems.length > 0 && (
                  <div className="space-y-4 mt-4 border-t pt-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revisar ítems extraídos</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-muted/10 p-2 rounded-xl border">
                      {parsedItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border shadow-sm">
                          <div className="col-span-6">
                            <Input 
                              value={item.name} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].name = e.target.value;
                                setParsedItems(updated);
                              }}
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input 
                              type="number"
                              value={item.quantity || ""} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].quantity = parseInt(e.target.value) || 0;
                                updated[idx].totalPrice = updated[idx].quantity * updated[idx].unitPrice;
                                setParsedItems(updated);
                                setExpenseAmount(updated.reduce((acc, it) => acc + (it.totalPrice || 0), 0).toString());
                              }}
                              className="h-8 text-xs p-1 text-center rounded-lg"
                            />
                          </div>
                          <div className="col-span-4">
                            <Input 
                              type="number"
                              value={item.totalPrice || ""} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].totalPrice = parseFloat(e.target.value) || 0;
                                setParsedItems(updated);
                                setExpenseAmount(updated.reduce((acc, it) => acc + (it.totalPrice || 0), 0).toString());
                              }}
                              className="h-8 text-xs font-bold text-right rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl font-bold text-sm">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Suma Total Boleta:</span>
                      <span className="text-primary">${aggregatedItemsTotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold">¿Incluir propina?</Label>
                      </div>
                      <Switch checked={includeTip} onCheckedChange={setIncludeTip} />
                    </div>

                    {includeTip && (
                      <p className="text-[11px] text-accent font-medium leading-relaxed bg-accent/5 p-3 rounded-xl border border-accent/20 animate-in fade-in duration-200">
                        Total boleta + propina: ${(aggregatedItemsTotal * 1.10).toFixed(2)}. La propina se dividirá en proporción a lo que consuma cada participante.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" className="rounded-xl h-12 w-full sm:w-auto" onClick={() => setAddingExpense(false)}>Cancelar</Button>
            <Button className="rounded-xl px-10 h-12 w-full sm:w-auto font-bold shadow-lg" onClick={handleRegisterExpense} disabled={isActionLoading || (!divideEqually && expenseMode !== 'item' && Math.abs(difference) > 0.01)}>
              {isActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditorProfile} onOpenChange={() => setCreditorProfile(null)}>
        <DialogContent className="w-[90vw] max-w-md rounded-[2rem] p-6 sm:p-8 border-none text-center mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Datos de Transferencia</DialogTitle>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{creditorProfile?.displayName}</p>
          </DialogHeader>
          <div className="bg-muted/30 p-6 rounded-[1.5rem] font-mono text-xs sm:text-sm text-left whitespace-pre-wrap border border-dashed mt-4 leading-relaxed">
            {creditorProfile?.transferDetails || "El acreedor no ha configurado sus instrucciones bancarias."}
          </div>
          <Button className="w-full h-12 rounded-xl mt-6 font-bold" onClick={() => setCreditorProfile(null)}>Entendido</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2rem] p-6 sm:p-8 text-center border-none mx-auto">
          <DialogHeader className="pb-4"><DialogTitle className="text-xl font-headline">Compartir Invitación</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed text-xs font-mono break-all leading-relaxed">
              {group.inviteLink}
            </div>
            <Button 
              className="w-full h-12 rounded-xl font-bold gap-2" 
              onClick={() => { navigator.clipboard.writeText(group.inviteLink); toast({ title: "Enlace Copiado", description: "Envíalo por WhatsApp a tus amigos." }); }}
            >
              <Copy className="h-4 w-4" /> Copiar Enlace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
