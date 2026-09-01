
"use client";

import { useUser } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Wallet, LayoutDashboard, LogOut, Settings, Loader2, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

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
    { name: 'Ajustes', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-primary-foreground border-r">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 mb-8">
            <div className="bg-accent p-1.5 rounded-lg">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-headline font-bold">BalanceHub</span>
          </Link>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  pathname === item.href ? 'bg-white/10 text-white font-semibold' : 'text-primary-foreground/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6 px-4">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
              {user.displayName?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-primary-foreground/50 truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-primary-foreground/70 hover:text-white hover:bg-white/5" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 bg-primary text-primary-foreground border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            <span className="text-lg font-headline font-bold">BalanceHub</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
