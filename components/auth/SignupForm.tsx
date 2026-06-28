"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { signUpAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToBRL } from "@/lib/format/money";

interface SignupFormProps {
  /** Preço do plano mensal em centavos; 0 = não definido (não exibe valor). */
  monthlyPriceCents?: number;
}

export function SignupForm({ monthlyPriceCents = 0 }: SignupFormProps) {
  const router = useRouter();
  const [tenantName, setTenantName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const result = await signUpAction({ email, password, tenantName });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // signUpAction já cria a sessão — segue direto pro app.
    toast.success("Loja criada com sucesso!");
    router.push("/products");
    router.refresh();
  }

  return (
    <Card className="border-0 bg-[#0c2a4d] text-white ring-1 ring-sky-400/30">
      <CardHeader>
        <CardTitle>Criar loja</CardTitle>
        <CardDescription>
          Crie sua conta e sua loja para começar a cadastrar produtos.
        </CardDescription>
        <p className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 ring-1 ring-sky-500/20">
          {monthlyPriceCents > 0 ? (
            <>
              7 dias grátis para testar. Depois,{" "}
              <span className="font-semibold">{centsToBRL(monthlyPriceCents)}/mês</span>.
            </>
          ) : (
            <>7 dias grátis para testar, sem precisar de cartão.</>
          )}
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tenantName">Nome da loja</Label>
            <Input
              id="tenantName"
              className="text-base"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3 border-t-0 bg-transparent">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar loja"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
