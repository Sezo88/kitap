import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 flex items-center justify-center font-black text-white text-2xl tracking-tighter shadow-lg shadow-primary/20 mb-2">
          OYP
        </div>
        <h1 className="text-2xl font-bold tracking-tight">O.Y.P.</h1>
        <p className="text-sm text-muted-foreground">Okul Yönetim Paneli & Eğitim Sistemi</p>
      </div>
      <RegisterForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Zaten hesabınız var mı?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Giriş yapın
        </Link>
      </p>
    </div>
  );
}
