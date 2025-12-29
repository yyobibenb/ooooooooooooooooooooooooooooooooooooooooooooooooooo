import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { LogOut, Code2, Sparkles, ArrowRight, MoreVertical, Paperclip, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
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

  const startEditing = (project: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.name || "");
  };

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const userName = user.name || user.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-white overflow-y-auto">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-800">DevAssist</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all text-sm"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        {/* Greeting */}
        <h1 className="text-3xl font-semibold text-gray-900 text-center mb-10">
          Hi {userName}, what do you want to make?
        </h1>

        {/* Chat Input Card - Liquid Glass Design */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] overflow-hidden mb-16">
          {/* Header with App label */}
          <div className="px-4 pt-4 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100/80 text-sm text-gray-700">
              <Sparkles className="w-4 h-4" />
              App
            </div>
          </div>

          {/* Input Area */}
          <div className="px-4 pb-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your idea, '/' for integrations..."
              rows={3}
              className="w-full resize-none border-0 bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none text-base"
              data-testid="input-project-prompt"
            />
          </div>

          {/* Bottom Bar */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>

            <button
              onClick={handleStart}
              disabled={!prompt.trim() || createProject.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
              data-testid="button-start-project"
            >
              {createProject.isPending ? "Creating..." : "Start"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Recent Apps Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your recent Apps</h2>
          {projects.length > 6 && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition-colors"
              data-testid="button-view-all"
            >
              {showAll ? "Show Less" : "View All"}
              <ArrowRight className={`w-4 h-4 transition-transform ${showAll ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {/* Projects Grid - Scrollable */}
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {projectsLoading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-400">
                <p>No projects yet. Describe your idea above to get started!</p>
              </div>
            ) : (
              (showAll ? projects : projects.slice(0, 6)).map((project: any) => (
                <div key={project.id}>
                  {editingId === project.id ? (
                    <div
                      className="group relative backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
                      data-testid={`project-card-${project.id}`}
                    >
                      <div className="aspect-[4/3] bg-gradient-to-br from-gray-100/80 to-gray-50/80 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                          <Code2 className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <div className="p-3 border-t border-white/60 bg-white/40">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveName(project.id)}
                            className="flex-1 text-sm px-2 py-1 rounded border border-gray-200 bg-white/80 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            placeholder="Project name..."
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`input-edit-name-${project.id}`}
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSaveName(project.id); }}
                            className="p-1 rounded hover:bg-green-100 text-green-600"
                            data-testid={`button-save-name-${project.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            data-testid={`button-cancel-name-${project.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {project.description?.slice(0, 40) || "No description"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Link href={`/project/${project.id}`}>
                      <div
                        className="group relative backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all cursor-pointer"
                        data-testid={`project-card-${project.id}`}
                      >
                        <div className="aspect-[4/3] bg-gradient-to-br from-gray-100/80 to-gray-50/80 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                            <Code2 className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        <div className="p-3 border-t border-white/60 bg-white/40">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-gray-900 text-sm truncate">
                                {project.name || "Untitled"}
                              </h3>
                              <p className="text-xs text-gray-500 truncate">
                                {project.description?.slice(0, 40) || "No description"}
                              </p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-all">
                              <button
                                onClick={(e) => startEditing(project, e)}
                                className="p-1.5 rounded-lg hover:bg-blue-100/80 text-gray-400 hover:text-blue-500"
                                data-testid={`button-edit-name-${project.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm("Delete this project?")) {
                                    deleteProject.mutate(project.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-100/80 text-gray-400 hover:text-red-500"
                                data-testid={`button-delete-project-${project.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
