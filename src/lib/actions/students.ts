"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndProfile } from "@/lib/supabase/auth-cache";
import { revalidatePath } from "next/cache";
import type { ParsedStudent } from "@/lib/pdf/parse-school-pdf";

export interface ImportResult {
  success: boolean;
  error?: string;
  counts?: {
    newCount: number;
    updatedCount: number;
    skippedCount: number;
    deactivatedCount: number;
  };
}

export async function importSchoolStudents(allStudents: ParsedStudent[]): Promise<ImportResult> {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) {
    return { success: false, error: "Oturum açmanız gerekiyor" };
  }

  if (profile.role !== "super_admin" && profile.role !== "idareci") {
    return { success: false, error: "Bu işlem için yetkiniz yok" };
  }

  const schoolId = profile.school_id;
  if (!schoolId) {
    return { success: false, error: "Kullanıcıya ait okul bulunamadı" };
  }

  const supabase = createAdminClient();

  // 1. Mevcut sınıfları çek
  const { data: existingClasses, error: classFetchError } = await supabase
    .from("classes")
    .select("id, name, is_active")
    .eq("school_id", schoolId);

  if (classFetchError) {
    return { success: false, error: "Sınıf bilgileri alınamadı: " + classFetchError.message };
  }

  // PDF'teki sınıfları hazırla
  const existingClassMap = new Map<string, { id: string; is_active: boolean }>();
  existingClasses?.forEach((c) => {
    existingClassMap.set(c.name.toUpperCase().trim(), { id: c.id, is_active: c.is_active });
  });

  const pdfClassNames = new Set(allStudents.map((s) => s.className.trim()));
  const classNameToId: Record<string, string> = {};

  for (const cName of pdfClassNames) {
    const existing = existingClassMap.get(cName.toUpperCase());
    if (existing) {
      classNameToId[cName] = existing.id;
      if (!existing.is_active) {
        // Pasif olan sınıf listede varsa yeniden aktifleştir
        await supabase
          .from("classes")
          .update({ is_active: true })
          .eq("id", existing.id);
      }
    } else {
      // Yeni sınıf oluştur (aktif olarak)
      const gradeMatch = cName.match(/(\d+)/);
      const grade = gradeMatch ? parseInt(gradeMatch[1]) : 1;
      const { data: newClass, error: newClassErr } = await supabase
        .from("classes")
        .insert({
          name: cName,
          grade_level: grade,
          school_id: schoolId,
          is_active: true,
        })
        .select("id")
        .single();

      if (newClass) {
        classNameToId[cName] = newClass.id;
      } else if (newClassErr) {
        console.error("Yeni sınıf açma hatası:", newClassErr);
      }
    }
  }

  // PDF'te OLMAYAN sınıfları otomatik pasife al (örn: 8/C, 8/D)
  const importedClassIdSet = new Set(Object.values(classNameToId));
  for (const cls of existingClasses || []) {
    if (!importedClassIdSet.has(cls.id) && cls.is_active) {
      await supabase
        .from("classes")
        .update({ is_active: false })
        .eq("id", cls.id);
    }
  }

  // 2. Mevcut öğrencileri çek (mükerrer ve güncelleme kontrolü)
  const { data: existingStudents, error: studentFetchErr } = await supabase
    .from("students")
    .select("id, full_name, e_okul_no, class_id, is_active")
    .eq("school_id", schoolId);

  if (studentFetchErr) {
    return { success: false, error: "Mevcut öğrenciler alınamadı: " + studentFetchErr.message };
  }

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, " ")
      .trim();

  const existingByNo = new Map<string, any>();
  const existingByName = new Map<string, any>();

  existingStudents?.forEach((s) => {
    if (s.e_okul_no) {
      existingByNo.set(s.e_okul_no.trim(), s);
    }
    if (s.full_name) {
      existingByName.set(normalize(s.full_name), s);
    }
  });

  const importedStudentIds = new Set<string>();
  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const toInsert: any[] = [];

  for (const s of allStudents) {
    const classId = classNameToId[s.className.trim()];
    if (!classId) continue;

    const no = s.studentNo?.trim();
    let existing = no ? existingByNo.get(no) : null;
    if (!existing && s.fullName) {
      existing = existingByName.get(normalize(s.fullName));
    }

    if (existing) {
      importedStudentIds.add(existing.id);

      const needsReactivate = !existing.is_active;
      const needsClassUpdate = existing.class_id !== classId;
      const needsNoUpdate = !existing.e_okul_no && no;
      const needsNameUpdate = existing.full_name !== s.fullName.trim();

      if (needsReactivate || needsClassUpdate || needsNoUpdate || needsNameUpdate) {
        await supabase
          .from("students")
          .update({
            is_active: true,
            class_id: classId,
            full_name: s.fullName.trim(),
            e_okul_no: no || existing.e_okul_no,
          })
          .eq("id", existing.id);
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      toInsert.push({
        full_name: s.fullName.trim(),
        e_okul_no: no || null,
        class_id: classId,
        school_id: schoolId,
        is_active: true,
      });
    }
  }

  // Toplu Ekleme (50'şerli parçalar halinde hızlı ve güvenli)
  if (toInsert.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { data: inserted, error: insErr } = await supabase
        .from("students")
        .insert(chunk)
        .select("id");

      if (insErr) {
        console.error("Toplu öğrenci ekleme hatası:", insErr);
        return { success: false, error: "Öğrenci ekleme hatası: " + insErr.message };
      } else if (inserted) {
        inserted.forEach((item) => importedStudentIds.add(item.id));
        newCount += inserted.length;
      }
    }
  }

  // PDF'te OLMAYAN öğrencileri pasife al (Arşivle)
  let deactivatedCount = 0;
  const toDeactivateIds: string[] = [];
  for (const s of existingStudents || []) {
    if (s.is_active && !importedStudentIds.has(s.id)) {
      toDeactivateIds.push(s.id);
    }
  }

  if (toDeactivateIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < toDeactivateIds.length; i += chunkSize) {
      const chunk = toDeactivateIds.slice(i, i + chunkSize);
      await supabase
        .from("students")
        .update({ is_active: false })
        .in("id", chunk);
      deactivatedCount += chunk.length;
    }
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/students/import-pdf");
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");

  return {
    success: true,
    counts: { newCount, updatedCount, skippedCount, deactivatedCount },
  };
}

export async function saveStudent(payload: {
  id?: string;
  fullName: string;
  classId: string;
  eOkulNo?: string | null;
  veliTelefon?: string | null;
  veliTelefon2?: string | null;
  veliSahip?: string | null;
  veliSahip2?: string | null;
  dogumTarihi?: string | null;
}) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };

  const supabase = createAdminClient();
  const schoolId = profile.school_id;

  if (payload.id) {
    let query = supabase
      .from("students")
      .update({
        full_name: payload.fullName.trim(),
        class_id: payload.classId,
        e_okul_no: payload.eOkulNo || null,
        veli_telefon: payload.veliTelefon || null,
        veli_telefon_2: payload.veliTelefon2 || null,
        veli_telefon_sahip: payload.veliSahip || null,
        veli_telefon_2_sahip: payload.veliSahip2 || null,
        dogum_tarihi: payload.dogumTarihi || null,
      })
      .eq("id", payload.id);

    if (profile.role !== "super_admin" && schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/students");
    return { success: true };
  } else {
    if (!schoolId) return { success: false, error: "Okul bilgisi bulunamadı" };

    const { data, error } = await supabase
      .from("students")
      .insert({
        full_name: payload.fullName.trim(),
        class_id: payload.classId,
        school_id: schoolId,
        e_okul_no: payload.eOkulNo || null,
        veli_telefon: payload.veliTelefon || null,
        veli_telefon_2: payload.veliTelefon2 || null,
        veli_telefon_sahip: payload.veliSahip || null,
        veli_telefon_2_sahip: payload.veliSahip2 || null,
        dogum_tarihi: payload.dogumTarihi || null,
        is_active: true,
      })
      .select("*, classes!inner(name)")
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/students");
    return { success: true, data };
  }
}

export async function deleteStudent(studentId: string) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };

  const supabase = createAdminClient();
  let query = supabase
    .from("students")
    .update({ is_active: false })
    .eq("id", studentId);

  if (profile.role !== "super_admin" && profile.school_id) {
    query = query.eq("school_id", profile.school_id);
  }

  const { error } = await query;
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function bulkUpdateVeliPhones(
  updates: {
    id: string;
    veli_telefon?: string | null;
    veli_telefon_2?: string | null;
    veli_telefon_sahip?: string | null;
    veli_telefon_2_sahip?: string | null;
  }[]
) {
  const { user, profile } = await getCachedUserAndProfile();
  if (!user || !profile) return { success: false, error: "Oturum açmanız gerekiyor" };

  const supabase = createAdminClient();
  let updateCount = 0;

  for (const item of updates) {
    const payload: any = {};
    if (item.veli_telefon !== undefined) payload.veli_telefon = item.veli_telefon;
    if (item.veli_telefon_2 !== undefined) payload.veli_telefon_2 = item.veli_telefon_2;
    if (item.veli_telefon_sahip !== undefined) payload.veli_telefon_sahip = item.veli_telefon_sahip;
    if (item.veli_telefon_2_sahip !== undefined) payload.veli_telefon_2_sahip = item.veli_telefon_2_sahip;

    const { error } = await supabase
      .from("students")
      .update(payload)
      .eq("id", item.id);

    if (!error) updateCount++;
  }

  revalidatePath("/dashboard/students");
  return { success: true, updateCount };
}
