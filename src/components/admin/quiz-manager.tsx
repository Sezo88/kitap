"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Plus, Trash2, Upload, HelpCircle } from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  answer: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  difficulty: string;
  category: string | null;
  is_active: boolean;
}

interface Props {
  schoolId: string;
  initialQuestions: QuizQuestion[];
}

export function QuizManager({ schoolId, initialQuestions }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [difficulty, setDifficulty] = useState("orta");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  async function handleAdd() {
    if (!question.trim() || !answer.trim()) { toast("Soru ve cevap zorunlu", "error"); return; }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("quiz_questions").insert({
      school_id: schoolId, question: question.trim(), answer: answer.trim(),
      option_a: optA.trim() || null, option_b: optB.trim() || null,
      option_c: optC.trim() || null, option_d: optD.trim() || null,
      difficulty, category: category.trim() || null,
    }).select("*").single();
    if (error) toast("Hata: " + error.message, "error");
    else {
      if (data) setQuestions([data, ...questions]);
      setQuestion(""); setAnswer(""); setOptA(""); setOptB(""); setOptC(""); setOptD(""); setCategory("");
      toast("Soru eklendi", "success");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu soruyu silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    await supabase.from("quiz_questions").delete().eq("id", id);
    setQuestions(questions.filter((q) => q.id !== id));
    toast("Sorular silindi", "success");
  }

  async function handleBulkImport() {
    if (!importText.trim()) { toast("Soru metnini yapistirin", "error"); return; }
    setImporting(true);
    const supabase = createClient();

    // Format: soru|cevap|a_secenegi|b_secenegi|c_secenegi|d_secenegi|zorluk|kategori
    const lines = importText.trim().split("\n").filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const parts = line.split("|").map((s) => s.trim());
      if (parts.length < 2) continue;
      const [q, a, oa, ob, oc, od, diff, cat] = parts;
      const { error } = await supabase.from("quiz_questions").insert({
        school_id: schoolId, question: q, answer: a,
        option_a: oa || null, option_b: ob || null,
        option_c: oc || null, option_d: od || null,
        difficulty: diff || "orta", category: cat || null,
      });
      if (!error) added++;
    }

    // Refresh
    const { data: fresh } = await supabase.from("quiz_questions").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
    if (fresh) setQuestions(fresh);

    toast(`${added} soru eklendi!`, "success");
    setImportText("");
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-5 w-5" />Toplu Soru Ekle (AI Format)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Her satır bir soru. Format: <code className="bg-muted px-1 rounded">soru|cevap|A|B|C|D|zorluk|kategori</code>
            <br />Örnek: <code className="bg-muted px-1 rounded">Türkiye&apos;nin başkenti?|Ankara|İstanbul|Ankara|İzmir|Bursa|kolay|coğrafya</code>
            <br />Yapay zekaya bu formatta soru-cevap ürettirebilirsiniz.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder="soru|cevap|A|B|C|D|zorluk|kategori&#10;soru|cevap|A|B|C|D|zorluk|kategori"
          />
          <Button onClick={handleBulkImport} disabled={importing}>
            <Upload className="h-4 w-4 mr-1" /> {importing ? "Ekleniyor..." : "Toplu Ekle"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Yeni Soru Ekle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium">Soru *</label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Soru metni" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Doğru Cevap *</label>
              <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Cevap" />
            </div>
            <div>
              <label className="text-xs font-medium">Zorluk</label>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div><label className="text-xs font-medium">A Seçeneği</label><Input value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="A" /></div>
            <div><label className="text-xs font-medium">B Seçeneği</label><Input value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="B" /></div>
            <div><label className="text-xs font-medium">C Seçeneği</label><Input value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="C" /></div>
            <div><label className="text-xs font-medium">D Seçeneği</label><Input value={optD} onChange={(e) => setOptD(e.target.value)} placeholder="D" /></div>
          </div>
          <div><label className="text-xs font-medium">Kategori</label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="örn: coğrafya, tarih, fen" /></div>
          <Button onClick={handleAdd} disabled={saving}><Plus className="h-4 w-4 mr-1" />Ekle</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Soru Bankası ({questions.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Soru</TableHead><TableHead>Cevap</TableHead><TableHead>Zorluk</TableHead><TableHead className="w-12"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Soru yok</TableCell></TableRow>}
              {questions.slice(0, 100).map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="text-sm max-w-[300px] truncate" title={q.question}>{q.question}</TableCell>
                  <TableCell className="text-sm font-medium text-green-600">{q.answer}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{q.difficulty}</span></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
