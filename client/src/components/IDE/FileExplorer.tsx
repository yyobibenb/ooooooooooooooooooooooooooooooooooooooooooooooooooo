import { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, FileIcon, FolderIcon, FolderOpen, RefreshCw, ChevronRight, ChevronDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FSFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content?: string;
  isDirectory?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  file?: FSFile;
}

interface FileExplorerProps {
  projectId: number;
  activeFileId: string | number | null;
  onSelectFile: (file: FSFile) => void;
}

export function FileExplorer({ projectId, activeFileId, onSelectFile }: FileExplorerProps) {
  const queryClient = useQueryClient();
  const [newFileName, setNewFileName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: files = [], refetch } = useQuery({
    queryKey: ["/api/fs/files", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/fs/${projectId}/files`, { credentials: "include" });
      if (!res.ok) return [];
      return (await res.json()) as FSFile[];
    },
    refetchInterval: 2000,
  });

  const fileTree = useMemo(() => {
    const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
    
    const sortedFiles = [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.path.localeCompare(b.path);
    });

    for (const file of sortedFiles) {
      const parts = file.path.split("/").filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join("/");

        let child = current.children.find(c => c.name === part);
        
        if (!child) {
          child = {
            name: part,
            path: currentPath,
            isDirectory: isLast ? !!file.isDirectory : true,
            children: [],
            file: isLast ? file : undefined
          };
          current.children.push(child);
        } else if (isLast && file) {
          child.file = file;
          child.isDirectory = !!file.isDirectory;
        }

        current = child;
      }
    }

    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root.children;
  }, [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const createFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const res = await fetch(`/api/fs/${projectId}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fs/files", projectId] });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await fetch(`/api/fs/${projectId}/file?path=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fs/files", projectId] });
    },
  });

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    createFileMutation.mutate(
      { path: newFileName, content: "// Start coding here...\n" },
      { onSuccess: () => { setIsDialogOpen(false); setNewFileName(""); } }
    );
  };

  const handleDelete = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    if (confirm("Delete this file?")) {
      deleteFileMutation.mutate(filePath);
    }
  };

  const handleDownload = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    window.open(`/api/fs/${projectId}/download?path=${encodeURIComponent(filePath)}`, "_blank");
  };

  const handleSelectFile = async (file: FSFile) => {
    try {
      const res = await fetch(`/api/fs/${projectId}/file?path=${encodeURIComponent(file.path)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const fullFile = await res.json();
        onSelectFile(fullFile);
      }
    } catch (err) {
      console.error("Failed to load file:", err);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    for (const file of droppedFiles) {
      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result;
        if (typeof content === "string") {
          await createFileMutation.mutateAsync({ path: file.name, content });
        } else if (content instanceof ArrayBuffer) {
          const res = await fetch(`/api/fs/${projectId}/upload?path=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: content,
            credentials: "include",
          });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["/api/fs/files", projectId] });
          }
        }
      };
      
      if (file.type.startsWith("text/") || file.name.match(/\.(js|ts|jsx|tsx|json|css|html|md|txt|py|sql|sh)$/)) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    }
  }, [createFileMutation, queryClient, projectId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const fileId = node.file?.id;

    if (node.isDirectory) {
      return (
        <div key={node.path} data-testid={`folder-item-${node.path}`}>
          <div
            onClick={() => toggleFolder(node.path)}
            className={cn(
              "group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-all",
              "text-gray-600 hover:bg-white/60"
            )}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
            ) : (
              <FolderIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
            <span className="truncate text-xs">{node.name}</span>
          </div>
          {isExpanded && (
            <div>
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        onClick={() => node.file && handleSelectFile(node.file)}
        className={cn(
          "group flex items-center justify-between px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-all",
          activeFileId === fileId
            ? "bg-blue-100/80 text-blue-700"
            : "text-gray-600 hover:bg-white/60"
        )}
        style={{ paddingLeft: `${20 + depth * 12}px` }}
        data-testid={`file-item-${fileId}`}
      >
        <div className="flex items-center gap-2 truncate">
          <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="truncate text-xs">{node.name}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => handleDownload(e, node.path)}
            className="p-1 rounded hover:bg-blue-100 hover:text-blue-500 transition-all"
            data-testid={`button-download-file-${fileId}`}
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => handleDelete(e, node.path)}
            className="p-1 rounded hover:bg-red-100 hover:text-red-500 transition-all"
            data-testid={`button-delete-file-${fileId}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={cn(
        "h-full flex flex-col transition-colors",
        isDragging && "bg-blue-50/50"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="p-3 border-b border-white/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Files</h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              setIsDownloading(true);
              window.open(`/api/fs/${projectId}/download-zip`, "_blank");
              setTimeout(() => setIsDownloading(false), 2000);
            }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all hover:scale-110 active:scale-95"
            title="Download project as ZIP"
            data-testid="button-download-zip"
          >
            <Download className={cn("w-3.5 h-3.5 transition-transform", isDownloading && "animate-bounce")} />
          </button>
          <button 
            onClick={async () => {
              setIsRefreshing(true);
              await refetch();
              setTimeout(() => setIsRefreshing(false), 500);
            }}
            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all hover:scale-110 active:scale-95"
            title="Refresh files"
            data-testid="button-refresh-files"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 transition-transform", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {fileTree.map(node => renderTreeNode(node, 0))}

        {files.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400">
            {isDragging ? "Drop files here" : "No files yet"}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-white/40">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button 
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl backdrop-blur-[30px] bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 text-gray-600 hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-[0_8px_24px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_8px_24px_rgba(59,130,246,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-medium shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]"
              data-testid="button-new-file"
            >
              <Plus className="w-3.5 h-3.5" />
              New file
            </button>
          </DialogTrigger>
          <DialogContent className="backdrop-blur-xl bg-white/90 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800 text-base">New File</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateFile} className="space-y-3 mt-2">
              <input
                type="text"
                placeholder="filename.js or folder/filename.js"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent text-sm"
                autoFocus
                data-testid="input-new-filename"
              />
              <button 
                type="submit" 
                className="w-full px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                data-testid="button-create-file"
              >
                Create
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
