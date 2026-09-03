
"use client";

import { useEffect, useState, use, useMemo, useRef } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { getGroupMembersDetails, addDebt, addFixedDebtToAll, createReceipt, claimReceiptItem, finalizeReceipt, updateDebtStatusInGroup, updateGroupTransferDetails } from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, QrCode, UserPlus, ScanLine, Camera, Loader2, DollarSign, Users, Trash2, CreditCard, Copy, Pencil, Save, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseReceipt } from "@/ai/flows/parse-receipt-flow";
import { generateDebtSummary } from "@/ai/flows/ai-debt-summary-generation";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingFixedDebt, setAddingFixedDebt] = useState(false);
  const [addingVariableDebt, setAddingVariableDebt] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(false);
  const [transferInput, setTransferInput] = useState("");
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");
  const [variableDebts, setVariableDebts] = useState<Record<string, string>>({});
  const [variableDescription, setVariableDescription] = useState("");

  const [members, setMembers] = useState<UserProfile[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'groups', params.id);
  }, [firestore, params.id]);
  const { data: group, isLoading: groupLoading } = useDoc<Group>(groupRef);

  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return query(collection(firestore, 'groups', params.id, 'debts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const receiptsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return query(collection(firestore, 'groups', params.id, 'receipts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id]);
  const { data: receipts } = useCollection<Receipt>(receiptsQuery);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
    if (group?.transferDetails) {
      setTransferInput(group.transferDetails);
    }
  }, [group?.memberIds, group?.transferDetails]);

  const isAdmin = group?.adminId === user?.uid;

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

  const handleUpdateTransfer = async () => {
    setIsActionLoading(true);
    try {
      await updateGroupTransferDetails(params.id, transferInput);
      toast({ title: "Datos actualizados", description: "La información de transferencia ha sido guardada." });
      setEditingTransfer(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los datos." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const copyTransferDetails = () => {
    if (!group?.transferDetails) return;
    navigator.clipboard.writeText(group.transferDetails);
    toast({ title: "Copiado", description: "Datos de transferencia copiados al portapapeles." });
  };

  const handleAddFixedDebt = async () => {
    if (!fixedAmount || !fixedDescription || !user) return;
    setIsActionLoading(true);
    try {
      await addFixedDebtToAll(params.id, parseFloat(fixedAmount), fixedDescription, group!.memberIds, user.uid);
      toast({ title: "Deudas Creadas", description: "Se asignó el cobro a todos los miembros." });
      setAddingFixedDebt(false);
      setFixedAmount("");
      setFixedDescription("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddVariableDebt = async () => {
    setIsActionLoading(true);
    try {
      for (const uid in variableDebts) {
        const amount = parseFloat(variableDebts[uid]);
        if (amount > 0) {
          await addDebt(params.id, uid, amount, variableDescription);
        }
      }
      toast({ title: "Deudas Creadas", description: "Se asignaron los cobros individuales." });
      setAddingVariableDebt(false);
      setVariableDebts({});
      setVariableDescription("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      toast({ variant: "destructive", title: "Cámara no disponible" });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const captureAndParse = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setParsingReceipt(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg');
    try {
      const result = await parseReceipt({ photoDataUri: dataUrl });
      if (result.items.length > 0) {
        await createReceipt(params.id, result.items);
        toast({ title: "Boleta Escaneada", description: "Productos cargados." });
        setScanningReceipt(false);
        stopCamera();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error de IA" });
    } finally {
      setParsingReceipt(false);
    }
  };

  const handleFinalizeReceipt = async (receipt: Receipt) => {
    if (!user) return;
    setIsActionLoading(true);
    try {
      await finalizeReceipt(params.id, receipt.id, receipt.items, user.uid);
      toast({ title: "Boleta Finalizada", description: "Se han generado las deudas para todos." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al finalizar" });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (groupLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 opacity-50 mb-4" /><p>Grupo no encontrado.</p></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {group.type === 'fixed' ? <Badge variant="default">Partes Iguales</Badge> : <Badge variant="secondary">Variable</Badge>}
            • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleGenerateAiSummary} disabled={isGeneratingSummary}>
            {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-accent" />}
            Resumen IA
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              {group.type === 'fixed' ? (
                <Button size="sm" onClick={() => setAddingFixedDebt(true)} className="bg-primary gap-2 rounded-xl">
                  <Plus className="h-4 w-4" /> Agregar Cobro
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => setAddingVariableDebt(true)} variant="outline" className="gap-2 border-primary text-primary rounded-xl">
                    <Users className="h-4 w-4" /> Por Usuario
                  </Button>
                  <Button size="sm" onClick={() => { setScanningReceipt(true); startCamera(); }} className="bg-accent gap-2 rounded-xl">
                    <ScanLine className="h-4 w-4" /> Por Ítem
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel Izquierdo: Historial */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-lg font-headline">Historial de Cobros</CardTitle>
            <CardDescription className="text-xs">Resumen de todas las deudas del grupo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="p-4 text-left font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Miembro</th>
                    <th className="p-4 text-left font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Concepto</th>
                    <th className="p-4 text-left font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Monto</th>
                    <th className="p-4 text-left font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {debts?.map(debt => (
                    <tr key={debt.id} className={cn(debt.debtorId === user?.uid && "bg-primary/5")}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{members.find(m => m.uid === debt.debtorId)?.displayName || '...'}</span>
                          {debt.debtorId === user?.uid && <Badge className="text-[8px] bg-accent h-4">Yo</Badge>}
                        </div>
                      </td>
                      <td className="p-4 text-xs opacity-70">{debt.description}</td>
                      <td className="p-4 font-bold text-primary">${debt.amount.toFixed(2)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {debt.status === 'paid' ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold">Pagado</Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 text-[10px] font-bold">Pendiente</Badge>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => updateDebtStatusInGroup(params.id, debt.id, 'paid')}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {debts?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-20 text-muted-foreground italic text-xs">No hay cobros registrados aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Panel Derecho */}
        <div className="space-y-6">
          {receipts?.filter(r => r.status === 'open').map(receipt => (
            <Card key={receipt.id} className="border-accent/30 shadow-md rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-accent/5 pb-3 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ScanLine className="h-4 w-4" /> Boleta Activa
                </CardTitle>
                <CardDescription className="text-[10px]">Marca tus consumos para dividir la cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-80 overflow-y-auto">
                <div className="divide-y">
                  {receipt.items.map(item => {
                    const myClaim = item.claims.find(c => c.userId === user?.uid);
                    return (
                      <div key={item.id} className="p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">${item.price.toFixed(2)}</p>
                          </div>
                          <Checkbox checked={!!myClaim} onCheckedChange={(val) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, val ? 100 : 0, receipt.items)} className="h-5 w-5 rounded-lg" />
                        </div>
                        {myClaim && (
                          <div className="flex items-center gap-2 bg-accent/5 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-accent">Tu Cuota %:</span>
                            <Input 
                              type="number" 
                              className="h-7 w-20 text-[10px] font-bold border-accent/20" 
                              value={myClaim.percentage} 
                              onChange={(e) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, parseFloat(e.target.value) || 0, receipt.items)} 
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.claims.filter(c => c.userId !== user?.uid).map(c => (
                            <Badge key={c.userId} variant="secondary" className="text-[8px] px-1.5 py-0.5 rounded-md opacity-70">
                              {members.find(m => m.uid === c.userId)?.displayName?.split(' ')[0]}: {c.percentage}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="p-4 bg-accent/5 border-t">
                {isAdmin && (
                  <Button 
                    className="w-full bg-accent text-xs font-black uppercase tracking-widest h-11 rounded-xl shadow-lg shadow-accent/20" 
                    onClick={() => handleFinalizeReceipt(receipt)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Finalizar y Generar Cobros"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}

          {/* DATOS DE TRANSFERENCIA */}
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-secondary" /> Datos de Pago
              </CardTitle>
              {isAdmin && !editingTransfer && (
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setEditingTransfer(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {editingTransfer ? (
                <div className="space-y-3">
                  <Textarea 
                    placeholder="Ej: CBU 000000000000, Alias: mi.casa.verde, RUT: 12.345.678-9" 
                    className="text-xs min-h-[100px] rounded-xl bg-muted/20 border-none"
                    value={transferInput}
                    onChange={(e) => setTransferInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl text-[10px] font-bold" onClick={() => setEditingTransfer(false)}>Cancelar</Button>
                    <Button size="sm" className="flex-1 h-9 rounded-xl text-[10px] font-bold" onClick={handleUpdateTransfer} disabled={isActionLoading}>
                      <Save className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {group.transferDetails ? (
                    <>
                      <div className="bg-muted/30 p-4 rounded-2xl text-[10px] whitespace-pre-wrap font-mono leading-relaxed text-primary/80 border border-primary/5">
                        {group.transferDetails}
                      </div>
                      <Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border-2" onClick={copyTransferDetails}>
                        <Copy className="h-3 w-3" /> Copiar CBU/Alias
                      </Button>
                    </>
                  ) : (
                    <div className="text-[10px] text-muted-foreground text-center py-6 italic opacity-50 bg-muted/20 rounded-2xl">
                      {isAdmin ? "Agrega tus datos para que te paguen." : "El admin aún no sube sus datos."}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-primary/5">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3 text-xs p-2 rounded-xl bg-white/50 border border-white">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{m.displayName?.[0]}</div>
                  <span className="font-bold truncate text-primary/80">{m.displayName}</span>
                  <div className="ml-auto flex gap-1">
                    {m.uid === group.adminId && <Badge className="text-[7px] h-4 px-1.5 uppercase bg-primary text-white border-none">Admin</Badge>}
                    {m.uid === user?.uid && <Badge variant="outline" className="text-[7px] h-4 px-1.5 uppercase border-primary text-primary">Tú</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: Resumen IA */}
      <Dialog open={!!aiSummary} onOpenChange={(val) => !val && setAiSummary(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none">
          <DialogHeader className="text-center pb-4">
            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold">Resumen Financiero IA</DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Análisis inteligente de saldos</DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <div className="bg-muted/30 p-6 rounded-[2rem] text-sm leading-relaxed whitespace-pre-wrap font-body text-primary/90">
               {aiSummary}
             </div>
          </div>
          <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" onClick={() => setAiSummary(null)}>Entendido</Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Invitar / QR */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 border-none text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Invitar al Grupo</DialogTitle>
            <DialogDescription className="text-xs">Comparte el enlace o escanea el QR.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="bg-white p-4 rounded-[2rem] border-2 border-primary/10 shadow-xl">
              <QrCode className="h-40 w-40 text-primary" />
            </div>
            <div className="w-full space-y-3">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Enlace de Invitación</Label>
              <div className="flex gap-2">
                <Input readOnly value={group.inviteLink} className="text-xs h-11 rounded-xl bg-muted/50 border-none" />
                <Button size="icon" variant="outline" className="h-11 w-11 rounded-xl border-2" onClick={() => { navigator.clipboard.writeText(group.inviteLink); toast({ title: "¡Copiado!" }); }}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full h-12 rounded-2xl" onClick={() => setShowInviteModal(false)}>Cerrar</Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Agregar Cobro Fijo */}
      <Dialog open={addingFixedDebt} onOpenChange={setAddingFixedDebt}>
        <DialogContent className="rounded-[2.5rem] p-8 border-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Cobro en Partes Iguales</DialogTitle>
            <DialogDescription className="text-xs">Se generará una deuda por este monto a cada integrante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Concepto</Label>
              <Input placeholder="Ej: Cuota del Agua" value={fixedDescription} onChange={(e) => setFixedDescription(e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Monto por Persona ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input type="number" className="h-14 pl-10 rounded-xl text-xl font-bold" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
              </div>
            </div>
            <div className="bg-primary/5 p-4 rounded-2xl text-[11px] flex justify-between items-center font-bold">
              <span className="text-primary/60">Total de miembros a cobrar:</span>
              <span className="text-primary bg-white px-3 py-1 rounded-lg shadow-sm">{members.length}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddingFixedDebt(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddFixedDebt} disabled={isActionLoading} className="rounded-xl h-12 px-8">
              {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar Deudas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Otros modales (Variable y Escáner) siguen el mismo estilo... */}
      {/* ... */}
    </div>
  );
}
