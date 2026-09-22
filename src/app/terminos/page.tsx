"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl bg-white rounded-[2rem] border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-primary/5 pt-8 pb-6 px-6 sm:px-10 border-b flex flex-row items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold text-primary">Términos de Uso</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Zygos — Gestión Inteligente de Deudas</p>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-10 space-y-6 text-sm text-foreground/80 leading-relaxed max-h-[60vh] overflow-y-auto">
          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">1. Propósito de la Plataforma</h3>
            <p>Zygos es una herramienta diseñada para facilitar el registro voluntario y colaborativo de deudas grupales, arriendos deportivos, cuentas compartidas y eventos. Los usuarios utilizan la plataforma bajo su propia responsabilidad para el cálculo matemático y rendición interna.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">2. Registro e Invitaciones</h3>
            <p>El acceso a la plataforma está restringido. Las cuentas nuevas únicamente se pueden crear mediante enlaces legítimos de invitación a un grupo o evento generados por usuarios activos existentes.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">3. Responsabilidad Financiera</h3>
            <p>Zygos no funciona como billetera virtual, pasarela de pagos ni entidad financiera. No custodiamos dinero ni procesamos transferencias directamente. Las liquidaciones y transferencias bancarias se coordinan y efectúan fuera de la aplicación por los medios privados elegidos por los participantes.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">4. Veracidad de la Información</h3>
            <p>Cada usuario es responsable de la exactitud de los montos cargados, consumos marcados en las boletas inteligentes y el reporte/validación de los comprobantes de transferencias.</p>
          </section>

          <div className="bg-orange-50 text-orange-800 p-4 rounded-xl border border-orange-200 text-xs font-medium mt-6">
            Nota: Este texto es una plantilla genérica y debe ser revisado por alguien con conocimiento legal antes de considerarse definitivo.
          </div>
        </CardContent>
        <div className="p-6 bg-muted/20 border-t flex justify-end">
          <Button asChild className="rounded-xl px-6">
            <Link href="/login"><ArrowLeft className="h-4 w-4 mr-2" /> Volver al Acceso</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
