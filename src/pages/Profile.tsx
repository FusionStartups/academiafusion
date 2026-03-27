import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft, BookOpen, Award, ExternalLink, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Certificate {
  id: string;
  certificate_code: string;
  issued_at: string;
  course: { title: string; slug: string };
}

interface CourseProgress {
  id: string;
  title: string;
  slug: string;
  completed: number;
  total: number;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [coursesInProgress, setCoursesInProgress] = useState<CourseProgress[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      // Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user!.id)
        .single();
      if (profileData) setProfile(profileData);

      // Certificates
      const { data: certsData } = await supabase
        .from("certificates")
        .select("id, certificate_code, issued_at, courses(title, slug)")
        .eq("user_id", user!.id)
        .order("issued_at", { ascending: false });

      if (certsData) {
        setCertificates(
          certsData.map((c: any) => ({
            ...c,
            course: c.courses,
          }))
        );
      }

      // Course progress
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title, slug")
        .eq("is_published", true);

      if (courses) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, module_id, modules!inner(course_id)");

        const { data: progress } = await supabase
          .from("user_lesson_progress")
          .select("lesson_id, lessons!inner(module_id, modules!inner(course_id))")
          .eq("user_id", user!.id);

        const courseProgress: CourseProgress[] = [];
        for (const course of courses) {
          const totalLessons = (lessons || []).filter(
            (l) => (l.modules as any)?.course_id === course.id
          ).length;
          const completedLessons = (progress || []).filter(
            (p) => (p.lessons as any)?.modules?.course_id === course.id
          ).length;

          if (completedLessons > 0 && completedLessons < totalLessons) {
            courseProgress.push({
              ...course,
              completed: completedLessons,
              total: totalLessons,
            });
          }
        }
        setCoursesInProgress(courseProgress);
      }
    }
    load();
  }, [user]);

  const linkedinShareUrl = (cert: Certificate) => {
    const text = `¡He completado el curso "${cert.course.title}" en Academia Fusión! 🎓`;
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&title=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">
              Academia <span className="text-primary">Fusión</span>
            </span>
          </Link>
          <Button variant="outline" size="sm" onClick={signOut}>Salir</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1 mb-6 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </Button>
        </Link>

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile?.display_name || "Usuario"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Courses in progress */}
        {coursesInProgress.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Cursos en progreso
            </h2>
            <div className="space-y-3">
              {coursesInProgress.map((c) => (
                <Link
                  key={c.id}
                  to={`/course/${c.slug}`}
                  className="block border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{c.title}</span>
                    <span className="font-mono text-xs text-primary font-bold">
                      {Math.round((c.completed / c.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                      style={{ width: `${(c.completed / c.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    {c.completed} de {c.total} lecciones
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Certificates */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Diplomas
          </h2>
          {certificates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
              <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Aún no has completado ningún curso.</p>
              <p className="text-sm">¡Completa todas las lecciones de un curso para obtener tu diploma!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="border border-border rounded-xl p-6 bg-gradient-to-br from-card to-accent/20"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className="mb-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                        🎓 Completado
                      </Badge>
                      <h3 className="text-lg font-bold">{cert.course.title}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Emitido el {new Date(cert.issued_at).toLocaleDateString("es-ES", {
                          day: "numeric", month: "long", year: "numeric"
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Código: {cert.certificate_code}
                      </p>
                    </div>
                    <a
                      href={linkedinShareUrl(cert)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Linkedin className="h-4 w-4" /> Compartir
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
