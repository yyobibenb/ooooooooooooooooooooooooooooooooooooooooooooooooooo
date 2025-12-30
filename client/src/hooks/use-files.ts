import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertFile, type File as FileType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useFiles(projectId: number) {
  return useQuery({
    queryKey: ["files", projectId],
    queryFn: async () => {
      const url = buildUrl(api.files.list.path, { projectId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch files");
      return api.files.list.responses[200].parse(await res.json());
    },
    enabled: !!projectId,
  });
}

export function useCreateFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, ...data }: InsertFile) => {
      const url = buildUrl(api.files.create.path, { projectId });
      const res = await fetch(url, {
        method: api.files.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to create file");
      return api.files.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["files", data.projectId] });
      toast({ title: "File created" });
    },
  });
}

export function useUpdateFile() {
  const queryClient = useQueryClient();
  // No toast on success to avoid spamming while typing/autosaving
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertFile>) => {
      const url = buildUrl(api.files.update.path, { id });
      const res = await fetch(url, {
        method: api.files.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to update file");
      return api.files.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["files", data.projectId] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number, projectId: number }) => {
      const url = buildUrl(api.files.delete.path, { id });
      const res = await fetch(url, { 
        method: api.files.delete.method,
        credentials: "include" 
      });
      
      if (!res.ok) throw new Error("Failed to delete file");
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      toast({ title: "File deleted" });
    },
  });
}
