"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ShieldAlert, Search } from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
  feature_attendance: boolean;
  feature_library: boolean;
  feature_cleanliness: boolean;
  feature_lesson_schedule: boolean;
  feature_bell: boolean;
}

interface Props {
  initialSchools: School[];
}

export function SchoolsClient({ initialSchools }: Props) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleFeature(schoolId: string, feature: keyof School, currentValue: boolean) {
    const nextValue = !currentValue;

    // Optimistic UI: Ekranda değeri hemen değiştir
    setSchools((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, [feature]: nextValue } : s))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("schools")
      .update({ [feature]: nextValue })
      .eq("id", schoolId);

    if (error) {
      // Hata durumunda eski değere geri al
      setSchools((prev) =>
        prev.map((s) => (s.id === schoolId ? { ...s, [feature]: currentValue } : s))
      );
      toast("Güncelleme hatası: " + error.message, "error");
    } else {
      toast("Okul lisans özellikleri güncellendi.", "success");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Okul Listesi ve Lisans Kontrol Paneli
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Okul adı veya kodu ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul Adı</TableHead>
                  <TableHead>Okul Kodu</TableHead>
                  <TableHead className="text-center">Yoklama Yetkisi</TableHead>
                  <TableHead className="text-center">Kitap Yetkisi</TableHead>
                  <TableHead className="text-center">Temiz Sınıf Yetkisi</TableHead>
                  <TableHead className="text-center">Ders Programı Yetkisi</TableHead>
                  <TableHead className="text-center">Zil Yetkisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Okul bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {filteredSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-semibold">{school.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                        {school.code}
                      </span>
                    </TableCell>
                    
                    {/* Yoklama */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFeature(school.id, "feature_attendance", school.feature_attendance)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                          school.feature_attendance ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            school.feature_attendance ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </TableCell>

                    {/* Kitap */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFeature(school.id, "feature_library", school.feature_library)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                          school.feature_library ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            school.feature_library ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </TableCell>

                    {/* Temiz Sınıf */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFeature(school.id, "feature_cleanliness", school.feature_cleanliness)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                          school.feature_cleanliness ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            school.feature_cleanliness ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </TableCell>

                    {/* Ders Programı */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFeature(school.id, "feature_lesson_schedule", school.feature_lesson_schedule)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                          school.feature_lesson_schedule ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            school.feature_lesson_schedule ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </TableCell>

                    {/* Zil */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleFeature(school.id, "feature_bell", school.feature_bell)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                          school.feature_bell ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            school.feature_bell ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
