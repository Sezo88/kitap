"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Users, BookOpen } from "lucide-react";
import type { Subject, StudentProject, Class } from "@/lib/types/database";

interface Props {
  classes: Class[];
  subjects: Subject[];
  schoolFilter: { school_id?: string };
  userId: string;
}

export function ProjectAssignment({ classes, subjects, schoolFilter, userId }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [students, setStudents] = useState<any[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedClassId) return;
    fetchData();
  }, [selectedClassId]);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();

    const [studentsRes, projectsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, e_okul_no")
        .eq("class_id", selectedClassId)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("student_projects")
        .select("*")
        .eq("class_id", selectedClassId),
    ]);

    setStudents(studentsRes.data || []);
    setProjects(projectsRes.data || []);
    setLoading(false);
  }

  const projectMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    projects.forEach((p) => {
      const key = p.student_id;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(p.subject_id);
    });
    return map;
  }, [projects]);

  function isProjectAssigned(studentId: string, subjectId: string): boolean {
    return projectMap.get(studentId)?.has(subjectId) || false;
  }

  async function toggleProject(studentId: string, subjectId: string) {
    const supabase = createClient();
    const currentlyAssigned = isProjectAssigned(studentId, subjectId);

    if (currentlyAssigned) {
      const { error } = await supabase
        .from("student_projects")
        .delete()
        .eq("student_id", studentId)
        .eq("subject_id", subjectId);

      if (error) {
        toast("Kaldırma hatası: " + error.message, "error");
      } else {
        setProjects((prev) =>
          prev.filter((p) => !(p.student_id === studentId && p.subject_id === subjectId))
        );
      }
    } else {
      const { data, error } = await supabase
        .from("student_projects")
        .insert({
          student_id: studentId,
          subject_id: subjectId,
          class_id: selectedClassId,
          assigned_by: userId,
        })
        .select()
        .single();

      if (error) {
        toast("Ekleme hatası: " + error.message, "error");
      } else if (data) {
        setProjects((prev) => [...prev, data as StudentProject]);
      }
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-muted/30">
        <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">Henuz ders eklenmemis</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Proje atamasi yapabilmek icin idarecinin once &quot;Ders Yonetimi&quot; sayfasindan dersleri eklemesi gerekir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-auto min-w-[120px]">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" /> {students.length} ogrenci
        </Badge>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground animate-pulse">Yukleniyor...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-muted/30">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">Bu sinifta aktif ogrenci bulunamadi</p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {classes.find((c) => c.id === selectedClassId)?.name} - Proje Atama Tablosu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 bg-muted/50 text-left p-3 text-xs font-semibold text-muted-foreground border-b min-w-[40px]">
                    #
                  </th>
                  <th className="sticky left-[40px] bg-muted/50 text-left p-3 text-xs font-semibold text-muted-foreground border-b min-w-[160px]">
                    Ogrenci
                  </th>
                  {subjects.map((s) => (
                    <th
                      key={s.id}
                      className="p-3 text-xs font-semibold text-muted-foreground border-b text-center min-w-[90px] whitespace-nowrap"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-muted/30 transition-colors border-b">
                    <td className="sticky left-0 bg-background p-3 text-xs text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="sticky left-[40px] bg-background p-3">
                      <div className="text-sm font-medium">{student.full_name}</div>
                      {student.e_okul_no && (
                        <span className="text-[10px] text-muted-foreground font-mono">No: {student.e_okul_no}</span>
                      )}
                    </td>
                    {subjects.map((s) => {
                      const assigned = isProjectAssigned(student.id, s.id);
                      return (
                        <td key={s.id} className="p-3 text-center">
                          <button
                            onClick={() => toggleProject(student.id, s.id)}
                            className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                              assigned
                                ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                                : "bg-background border-input hover:border-primary/40 hover:bg-muted/50"
                            }`}
                            title={assigned ? `${s.name} projesi var - Kaldirmak icin tikla` : `${s.name} projesi yok - Eklemek icin tikla`}
                          >
                            {assigned ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
