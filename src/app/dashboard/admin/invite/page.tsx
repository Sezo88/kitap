"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Send, Copy, Check } from "lucide-react";
import type { Role } from "@/lib/types/database";

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ogretmen");
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleSendInvite() {
    if (!email.trim()) return;
    setSending(true);

    const supabase = createClient();

    // Create invite via Supabase Auth admin API (via our own API route)
    const res = await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast("Davet gönderilemedi: " + (err.error || "Bilinmeyen hata"), "error");
    } else {
      const data = await res.json();
      // Generate invite link for manual sharing
      const link = `${window.location.origin}/register?invite=${data.inviteCode || ""}`;
      setInviteLink(link);
      toast("Davet başarıyla gönderildi!", "success");
      setEmail("");
    }

    setSending(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast("Link kopyalandı", "info");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Davet Gönder</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>E-posta ile Davet</CardTitle>
            <CardDescription>
              Öğretmen veya idareciyi e-posta ile sisteme davet edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">E-posta Adresi</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@okul.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Rol</Label>
              <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="ogretmen">Öğretmen</option>
                <option value="idareci">İdareci</option>
              </Select>
            </div>
            <Button onClick={handleSendInvite} disabled={sending || !email.trim()}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Gönderiliyor..." : "Davet Gönder"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Davet Linki</CardTitle>
            <CardDescription>
              Manuel paylaşım için davet linki oluşturun. Linki kopyalayıp WhatsApp veya e-posta ile iletebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline" onClick={async () => {
              const base = window.location.origin;
              const link = `${base}/register`;
              setInviteLink(link);
              await navigator.clipboard.writeText(link);
              setCopied(true);
              toast("Kayıt linki kopyalandı", "info");
              setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Kayıt Linkini Kopyala
            </Button>
            {inviteLink && (
              <div className="p-3 bg-muted rounded-lg text-sm break-all">
                {inviteLink}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
