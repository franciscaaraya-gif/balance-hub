"use client";

import { useUser } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, Loader2, CalendarCheck, UserCircle, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const navItems = [
    { name: 'Mis Grupos', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Asistencia', href: '/dashboard/attendance', icon: CalendarCheck },
    { name: 'Mi Perfil', href: '/dashboard/settings', icon: UserCircle },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-4 mb-10 group" onClick={() => setIsSheetOpen(false)}>
          <Logo className="h-14 w-14 shrink-0 transition-transform group-hover:scale-105 filter drop-shadow-[0_4px_6px_rgba(255,255,255,0.15)]" variant="dark" />
          <span className="text-3xl font-headline font-bold text-white tracking-tight">Zygos</span>
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link 
              key={item.name} 
              href={item.href}
              onClick={() => setIsSheetOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                pathname === item.href ? 'bg-white/10 text-white font-semibold' : 'text-primary-foreground/70 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-white/10">
        <div className="flex items-center gap-3 mb-6 px-4">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold shrink-0 text-white">
            {user.displayName?.[0] || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate text-white">{user.displayName}</p>
            <p className="text-xs text-primary-foreground/50 truncate">{user.email}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-primary-foreground/70 hover:text-white hover:bg-white/5 rounded-xl h-12" 
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-72 bg-primary text-primary-foreground border-r shrink-0">
        <NavContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 bg-primary text-primary-foreground sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-3">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-xl">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-primary text-primary-foreground border-r-0 w-[280px]">
                <NavContent />
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo className="h-10 w-10 filter drop-shadow-[0_2px_4px_rgba(255,255,255,0.1)]" variant="dark" />
              <span className="text-xl font-headline font-bold tracking-tight text-white">Zygos</span>
            </Link>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/70 hover:text-white rounded-xl">
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
