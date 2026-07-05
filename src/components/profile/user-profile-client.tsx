"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { User, Mail, Shield, Building, Loader2, Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  school_id: string | null;
  schools?: {
    name: string;
  } | null;
}

interface Props {
  userProfile: UserProfile;
  email: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Admin",
  idareci: "Okul İdarecisi",
  ogretmen: "Öğretmen",
};

export function UserProfileClient({ userProfile, email }: Props) {
  const [fullName, setFullName] = useState(userProfile.full_name || "");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast("Ad soyad boş olamaz", "error");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", userProfile.id);

    setLoading(false);
    if (error) {
      toast("Güncelleme hatası: " + error.message, "error");
    } else {
      toast("Profil isminiz başarıyla güncellendi.", "success");
      setIsEditing(false);
      router.refresh();
    }
  }

  const schoolName = (userProfile as any).schools?.name || "Tüm Okullar (Süper Admin)";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profil Bilgilerim
          </CardTitle>
          <CardDescription>Kişisel bilgilerinizi inceleyebilir ve adınızı güncelleyebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            {/* Ad Soyad */}
            <div className="space-y-2">
              <Label htmlFor="fullname">Ad Soyad</Label>
              <div className="flex gap-2">
                <Input
                  id="fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing || loading}
                  className="flex-1"
                  required
                />
                {!isEditing ? (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5 shrink-0">
                    <Edit3 className="h-4 w-4" /> Düzenle
                  </Button>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <Button type="submit" disabled={loading} className="gap-1.5">
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setFullName(userProfile.full_name || ""); setIsEditing(false); }} disabled={loading}>
                      İptal
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* E-posta */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-slate-400 text-xs flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> E-posta Adresi</Label>
              <div className="text-sm font-semibold">{email}</div>
            </div>

            {/* Rol */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-slate-400 text-xs flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Sistem Rolü</Label>
              <div>
                <Badge variant="secondary" className="font-bold">
                  {ROLE_LABELS[userProfile.role] || userProfile.role}
                </Badge>
              </div>
            </div>

            {/* Okul */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-slate-400 text-xs flex items-center gap-1"><Building className="h-3.5 w-3.5" /> Bağlı Olduğu Okul</Label>
              <div className="text-sm font-semibold">{schoolName}</div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
