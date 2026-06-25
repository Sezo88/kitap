import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRoleManager } from "@/components/admin/user-role-manager";
import type { Role } from "@/lib/types/database";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "idareci")) {
    return <div className="text-center py-8 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const schoolFilter = profile.role === "super_admin" ? {} : { school_id: profile.school_id };
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .match(schoolFilter)
    .order("role")
    .order("full_name");

  const { data: classes } = await supabase.from("classes").select("*").match(schoolFilter).order("name");

  // Get teacher-class assignments
  const { data: teacherClasses } = await supabase.from("teacher_classes").select("*");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Kullanıcı Yönetimi</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Atandığı Sınıflar</TableHead>
                <TableHead className="w-32">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Henüz kullanıcı yok
                  </TableCell>
                </TableRow>
              )}
              {users?.map((u) => {
                const userClassIds = teacherClasses?.filter((tc) => tc.teacher_id === u.id).map((tc) => tc.class_id) || [];
                const userClasses = classes?.filter((c) => userClassIds.includes(c.id)) || [];

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "super_admin" ? "default" : u.role === "idareci" ? "secondary" : "outline"}>
                        {u.role === "super_admin" ? "Süper Admin" : u.role === "idareci" ? "İdareci" : "Öğretmen"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.role === "ogretmen" ? (
                        userClasses.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {userClasses.map((c) => (
                              <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Atama yok</span>
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserRoleManager
                        targetUserId={u.id}
                        currentRole={u.role}
                        allClasses={classes || []}
                        assignedClassIds={userClassIds}
                        isAdmin={profile.role === "super_admin"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
