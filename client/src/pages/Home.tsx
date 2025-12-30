import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { LogOut, Code2, Sparkles, ArrowRight, MoreVertical, Paperclip, Pencil, Check, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Home() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", description }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      localStorage.setItem(`pending_message_${project.id}`, prompt);
      setLocation(`/project/${project.id}`);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const updateProjectName = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditingId(null);
      toast({ title: "Saved", description: "Project name updated." });
    },
  });

  const handleSaveName = (id: number) => {
    if (!editName.trim()) return;
    updateProjectName.mutate({ id, name: editName.trim() });
  };

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
  };

  const handleFileClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        toast({ title: "File selected", description: file.name });
      }
    };
    input.click();
  };

  const handleStart = () => {
    if (!prompt.trim()) return;
    createProject.mutate(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  const userName = user.name || user.email?.split("@")[0] || "there";

  return (
    <div className="vision-bg h-screen w-full fixed inset-0">
      {/* Header */}
      <header className="px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg gradient-text">DevAssist</span>
        </div>
        <button
          onClick={handleLogout}
          className="vision-card px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-all"
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-48 pb-16">
        {/* Greeting */}
        <div className="text-center mb-16 animate-float">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 gradient-text">
            Hi {userName}, what do you want to make?
          </h1>
        </div>

        {/* Vision Input Card */}
        <div className="glass-input-container shadow-xl shadow-blue-500/10 mb-16 group max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="vision-card px-2.5 py-1 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              App
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your idea..."
            rows={3}
            className="w-full resize-none border-0 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none text-lg leading-relaxed"
          />

          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={handleFileClick}
              className="vision-card p-2 text-slate-400 hover:text-blue-500"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={handleStart}
              disabled={!prompt.trim() || createProject.isPending}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl font-semibold transition-all duration-300 text-sm",
                prompt.trim() 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95" 
                  : "text-slate-400"
              )}
            >
              {createProject.isPending ? "Creating..." : "Start"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Recent Apps */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Your recent Apps</h2>
          {projects.length > 6 && (
            <button onClick={() => setShowAll(!showAll)} className="text-[10px] font-medium text-blue-500 hover:underline">
              {showAll ? "Show Less" : "View All"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
          {projectsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="vision-card aspect-[3/2] animate-pulse bg-white/20" />
            ))
          ) : (
            (showAll ? projects : projects.slice(0, 9)).map((project: any) => (
              <div key={project.id} className="group relative">
                <Link href={`/project/${project.id}`}>
                  <div className="vision-card overflow-hidden cursor-pointer relative hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_12px_40px_rgba(59,130,246,0.2)] hover:scale-[1.03] transition-all duration-300">
                    {/* Menu button */}
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === project.id ? null : project.id);
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/30 dark:hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all duration-200 bg-white/20 dark:bg-white/10"
                        data-testid={`button-menu-project-${project.id}`}
                      >
                        <MoreVertical className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                      </button>
                      {menuOpenId === project.id && (
                        <div className="absolute right-0 top-full mt-2 bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden z-30 min-w-[150px] border border-white/40 dark:border-white/10 animate-in fade-in duration-150">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingId(project.id);
                              setEditName(project.name);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-blue-500/30 text-slate-800 dark:text-slate-100 transition-colors flex items-center gap-3 border-b border-white/20 dark:border-white/5"
                            data-testid={`button-edit-project-${project.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="font-medium">Edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm("Delete project?")) {
                                deleteProject.mutate(project.id);
                                setMenuOpenId(null);
                              }
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-500/30 text-slate-800 dark:text-slate-100 transition-colors flex items-center gap-3"
                            data-testid={`button-delete-project-${project.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="aspect-[3/2] bg-gradient-to-br from-blue-500/5 to-cyan-500/5 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/10 group-hover:scale-110 transition-transform duration-500">
                        <Code2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="p-3 bg-white/40 dark:bg-black/20 backdrop-blur-md">
                      <h3 className="font-bold text-slate-800 dark:text-white truncate text-sm">{project.name || "Untitled"}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                    </div>
                  </div>
                </Link>
                {editingId === project.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                    <button
                      onClick={() => updateProjectName.mutate({ id: project.id, name: editName })}
                      className="px-2 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs transition-all"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1.5 rounded-lg bg-gray-400 hover:bg-gray-500 text-white text-xs transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
