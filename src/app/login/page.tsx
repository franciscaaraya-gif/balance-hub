"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      router.push("/dashboard");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Login failed", 
        description: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-2xl text-primary-foreground">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline tracking-tight">Login</CardTitle>
          <CardDescription className="text-muted-foreground font-body">Manage your group debts securely</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="john@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="bg-muted/30 border-none focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="bg-muted/30 border-none focus-visible:ring-primary"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 py-6 text-lg" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center flex-col space-y-2">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-accent font-semibold hover:underline">
              Register here
            </Link>
          </p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">Back to Home</Link>
        </CardFooter>
      </Card>
    </div>
  );
}