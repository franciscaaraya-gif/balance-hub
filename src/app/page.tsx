import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Wallet, ShieldCheck, Zap, Users, CreditCard } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <Link className="flex items-center justify-center space-x-2" href="/">
          <div className="bg-primary p-1.5 rounded-lg text-primary-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <span className="text-xl font-headline tracking-tight text-primary">BalanceHub</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/login" className="text-sm font-medium hover:text-accent transition-colors">
            Login
          </Link>
          <Button asChild size="sm" variant="default" className="bg-accent hover:bg-accent/90">
            <Link href="/register">Get Started</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2 max-w-3xl">
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none text-primary">
                  Settle Scores, <span className="text-accent">Keep Friends</span>.
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl font-body">
                  The professional debt tracker for modern groups. Track, manage, and settle debts with AI-powered summaries and transparent reporting.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Button size="lg" asChild className="px-8 py-6 text-lg bg-primary hover:bg-primary/90">
                  <Link href="/register">Start a Group</Link>
                </Button>
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-primary text-primary hover:bg-primary/5">
                  <Link href="/login">Explore Features</Link>
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
                <h3 className="text-xl font-headline font-semibold">Group Centric</h3>
                <p className="text-muted-foreground font-body">Create fixed or variable groups. Invite members with a single link and start tracking instantly.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-accent/10 text-accent">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-headline font-semibold">AI Summaries</h3>
                <p className="text-muted-foreground font-body">One click to get a full financial health report of your group. Know exactly who owes what.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-headline font-semibold">Secure Tracking</h3>
                <p className="text-muted-foreground font-body">Role-based access ensures only admins can mark debts as paid. Transparency for everyone.</p>
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
                  <h2 className="text-2xl font-headline font-bold text-primary">¿Es gratis usar BalanceHub?</h2>
                  <p className="text-muted-foreground font-body">
                    BalanceHub ofrece un **nivel gratuito generoso** perfecto para amigos, familias y pequeños grupos. 
                    Utilizamos la infraestructura de Firebase Spark, lo que significa que puedes gestionar cientos de deudas sin pagar ni un centavo.
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    * Solo el procesamiento avanzado de IA y el hosting a gran escala pueden requerir planes premium en el futuro.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-white">
        <p className="text-xs text-center text-muted-foreground">
          © 2024 BalanceHub. Professional debt management for everyone.
        </p>
      </footer>
    </div>
  );
}
