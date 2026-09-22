"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl bg-white rounded-[2rem] border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/5 pt-8 pb-6 px-6 sm:px-10 border-b flex flex-row items-center gap-4">
          <div className="bg-secondary/10 p-3 rounded-2xl text-secondary">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold text-primary">Política de Privacidad</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Zygos — Seguridad y Confianza</p>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-10 space-y-6 text-sm text-foreground/80 leading-relaxed max-h-[60vh] overflow-y-auto">
          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">1. Datos que Recolectamos</h3>
            <p>Para el funcionamiento correcto de Zygos, guardamos información básica proporcionada de manera voluntaria al autenticarse con Google:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nombre completo y dirección de correo electrónico.</li>
              <li>Identificador único de autenticación.</li>
              <li>Datos e instrucciones de transferencia bancaria (CBU, alias, cuenta) provistos voluntariamente en la sección de perfil personal.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">2. Uso y Privacidad de los Datos</h3>
            <p>Los datos recopilados se utilizan únicamente para calcular balances dentro de los grupos compartidos. **Restricción de Visibilidad:** Los detalles bancarios e instrucciones de cobro cargados en tu perfil solo serán visibles para aquellos miembros que mantengan una deuda activa contigo, garantizando que tu información financiera no esté expuesta de forma masiva ni a externos.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-primary text-base">3. Seguridad</h3>
            <p>Almacenamos la información en bases de datos protegidas por reglas de seguridad robustas de Firebase Firestore, asegurando que ningún usuario no autorizado pueda listar ni leer transacciones ajenas a sus propios grupos.</p>
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
