import { LoginForm } from "@/components/auth/login-form";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <GraduationCap className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">Okul Asistanı</h1>
        <p className="text-sm text-muted-foreground">Okul kitap okuma, yoklama ve temizlik takip sistemi</p>
      </div>
      <LoginForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Hesabınız yok mu?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Kayıt olun
        </Link>
      </p>
    </div>
  );
}
