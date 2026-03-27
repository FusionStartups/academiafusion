import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Link, Navigate } from "react-router-dom";
import {
  GraduationCap, Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft,
  ChevronDown, ChevronRight, Save, X, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  duration: string | null;
  level: string | null;
  tags: string[];
  is_published: boolean;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  sort_order: number;
}

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [courseDialog, setCourseDialog] = useState(false);
  const [moduleDialog, setModuleDialog] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<Course>>({});
  const [editingModule, setEditingModule] = useState<Partial<Module>>({});
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson>>({});
  const [saving, setSaving] = useState(false);

  // Load courses
  const loadCourses = async () => {
    const { data } = await supabase.from("courses").select("*").order("created_at");
    if (data) setCourses(data);
  };

  // Load modules & lessons for a course
  const loadCourseContent = async (courseId: string) => {
    const { data: mods } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");
    if (mods) setModules(mods);

    const { data: lsns } = await supabase
      .from("lessons")
      .select("*")
      .in("module_id", (mods || []).map((m) => m.id))
      .order("sort_order");
    if (lsns) setLessons(lsns);
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => {
    if (selectedCourse) loadCourseContent(selectedCourse.id);
  }, [selectedCourse]);

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  // -- COURSE CRUD --
  const openNewCourse = () => {
    setEditingCourse({ title: "", slug: "", description: "", duration: "", level: "beginner", tags: [], is_published: false });
    setCourseDialog(true);
  };
  const openEditCourse = (c: Course) => {
    setEditingCourse({ ...c });
    setCourseDialog(true);
  };
  const saveCourse = async () => {
    setSaving(true);
    const { id, ...data } = editingCourse as any;
    if (id) {
      const { error } = await supabase.from("courses").update(data).eq("id", id);
      if (error) toast.error(error.message); else toast.success("Curso actualizado");
    } else {
      const { error } = await supabase.from("courses").insert(data);
      if (error) toast.error(error.message); else toast.success("Curso creado");
    }
    setSaving(false);
    setCourseDialog(false);
    loadCourses();
  };
  const deleteCourse = async (id: string) => {
    if (!confirm("¿Eliminar este curso y todo su contenido?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Curso eliminado");
      if (selectedCourse?.id === id) { setSelectedCourse(null); setModules([]); setLessons([]); }
      loadCourses();
    }
  };
  const togglePublish = async (c: Course) => {
    await supabase.from("courses").update({ is_published: !c.is_published }).eq("id", c.id);
    loadCourses();
    if (selectedCourse?.id === c.id) setSelectedCourse({ ...c, is_published: !c.is_published });
    toast.success(c.is_published ? "Curso despublicado" : "Curso publicado");
  };

  // -- MODULE CRUD --
  const openNewModule = () => {
    if (!selectedCourse) return;
    setEditingModule({ course_id: selectedCourse.id, title: "", description: "", sort_order: modules.length });
    setModuleDialog(true);
  };
  const openEditModule = (m: Module) => {
    setEditingModule({ ...m });
    setModuleDialog(true);
  };
  const saveModule = async () => {
    setSaving(true);
    const { id, ...data } = editingModule as any;
    if (id) {
      const { error } = await supabase.from("modules").update(data).eq("id", id);
      if (error) toast.error(error.message); else toast.success("Módulo actualizado");
    } else {
      const { error } = await supabase.from("modules").insert(data);
      if (error) toast.error(error.message); else toast.success("Módulo creado");
    }
    setSaving(false);
    setModuleDialog(false);
    if (selectedCourse) loadCourseContent(selectedCourse.id);
  };
  const deleteModule = async (id: string) => {
    if (!confirm("¿Eliminar este módulo y todas sus lecciones?")) return;
    await supabase.from("modules").delete().eq("id", id);
    toast.success("Módulo eliminado");
    if (selectedCourse) loadCourseContent(selectedCourse.id);
  };

  // -- LESSON CRUD --
  const openNewLesson = (moduleId: string) => {
    const moduleLessons = lessons.filter((l) => l.module_id === moduleId);
    setEditingLesson({ module_id: moduleId, title: "", content: "", sort_order: moduleLessons.length });
    setLessonDialog(true);
  };
  const openEditLesson = (l: Lesson) => {
    setEditingLesson({ ...l });
    setLessonDialog(true);
  };
  const saveLesson = async () => {
    setSaving(true);
    const { id, ...data } = editingLesson as any;
    if (id) {
      const { error } = await supabase.from("lessons").update(data).eq("id", id);
      if (error) toast.error(error.message); else toast.success("Lección actualizada");
    } else {
      const { error } = await supabase.from("lessons").insert(data);
      if (error) toast.error(error.message); else toast.success("Lección creada");
    }
    setSaving(false);
    setLessonDialog(false);
    if (selectedCourse) loadCourseContent(selectedCourse.id);
  };
  const deleteLesson = async (id: string) => {
    if (!confirm("¿Eliminar esta lección?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    toast.success("Lección eliminada");
    if (selectedCourse) loadCourseContent(selectedCourse.id);
  };

  const toggleExpand = (id: string) => {
    setExpandedModules((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Academia <span className="text-primary">Fusión</span></span>
            </Link>
            <Badge variant="outline" className="text-xs font-mono uppercase tracking-wider border-primary/30 text-primary">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Catálogo</Button></Link>
            <Button variant="outline" size="sm" onClick={signOut}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
          <Button onClick={openNewCourse} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo curso</Button>
        </div>

        {/* Course list */}
        <div className="grid gap-4 lg:grid-cols-3 mb-8">
          {courses.map((c) => (
            <div
              key={c.id}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                selectedCourse?.id === c.id ? "border-primary bg-accent/30 shadow-sm" : "border-border hover:border-primary/30"
              }`}
              onClick={() => setSelectedCourse(c)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-sm flex-1">{c.title}</h3>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={(e) => { e.stopPropagation(); togglePublish(c); }}
                    className="p-1 rounded hover:bg-muted transition-colors" title={c.is_published ? "Despublicar" : "Publicar"}>
                    {c.is_published ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditCourse(c); }}
                    className="p-1 rounded hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteCourse(c.id); }}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
              <div className="flex items-center gap-2">
                <Badge variant={c.is_published ? "default" : "secondary"} className="text-[0.6rem]">
                  {c.is_published ? "Publicado" : "Borrador"}
                </Badge>
                {c.level && <span className="text-[0.6rem] font-mono text-muted-foreground uppercase">{c.level}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Selected course content */}
        {selectedCourse && (
          <div className="border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Contenido: {selectedCourse.title}</h2>
              <Button variant="outline" size="sm" onClick={openNewModule} className="gap-1">
                <Plus className="h-4 w-4" /> Añadir módulo
              </Button>
            </div>

            {modules.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Este curso aún no tiene módulos.</p>
            ) : (
              <div className="space-y-2">
                {modules.map((mod, mi) => {
                  const modLessons = lessons.filter((l) => l.module_id === mod.id);
                  const isOpen = expandedModules.has(mod.id);
                  return (
                    <div key={mod.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <button onClick={() => toggleExpand(mod.id)} className="shrink-0">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <span className="font-mono text-xs text-muted-foreground min-w-[2rem]">{String(mod.sort_order).padStart(2, "0")}</span>
                        <span className="font-semibold text-sm flex-1">{mod.title}</span>
                        <span className="text-xs text-muted-foreground font-mono">{modLessons.length} lecciones</span>
                        <button onClick={() => openEditModule(mod)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteModule(mod.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                      {isOpen && (
                        <div className="px-4 py-2 space-y-1">
                          {modLessons.map((lesson) => (
                            <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group">
                              <span className="font-mono text-[0.6rem] text-muted-foreground min-w-[1.5rem]">{lesson.sort_order}</span>
                              <span className="text-sm flex-1">{lesson.title}</span>
                              <button onClick={() => openEditLesson(lesson)} className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button onClick={() => deleteLesson(lesson.id)} className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => openNewLesson(mod.id)} className="w-full text-muted-foreground gap-1 mt-1">
                            <Plus className="h-3.5 w-3.5" /> Añadir lección
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Course Dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse.id ? "Editar curso" : "Nuevo curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={editingCourse.title || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Slug (URL)</Label><Input value={editingCourse.slug || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, slug: e.target.value }))} placeholder="mi-curso" /></div>
            <div><Label>Descripción</Label><Textarea value={editingCourse.description || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Duración</Label><Input value={editingCourse.duration || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, duration: e.target.value }))} placeholder="~2 horas" /></div>
              <div><Label>Nivel</Label><Input value={editingCourse.level || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, level: e.target.value }))} placeholder="beginner" /></div>
            </div>
            <div><Label>Tags (separados por coma)</Label><Input value={(editingCourse.tags || []).join(", ")} onChange={(e) => setEditingCourse((p) => ({ ...p, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))} /></div>
            <div><Label>URL de portada</Label><Input value={editingCourse.cover_image || ""} onChange={(e) => setEditingCourse((p) => ({ ...p, cover_image: e.target.value }))} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog(false)}>Cancelar</Button>
            <Button onClick={saveCourse} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule.id ? "Editar módulo" : "Nuevo módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={editingModule.title || ""} onChange={(e) => setEditingModule((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Input value={editingModule.description || ""} onChange={(e) => setEditingModule((p) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Orden</Label><Input type="number" value={editingModule.sort_order ?? 0} onChange={(e) => setEditingModule((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialog(false)}>Cancelar</Button>
            <Button onClick={saveModule} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson.id ? "Editar lección" : "Nueva lección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={editingLesson.title || ""} onChange={(e) => setEditingLesson((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Orden</Label><Input type="number" value={editingLesson.sort_order ?? 0} onChange={(e) => setEditingLesson((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            <div>
              <Label>Contenido (HTML)</Label>
              <Textarea
                value={editingLesson.content || ""}
                onChange={(e) => setEditingLesson((p) => ({ ...p, content: e.target.value }))}
                rows={15}
                className="font-mono text-xs"
                placeholder="<p>Contenido de la lección en HTML...</p>"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(false)}>Cancelar</Button>
            <Button onClick={saveLesson} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
