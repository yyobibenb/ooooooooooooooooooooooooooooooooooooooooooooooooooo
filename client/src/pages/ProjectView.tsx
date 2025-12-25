import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProject, useUpdateFile } from "@/hooks/use-projects";
import { FileExplorer } from "@/components/IDE/FileExplorer";
import { ChatPanel } from "@/components/IDE/ChatPanel";
import Editor from "@monaco-editor/react";
import { 
  Loader2, ArrowLeft, Save, Code2, 
  MessageSquare, ChevronLeft, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { type File } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ProjectView() {
  const { id } = useParams();
  const projectId = parseInt(id || "0");
  const { user, isLoading: authLoading } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { mutate: updateFile } = useUpdateFile();
  const { toast } = useToast();

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  useEffect(() => {
    if (activeFile) {
      setFileContent(activeFile.content);
    }
  }, [activeFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, fileContent, isSaving, projectId, updateFile, toast]);

  if (authLoading || projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse" />
            <Loader2 className="w-8 h-8 animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-500 text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center p-8 backdrop-blur-md bg-white/30 rounded-xl">
          <p className="text-gray-500">Project not found</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!activeFile) return;
    setIsSaving(true);
    updateFile(
      { id: activeFile.id, projectId, content: fileContent },
      {
        onSuccess: (updated) => {
          setActiveFile(updated);
          setIsSaving(false);
          toast({ title: "Saved", description: `${updated.name} saved successfully.` });
        },
        onError: () => setIsSaving(false)
      }
    );
  };

  return (
    <div className="h-screen flex bg-gradient-to-b from-blue-50 via-slate-50 to-white overflow-hidden p-4 gap-4">
      
      {/* Left Sidebar - Chat */}
      <aside className={cn(
        "backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all duration-300",
        chatExpanded ? "w-[500px]" : "w-80"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-white/40">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              data-testid="link-back"
            >
              <ArrowLeft className="w-4 h-4" />
              {project.name}
            </Link>
            <span className="text-xs text-gray-400 px-2 py-1 bg-white/50 rounded-lg">Private</span>
          </div>
        </div>
        
        {/* AI Assistant Section */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">AI Assistant</h3>
              <p className="text-xs text-gray-500">Powered by Claude</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ChatPanel 
              projectId={projectId}
              currentFile={activeFile} 
              projectFiles={project?.files || []} 
              onExpand={setChatExpanded}
              isExpanded={chatExpanded}
            />
          </div>
        </div>
      </aside>

      {/* Center - Code Editor */}
      <main className="flex-1 backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
        {/* Editor Header */}
        <div className="px-4 py-3 border-b border-white/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="text-sm text-gray-600 font-medium">IDE Project</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-400" data-testid="button-help">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path strokeLinecap="round" strokeWidth="1.5" d="M12 8v4m0 4h.01" />
              </svg>
            </button>
            <button className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-400" data-testid="button-info">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path strokeLinecap="round" strokeWidth="1.5" d="M12 16v-4m0-4h.01" />
              </svg>
            </button>
            <button className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-400" data-testid="button-mail">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="1.5" />
                <path strokeLinecap="round" strokeWidth="1.5" d="M22 6l-10 7L2 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Editor Toolbar */}
        <div className="px-4 py-2 border-b border-white/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-gray-400">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-gray-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={handleSave}
            disabled={!activeFile || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 border border-white/80 text-gray-600 hover:bg-white/80 transition-all text-sm font-medium disabled:opacity-50 shadow-sm"
            data-testid="button-save-file"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {/* Monaco Editor Area */}
        <div className="flex-1 overflow-hidden bg-gradient-to-b from-white/20 to-white/40">
          {activeFile ? (
            <Editor
              height="100%"
              defaultLanguage={activeFile.language || "javascript"}
              path={activeFile.name}
              value={fileContent}
              onChange={(value) => setFileContent(value || "")}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16, bottom: 16 },
                fontFamily: "'JetBrains Mono', monospace",
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "all",
                bracketPairColorization: { enabled: true },
                automaticLayout: true
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
              <div className="text-6xl text-blue-300/50">
                <Code2 className="w-16 h-16" />
              </div>
              <p className="text-lg font-medium text-gray-500">Select a file to start coding</p>
              <p className="text-sm text-gray-400">Choose a file from the explorer or create a new one.</p>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar - File Explorer */}
      <aside className="w-56 backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
        <FileExplorer 
          projectId={projectId} 
          activeFileId={activeFile?.id ?? null} 
          onSelectFile={setActiveFile}
        />
      </aside>
    </div>
  );
}
