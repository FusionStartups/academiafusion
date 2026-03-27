import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Link } from "react-router-dom";
import { BookOpen, Clock, Filter, Search, ArrowRight, GraduationCap, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  duration: string | null;
  level: string | null;
  tags: string[];
}

interface CourseProgress {
  course_id: string;
  completed: number;
  total: number;
}

export default function CatalogPage() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: coursesData } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true);

      if (coursesData) setCourses(coursesData);

      if (user) {
        // Get progress for each course
        const { data: progressData } = await supabase
          .from("user_lesson_progress")
          .select("lesson_id, lessons!inner(module_id, modules!inner(course_id))")
          .eq("user_id", user.id);

        // Get total lessons per course
        const { data: lessonsData } = await supabase
          .from("lessons")
          .select("id, module_id, modules!inner(course_id)");

        if (progressData && lessonsData) {
          const prog: Record<string, CourseProgress> = {};
          
          // Count totals
          for (const l of lessonsData) {
            const cid = (l.modules as any)?.course_id;
            if (cid) {
              if (!prog[cid]) prog[cid] = { course_id: cid, completed: 0, total: 0 };
              prog[cid].total++;
            }
          }

          // Count completed
          for (const p of progressData) {
            const cid = (p.lessons as any)?.modules?.course_id;
            if (cid && prog[cid]) prog[cid].completed++;
          }

          setProgress(prog);
        }
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const filteredCourses = courses.filter((c) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    const matchLevel = !levelFilter || c.level === levelFilter;
    return matchSearch && matchLevel;
  });

  const levels = [...new Set(courses.map((c) => c.level).filter(Boolean))];

  const getStatus = (courseId: string) => {
    const p = progress[courseId];
    if (!p || p.completed === 0) return "not_started";
    if (p.completed >= p.total) return "completed";
    return "in_progress";
  };

  const getProgressPercent = (courseId: string) => {
    const p = progress[courseId];
    if (!p || p.total === 0) return 0;
    return Math.round((p.completed / p.total) * 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">
              Academia <span className="text-primary">Fusión</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="sm">Mi perfil</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Catálogo de cursos</h1>
          <p className="text-muted-foreground">Aprende a tu ritmo con nuestros cursos especializados para startups.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={levelFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter(null)}
            >
              Todos
            </Button>
            {levels.map((l) => (
              <Button
                key={l}
                variant={levelFilter === l ? "default" : "outline"}
                size="sm"
                onClick={() => setLevelFilter(l!)}
              >
                {l === "beginner" ? "Principiante" : l === "intermediate" ? "Intermedio" : l}
              </Button>
            ))}
          </div>
        </div>

        {/* Course grid */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Cargando cursos...</div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No hay cursos disponibles aún.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => {
              const status = getStatus(course.id);
              const pct = getProgressPercent(course.id);
              return (
                <Link
                  key={course.id}
                  to={`/course/${course.slug}`}
                  className="group block border border-border rounded-xl bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  {/* Cover */}
                  {course.cover_image ? (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={course.cover_image}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-primary/10 to-accent flex items-center justify-center">
                      <BookOpen className="h-12 w-12 text-primary/40 group-hover:text-primary/60 transition-colors" />
                    </div>
                  )}
                  
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {course.level && (
                        <Badge variant="secondary" className="text-xs font-mono uppercase tracking-wider">
                          {course.level === "beginner" ? "Principiante" : course.level}
                        </Badge>
                      )}
                      {course.duration && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                          <Clock className="h-3 w-3" />
                          {course.duration}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {course.description}
                    </p>

                    {/* Progress bar */}
                    {status !== "not_started" && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-1">
                          <span>{status === "completed" ? "✅ Completado" : "En progreso"}</span>
                          <span className="text-primary font-bold">{pct}%</span>
                        </div>
                        <div className="h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center text-primary text-sm font-semibold gap-1 group-hover:gap-2 transition-all">
                      {status === "not_started" ? "Empezar" : status === "completed" ? "Repasar" : "Continuar"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
