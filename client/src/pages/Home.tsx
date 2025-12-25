import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Plus, LogOut, Code2, FolderOpen, Sparkles, Trash2 } from "lucide-react";

export default function Home() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
    mutationFn: async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setName("");
      setDescription("");
      setIsCreating(false);
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

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-white flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-white p-6 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <header className="backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl p-4 mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Projects</h1>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 border border-gray-200 text-gray-600 hover:bg-white/80 hover:text-gray-800 transition-all text-sm font-medium"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </header>

        {/* Create Project Section */}
        <div className="backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl p-6 mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-3 text-gray-600 hover:text-gray-800 transition-colors"
              data-testid="button-show-create-form"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Create New Project</p>
                <p className="text-sm text-gray-500">Start building with AI assistance</p>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-gray-800">New Project</h2>
              </div>
              <input
                type="text"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
                data-testid="input-project-name"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
                data-testid="input-project-description"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => createProject.mutate()}
                  disabled={!name || createProject.isPending}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_24px_rgba(59,130,246,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  data-testid="button-create-project"
                >
                  <Plus className="w-4 h-4" />
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </button>
                <button
                  onClick={() => { setIsCreating(false); setName(""); setDescription(""); }}
                  className="px-6 py-3 rounded-xl bg-white/60 border border-gray-200 text-gray-600 hover:bg-white/80 transition-all font-medium"
                  data-testid="button-cancel-create"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 animate-pulse" />
            </div>
          ) : projects.length === 0 ? (
            <div className="col-span-full backdrop-blur-xl bg-white/40 border border-white/60 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-gray-500 mb-2">No projects yet</p>
              <p className="text-sm text-gray-400">Create your first project to get started</p>
            </div>
          ) : (
            projects.map((project: any) => (
              <div
                key={project.id}
                className="group backdrop-blur-xl bg-white/60 border border-white/80 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_40px_rgba(59,130,246,0.15)] hover:border-blue-200 transition-all cursor-pointer"
                data-testid={`project-card-${project.id}`}
              >
                <Link href={`/project/${project.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md">
                      <Code2 className="w-5 h-5 text-white" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm("Delete this project?")) {
                          deleteProject.mutate(project.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                      data-testid={`button-delete-project-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {project.description || "No description"}
                  </p>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
