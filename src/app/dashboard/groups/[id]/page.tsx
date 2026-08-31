
"use client";

import { useEffect, useState, use, useMemo, useRef } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { getGroupMembersDetails, addDebt, addFixedDebtToAll, createReceipt, claimReceiptItem, finalizeReceipt, updateDebtStatusInGroup } from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, QrCode, UserPlus, ScanLine, Camera, Loader2, DollarSign, Users, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseReceipt } from "@/ai/flows/parse-receipt-flow";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
  }, [group?.memberIds]);

  const isAdmin = group?.adminId === user?.uid;

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

  if (groupLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center">Grupo no encontrado.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {group.type === 'fixed' ? <Badge variant="default">Partes Iguales</Badge> : <Badge variant="secondary">Variable</Badge>}
            • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              {group.type === 'fixed' ? (
                <Button onClick={() => setAddingFixedDebt(true)} className="bg-primary gap-2">
                  <Plus className="h-4 w-4" /> Agregar Cobro
                </Button>
              ) : (
                <>
                  <Button onClick={() => setAddingVariableDebt(true)} variant="outline" className="gap-2 border-primary text-primary">
                    <Users className="h-4 w-4" /> Por Usuario
                  </Button>
                  <Button onClick={() => { setScanningReceipt(true); startCamera(); }} className="bg-accent gap-2">
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Historial de Cobros</CardTitle>
            <CardDescription>Resumen de todas las deudas del grupo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts?.map(debt => (
                    <TableRow key={debt.id} className={cn(debt.debtorId === user?.uid && "bg-primary/5")}>
                      <TableCell className="font-medium text-xs">
                        {members.find(m => m.uid === debt.debtorId)?.displayName || 'Cargando...'}
                        {debt.debtorId === user?.uid && <Badge className="ml-2 text-[8px] bg-accent">Yo</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{debt.description}</TableCell>
                      <TableCell className="font-bold text-primary">${debt.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {debt.status === 'paid' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600">Pagado</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-orange-50 text-orange-600">Pendiente</Badge>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={() => updateDebtStatusInGroup(params.id, debt.id, 'paid')}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {debts?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay cobros registrados aún.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Panel Derecho: Boletas Activas y Miembros */}
        <div className="space-y-6">
          {receipts?.filter(r => r.status === 'open').map(receipt => (
            <Card key={receipt.id} className="border-accent/20">
              <CardHeader className="bg-accent/5 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-accent">Boleta en Curso</CardTitle>
                <CardDescription>Marca tus consumos.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-80 overflow-y-auto">
                <div className="divide-y">
                  {receipt.items.map(item => {
                    const myClaim = item.claims.find(c => c.userId === user?.uid);
                    return (
                      <div key={item.id} className="p-3 flex flex-col gap-2 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">${item.price.toFixed(2)}</p>
                          </div>
                          <Checkbox checked={!!myClaim} onCheckedChange={(val) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, val ? 100 : 0, receipt.items)} />
                        </div>
                        {myClaim && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground">Tu %:</span>
                            <Input 
                              type="number" 
                              className="h-6 w-20 text-[10px]" 
                              value={myClaim.percentage} 
                              onChange={(e) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, parseFloat(e.target.value) || 0, receipt.items)} 
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {item.claims.filter(c => c.userId !== user?.uid).map(c => (
                            <Badge key={c.userId} variant="secondary" className="text-[8px] px-1">{members.find(m => m.uid === c.userId)?.displayName?.split(' ')[0]}: {c.percentage}%</Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="p-3 bg-accent/5">
                {isAdmin && (
                  <Button 
                    className="w-full bg-accent text-xs h-8" 
                    onClick={() => handleFinalizeReceipt(receipt)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : "Finalizar y Cobrar"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
          
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4" /> Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.uid} className="flex items-center gap-2 text-xs">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-bold">{m.displayName?.[0]}</div>
                    <span className="truncate">{m.displayName}</span>
                    {m.uid === group.adminId && <Badge className="text-[8px] h-3 px-1">Admin</Badge>}
                    {m.uid === user?.uid && <Badge variant="outline" className="text-[8px] h-3 px-1 ml-auto">Tú</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: Invitar / QR */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar al Grupo</DialogTitle>
            <DialogDescription>Comparte el enlace o escanea el QR.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="bg-white p-4 rounded-xl border-2 border-primary shadow-inner">
              <QrCode className="h-32 w-32 text-primary" />
            </div>
            <div className="w-full space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Enlace de Invitación</Label>
              <div className="flex gap-2">
                <Input readOnly value={group.inviteLink} className="text-xs" />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(group.inviteLink); toast({ title: "Copiado!" }); }}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: Agregar Cobro Fijo */}
      <Dialog open={addingFixedDebt} onOpenChange={setAddingFixedDebt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobro en Partes Iguales</DialogTitle>
            <DialogDescription>Se generará una deuda por este monto a cada integrante (incluyéndote).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Cobro</Label>
              <Input placeholder="Ej: Cuota del Agua" value={fixedDescription} onChange={(e) => setFixedDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto por Persona ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" className="pl-9" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg text-xs flex justify-between">
              <span>Total de miembros a cobrar:</span>
              <span className="font-bold">{members.length}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingFixedDebt(false)}>Cancelar</Button>
            <Button onClick={handleAddFixedDebt} disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Generar Deudas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Agregar Cobro Variable por Usuario */}
      <Dialog open={addingVariableDebt} onOpenChange={setAddingVariableDebt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cobro por Usuario</DialogTitle>
            <DialogDescription>Ingresa el monto específico para cada integrante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Concepto del Cobro</Label>
              <Input placeholder="Ej: Gastos Varios" value={variableDescription} onChange={(e) => setVariableDescription(e.target.value)} />
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3">
                  <div className="flex-1 text-sm font-medium">
                    {m.displayName}
                    {m.uid === user?.uid && <span className="ml-2 text-[10px] text-muted-foreground">(Tú)</span>}
                  </div>
                  <div className="relative w-32">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      type="number" 
                      className="h-8 pl-7 text-xs" 
                      placeholder="0.00"
                      value={variableDebts[m.uid] || ""}
                      onChange={(e) => setVariableDebts({ ...variableDebts, [m.uid]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingVariableDebt(false)}>Cancelar</Button>
            <Button onClick={handleAddVariableDebt} disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Generar Cobros"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Escáner de Boleta */}
      <Dialog open={scanningReceipt} onOpenChange={(val) => { setScanningReceipt(val); if (!val) stopCamera(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escáner de Boleta (IA)</DialogTitle>
            <DialogDescription>Identifica ítems para repartir gastos.</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden border">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" width={640} height={853} />
            {parsingReceipt && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="font-headline font-bold">Analizando boleta...</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setScanningReceipt(false)}>Cancelar</Button>
            <Button className="flex-1 bg-primary" onClick={captureAndParse} disabled={parsingReceipt}>
              <Camera className="h-4 w-4 mr-2" /> Capturar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}
function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />;
}
function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}
function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}
