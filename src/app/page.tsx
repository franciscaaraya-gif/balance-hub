import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Users, CreditCard } from "lucide-react";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center space-x-3" href="/">
          <Logo className="h-9 w-9" />
          <span className="text-xl font-headline tracking-tight text-primary font-bold">Zygos</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/login" className="text-sm font-medium hover:text-accent transition-colors text-primary font-semibold">
            Ingresar
          </Link>
          <Button asChild size="sm" variant="default" className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl">
            <Link href="/register">Comenzar</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2 max-w-3xl">
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none text-primary">
                  Cuentas claras, <span className="text-accent">amistades largas</span>.
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl font-body mt-4">
                  El gestor de gastos profesionales para grupos modernos. Organiza, divide y liquida cuentas de forma transparente con total control.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Button size="lg" asChild className="px-8 py-6 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold shadow-lg">
                  <Link href="/register">Crear un Grupo</Link>
                </Button>
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-primary text-primary hover:bg-primary/5 rounded-2xl font-bold">
                  <Link href="/login">Explorar Funciones</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 bg-muted/30">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-secondary/10 text-secondary">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-headline font-semibold text-primary">Enfoque Grupal</h3>
                <p className="text-muted-foreground font-body">Crea grupos de pagos fijos o variables. Invita a los miembros con un solo enlace y empieza a registrar gastos al instante.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-accent/10 text-accent">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-headline font-semibold text-primary">División Flexible</h3>
                <p className="text-muted-foreground font-body">Divide consumos individuales en boletas compartidas o maneja arriendos calculando asistentes en tiempo real.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-headline font-semibold text-primary">Seguimiento Seguro</h3>
                <p className="text-muted-foreground font-body">Validación obligatoria de transferencias. Control absoluto para el acreedor evitando confusiones de dinero.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="max-w-4xl mx-auto bg-primary/5 border border-primary/10 rounded-3xl p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="p-6 bg-primary/10 rounded-2xl text-primary">
                  <CreditCard className="h-12 w-12" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-2xl font-headline font-bold text-primary">¿Es gratis usar Zygos?</h2>
                  <p className="text-muted-foreground font-body">
                    Zygos offers un **nivel gratuito generoso** perfecto para amigos, familias y pequeños grupos deportivos o de salidas. Gestiona cientos de deudas de forma transparente sin pagar ni un centavo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-white">
        <p className="text-xs text-center text-muted-foreground font-medium">
          © 2024 Zygos. Gestión contable transparente para tus grupos de amigos.
        </p>
      </footer>
    </div>
  );
}
