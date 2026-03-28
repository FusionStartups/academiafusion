import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Check, ArrowLeft, ArrowRight, Menu, GraduationCap, Trophy, Linkedin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Module {
  id: string;
  title: string;
  sort_order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content: string | null;
  sort_order: number;
  module_id: string;
}

export default function CoursePlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [certificateCode, setCertificateCode] = useState<string | null>(null);

  // Load course data
  useEffect(() => {
    async function load() {
      if (!slug) return;
      
      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (!courseData) { navigate("/"); return; }
      setCourse(courseData);

      const { data: modulesData } = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", courseData.id)
        .order("sort_order");

      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("*")
        .in("module_id", (modulesData || []).map((m) => m.id))
        .order("sort_order");

      const mods: Module[] = (modulesData || []).map((m) => ({
        ...m,
        lessons: (lessonsData || []).filter((l) => l.module_id === m.id),
      }));

      setModules(mods);

      // Load progress first, then set active lesson
      const allLessonsFlat = mods.flatMap((m) => m.lessons);
      let completedSet = new Set<string>();

      if (user) {
        const { data: progressData } = await supabase
          .from("user_lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id);

        if (progressData) {
          completedSet = new Set(progressData.map((p) => p.lesson_id));
          setCompletedLessons(completedSet);
        }
      }

      // Set active lesson: restore last viewed, or first uncompleted, or last
      if (allLessonsFlat.length > 0) {
        const savedLessonId = localStorage.getItem(`course-lesson-${courseData.id}`);
        const savedLesson = savedLessonId ? allLessonsFlat.find((l) => l.id === savedLessonId) : null;
        const firstUncompleted = allLessonsFlat.find((l) => !completedSet.has(l.id));
        const targetLesson = savedLesson || firstUncompleted || allLessonsFlat[allLessonsFlat.length - 1];
        setActiveLessonId(targetLesson.id);
        const targetModule = mods.find((m) => m.id === targetLesson.module_id);
        setOpenModules(new Set(targetModule ? [targetModule.id] : [mods[0].id]));
      }
    }
    load();
  }, [slug, user, navigate]);

  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = activeIndex >= 0 ? allLessons[activeIndex] : null;
  const activeModule = modules.find((m) => m.id === activeLesson?.module_id);

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => completedLessons.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goToLesson = (id: string) => {
    setActiveLessonId(id);
    setSidebarOpen(false);
    document.getElementById("content-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    // Open parent module
    const parentMod = modules.find((m) => m.lessons.some((l) => l.id === id));
    if (parentMod) setOpenModules((prev) => new Set(prev).add(parentMod.id));
  };

  const go = (dir: -1 | 1) => {
    const newIdx = activeIndex + dir;
    if (newIdx >= 0 && newIdx < allLessons.length) {
      goToLesson(allLessons[newIdx].id);
    }
  };

  const toggleDone = async () => {
    if (!activeLesson || !user) return;
    const isCompleted = completedLessons.has(activeLesson.id);

    if (isCompleted) {
      await supabase
        .from("user_lesson_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("lesson_id", activeLesson.id);
      setCompletedLessons((prev) => {
        const next = new Set(prev);
        next.delete(activeLesson.id);
        return next;
      });
      setShowCompletion(false);
    } else {
      await supabase.from("user_lesson_progress").insert({
        user_id: user.id,
        lesson_id: activeLesson.id,
      });
      const newCompleted = new Set(completedLessons);
      newCompleted.add(activeLesson.id);
      setCompletedLessons(newCompleted);

      const newCompletedCount = allLessons.filter((l) => newCompleted.has(l.id)).length;
      const isLastLesson = activeIndex === allLessons.length - 1;
      const isCourseComplete = newCompletedCount >= totalLessons;

      if (isCourseComplete && course) {
        // Issue certificate
        const { data: certData, error } = await supabase
          .from("certificates")
          .insert({ user_id: user.id, course_id: course.id })
          .select("certificate_code")
          .single();
        if (!error && certData) {
          setCertificateCode(certData.certificate_code);
        }
        setShowCompletion(true);
      } else if (!isLastLesson) {
        // Auto-advance to next lesson
        toast.success("¡Lección completada!");
        setTimeout(() => goToLesson(allLessons[activeIndex + 1].id), 600);
      } else {
        toast.success("¡Lección completada!");
      }
    }
  };

  const getLinkedInUrl = () => {
    if (!course) return "#";
    const now = new Date();
    const params = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: course.title,
      organizationName: "Academia Fusión",
      issueYear: String(now.getFullYear()),
      issueMonth: String(now.getMonth() + 1),
      certUrl: window.location.origin + "/curso/" + slug,
      certId: certificateCode || "",
    });
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
  };

  const isModuleComplete = (mod: Module) =>
    mod.lessons.every((l) => completedLessons.has(l.id));

  if (!course) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 h-screen w-[310px] min-w-[310px] bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 pb-4 border-b border-border shrink-0">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Fusión Startups · 2026
          </p>
          <h2 className="text-base font-bold leading-tight">
            {course.title.split("Claude Code")[0]}
            <span className="text-primary">Claude Code</span>
            {course.title.split("Claude Code")[1] || ""}
          </h2>
        </div>

        {/* Progress */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between font-mono text-[0.62rem] text-muted-foreground tracking-wider mb-1.5">
            <span>Progreso</span>
            <span className="text-primary font-bold">{completedCount} / {totalLessons}</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {modules.map((mod) => {
            const isOpen = openModules.has(mod.id);
            const hasActive = mod.lessons.some((l) => l.id === activeLessonId);
            const allDone = isModuleComplete(mod);

            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground/50 text-[0.55rem] w-3 shrink-0 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>
                    ▶
                  </span>
                  <span className={`font-mono text-[0.6rem] min-w-[1.4rem] shrink-0 ${hasActive ? "text-primary font-bold" : "text-muted-foreground/50"}`}>
                    {String(mod.sort_order).padStart(2, "0")}
                  </span>
                  <span className={`text-[0.78rem] font-semibold text-left flex-1 leading-tight ${allDone ? "text-muted-foreground" : "text-foreground/80"}`}>
                    {mod.title}
                  </span>
                  {allDone && (
                    <span className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-2 w-2 text-primary-foreground" />
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="pb-1">
                    {mod.lessons.map((lesson) => {
                      const isActive = lesson.id === activeLessonId;
                      const isDone = completedLessons.has(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => goToLesson(lesson.id)}
                          className={`w-full flex items-start gap-2 px-5 pl-12 py-1.5 transition-colors relative ${
                            isActive ? "bg-accent" : "hover:bg-muted/50"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r" />
                          )}
                          <span className={`w-3.5 h-3.5 rounded-full border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center text-[0.42rem] ${
                            isDone ? "bg-primary border-primary text-primary-foreground" : "border-border text-transparent"
                          }`}>
                            ✓
                          </span>
                          <span className={`text-[0.74rem] text-left leading-snug ${
                            isActive ? "text-foreground font-semibold" : isDone ? "text-muted-foreground" : "text-foreground/70"
                          }`}>
                            {lesson.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Back to catalog */}
        <div className="p-4 border-t border-border shrink-0">
          <Link to="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Volver al catálogo
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile topbar */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="border border-border rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold truncate">
            {activeLesson?.title}
          </span>
        </div>

        {/* Content */}
        <div id="content-scroll" className="flex-1 overflow-y-auto custom-scrollbar">
          {showCompletion ? (
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Trophy className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                🎉 ¡Felicidades!
              </h1>
              <p className="text-lg text-muted-foreground mb-2 max-w-md">
                Has completado con éxito el curso
              </p>
              <p className="text-xl font-bold text-primary mb-8">
                {course?.title}
              </p>
              {certificateCode && (
                <p className="text-sm text-muted-foreground mb-6 font-mono">
                  Certificado: {certificateCode}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={getLinkedInUrl()} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="gap-2">
                    <Linkedin className="h-5 w-5" />
                    Añadir a perfil de LinkedIn
                  </Button>
                </a>
                <Link to="/perfil">
                  <Button variant="outline" size="lg" className="gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Ver mis diplomas
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="ghost" size="lg" className="gap-2">
                    <ArrowLeft className="h-5 w-5" />
                    Volver al catálogo
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-w-[760px] mx-auto px-6 py-8 pb-16">
              {activeLesson && activeModule && (
                <>
                  <div className="mb-8 pb-5 border-b border-border">
                    <p className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">
                      Módulo {String(activeModule.sort_order).padStart(2, "0")} ·{" "}
                      <strong className="text-primary">{activeModule.title}</strong>
                    </p>
                    <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                      {activeLesson.title}
                    </h1>
                  </div>

                  <div
                    className="lesson-content"
                    dangerouslySetInnerHTML={{ __html: activeLesson.content || "" }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card shrink-0 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => go(-1)}
            disabled={activeIndex <= 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>

          <Button
            variant={activeLesson && completedLessons.has(activeLesson.id) ? "default" : "outline"}
            size="sm"
            onClick={toggleDone}
            className={`gap-1.5 ${
              activeLesson && completedLessons.has(activeLesson.id)
                ? ""
                : "border-2 border-primary/30 bg-accent text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {activeLesson && completedLessons.has(activeLesson.id) ? (
              <>
                <Check className="h-4 w-4" /> Completada
              </>
            ) : (
              <>☐ Completar lección</>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => go(1)}
            disabled={activeIndex >= allLessons.length - 1}
            className="gap-1"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
