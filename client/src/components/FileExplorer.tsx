import { type File as FileType } from "@shared/schema";
import { FileCode2, FilePlus, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCreateFile, useDeleteFile } from "@/hooks/use-files";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileExplorerProps {
  projectId: number;
  files: FileType[];
  activeFileId: number | null;
  onFileSelect: (file: FileType) => void;
}

export function FileExplorer({ projectId, files, activeFileId, onFileSelect }: FileExplorerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    
    // Determine language based on extension (simple heuristic)
    const ext = newFileName.split(".").pop();
    let language = "plaintext";
    if (ext === "js" || ext === "jsx") language = "javascript";
    if (ext === "ts" || ext === "tsx") language = "typescript";
    if (ext === "html") language = "html";
    if (ext === "css") language = "css";
    if (ext === "json") language = "json";
    if (ext === "py") language = "python";

    await createFile.mutateAsync({
      projectId,
      name: newFileName,
      language,
      content: "// New file created",
    });
    
    setNewFileName("");
    setIsCreateOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this file?")) {
      deleteFile.mutate({ id, projectId });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Files
        </span>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/20 hover:text-primary">
              <FilePlus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="filename">Filename</Label>
                <Input
                  id="filename"
                  placeholder="script.js"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createFile.isPending}>
                {createFile.isPending ? "Creating..." : "Create File"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {files.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center italic">
            No files yet. Create one to start coding.
          </div>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onFileSelect(file)}
                className={cn(
                  "group flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 border-transparent",
                  activeFileId === file.id
                    ? "bg-primary/10 text-primary border-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode2 className={cn("w-4 h-4", activeFileId === file.id ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => handleDelete(e, file.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
