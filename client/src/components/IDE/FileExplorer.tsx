import { useState } from "react";
import { Plus, Trash2, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateFile, useDeleteFile, useFiles } from "@/hooks/use-projects";
import { type File as FileType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FileExplorerProps {
  projectId: number;
  activeFileId: number | null;
  onSelectFile: (file: FileType) => void;
}

export function FileExplorer({ projectId, activeFileId, onSelectFile }: FileExplorerProps) {
  const { data: files } = useFiles(projectId);
  const { mutate: createFile } = useCreateFile();
  const { mutate: deleteFile } = useDeleteFile();
  const [newFileName, setNewFileName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    createFile(
      { projectId, name: newFileName, content: "// Start coding here...", language: "javascript" },
      { onSuccess: () => { setIsDialogOpen(false); setNewFileName(""); } }
    );
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this file?")) {
      deleteFile({ id, projectId });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/40">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Explorer</h3>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {files?.map((file) => (
          <div
            key={file.id}
            onClick={() => onSelectFile(file)}
            className={cn(
              "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200",
              activeFileId === file.id
                ? "bg-white/70 text-gray-800 shadow-sm border border-white/80"
                : "text-gray-600 hover:bg-white/50"
            )}
            data-testid={`file-item-${file.id}`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{file.name}</span>
            </div>
            <button
              onClick={(e) => handleDelete(e, file.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 hover:text-red-500 transition-all"
              data-testid={`button-delete-file-${file.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {files?.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400">
            No files yet
          </div>
        )}
      </div>

      {/* New File Button */}
      <div className="p-3 border-t border-white/40">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button 
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-100/80 text-blue-600 hover:bg-blue-200/80 transition-all text-sm font-medium"
              data-testid="button-new-file"
            >
              <Plus className="w-4 h-4" />
              New file
            </button>
          </DialogTrigger>
          <DialogContent className="backdrop-blur-xl bg-white/90 border border-white/60 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800">Create New File</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateFile} className="space-y-4 mt-4">
              <input
                type="text"
                placeholder="filename.js"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all text-sm"
                autoFocus
                data-testid="input-new-filename"
              />
              <button 
                type="submit" 
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium hover:shadow-lg transition-all"
                data-testid="button-create-file"
              >
                Create File
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
