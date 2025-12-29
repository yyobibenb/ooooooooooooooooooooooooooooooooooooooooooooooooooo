import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-projects";
import { FileExplorer } from "@/components/IDE/FileExplorer";
import { ChatPanel } from "@/components/IDE/ChatPanel";
import Editor from "@monaco-editor/react";
import { 
  Loader2, ArrowLeft, Save, Code2, 
  Globe, Terminal, Play, Pencil, Check, X, Square
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface FSFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content?: string;
}

export default function ProjectView() {
  const { id } = useParams();
  const projectId = parseInt(id || "0");
  const { user, isLoading: authLoading } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { toast } = useToast();

  const [activeFile, setActiveFile] = useState<FSFile | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "preview" | "console">("code");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (activeFile && activeFile.content !== undefined) {
      setFileContent(activeFile.content);
    }
  }, [activeFile]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput]);

  const handleSave = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    
    try {
      const res = await fetch(`/api/fs/${projectId}/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFile.path, content: fileContent }),
        credentials: "include",
      });
      
      if (res.ok) {
        setActiveFile({ ...activeFile, content: fileContent });
        toast({ title: "Saved", description: `${activeFile.name} saved.` });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to save file", variant: "destructive" });
    }
    setIsSaving(false);
  };

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
  }, [activeFile, fileContent, isSaving]);

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

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descInput }),
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        toast({ title: "Saved", description: "Description updated." });
        setIsEditingDesc(false);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update description", variant: "destructive" });
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        toast({ title: "Saved", description: "Name updated." });
        setIsEditingName(false);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update name", variant: "destructive" });
    }
  };

  const handleRun = async () => {
    if (isRunning) {
      try {
        await fetch(`/api/projects/${projectId}/stop`, { method: "POST", credentials: "include" });
        setIsRunning(false);
        setConsoleOutput(prev => [...prev, "\n[DevAssist] Project stopped."]);
        eventSourceRef.current?.close();
      } catch (err) {
        toast({ title: "Error", description: "Failed to stop project", variant: "destructive" });
      }
      return;
    }

    setConsoleOutput([]);
    setActiveTab("console");
    setIsRunning(true);

    const eventSource = new EventSource(`/api/projects/${projectId}/run`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stdout" || data.type === "stderr") {
          setConsoleOutput(prev => [...prev, data.data]);
        } else if (data.type === "started") {
          setPreviewPort(data.port);
        } else if (data.type === "exit") {
          setIsRunning(false);
          setConsoleOutput(prev => [...prev, `\n[DevAssist] Process exited with code ${data.code}`]);
          eventSource.close();
        } else if (data.type === "error") {
          setConsoleOutput(prev => [...prev, `[Error] ${data.message}`]);
          setIsRunning(false);
          eventSource.close();
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    };

    eventSource.onerror = () => {
      setIsRunning(false);
      eventSource.close();
    };
  };

  return (
    <div className="h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-white overflow-hidden p-4">
      <ResizablePanelGroup direction="horizontal" className="h-full gap-2">
        {/* Left Panel - Chat */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={50}>
          <aside className="h-full backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Link 
                    href="/" 
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    data-testid="link-back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                  {isEditingName ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="flex-1 text-sm px-2 py-1 rounded border border-gray-200 bg-white/50 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        placeholder="Project name..."
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                        data-testid="input-project-name"
                      />
                      <button onClick={handleSaveName} className="p-1 rounded hover:bg-green-100 text-green-600" data-testid="button-save-name">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsEditingName(false)} className="p-1 rounded hover:bg-red-100 text-red-500" data-testid="button-cancel-name">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span 
                      className="text-sm text-gray-700 truncate cursor-pointer hover:text-gray-900 group flex items-center gap-1"
                      onClick={() => { setNameInput(project.name); setIsEditingName(true); }}
                      data-testid="text-project-name"
                    >
                      {project.name}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </span>
                  )}
                </div>
              </div>
              {/* Description */}
              {isEditingDesc ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 bg-white/50 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="Project description..."
                    autoFocus
                    data-testid="input-description"
                  />
                  <button
                    onClick={handleSaveDescription}
                    className="p-1 rounded hover:bg-green-100 text-green-600"
                    data-testid="button-save-description"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="p-1 rounded hover:bg-red-100 text-red-500"
                    data-testid="button-cancel-description"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer hover:text-gray-600 group"
                  onClick={() => {
                    setDescInput(project.description || "");
                    setIsEditingDesc(true);
                  }}
                  data-testid="text-description"
                >
                  <span className="truncate">{project.description || "Add description..."}</span>
                  <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
            
            {/* Chat Section */}
            <div className="p-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden">
                <ChatPanel 
                  projectId={projectId}
                  currentFile={activeFile}
                />
              </div>
            </div>
          </aside>
        </ResizablePanel>

        <ResizableHandle className="mx-1 w-1 rounded-full bg-gray-200/50 hover:bg-blue-300 transition-colors" />

        {/* Center Panel - Code Editor */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <main className="h-full backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
        {/* Editor Header with Tabs */}
        <div className="px-4 py-3 border-b border-white/30 flex items-center justify-between backdrop-blur-sm">
          {/* Liquid Glass Tabs */}
          <div className="flex items-center p-1.5 backdrop-blur-xl bg-white/20 rounded-2xl border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] gap-1">
            <button
              onClick={() => setActiveTab("code")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                activeTab === "code" 
                  ? "bg-white/80 backdrop-blur-sm text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/60" 
                  : "text-gray-500 hover:bg-white/30 hover:text-gray-700"
              )}
              data-testid="tab-code"
            >
              <Code2 className="w-4 h-4" />
              Code
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                activeTab === "preview" 
                  ? "bg-white/80 backdrop-blur-sm text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/60" 
                  : "text-gray-500 hover:bg-white/30 hover:text-gray-700"
              )}
              data-testid="tab-preview"
            >
              <Globe className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab("console")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                activeTab === "console" 
                  ? "bg-white/80 backdrop-blur-sm text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/60" 
                  : "text-gray-500 hover:bg-white/30 hover:text-gray-700"
              )}
              data-testid="tab-console"
            >
              <Terminal className="w-4 h-4" />
              Console
            </button>
          </div>
          
          <button
            onClick={handleRun}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl backdrop-blur-sm text-white font-medium text-sm border border-white/30 shadow-[0_4px_16px_rgba(34,197,94,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
              isRunning 
                ? "bg-gradient-to-r from-red-500/90 to-orange-500/90" 
                : "bg-gradient-to-r from-green-500/90 to-emerald-400/90"
            )}
            data-testid="button-run"
          >
            {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Stop" : "Run"}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-gradient-to-b from-white/20 to-white/40">
          {activeTab === "code" && (
            <>
              {/* Code Toolbar */}
              {activeFile && (
                <div className="px-4 py-2 border-b border-white/30 flex items-center justify-between bg-white/20">
                  <span className="text-sm text-gray-600 font-medium">{activeFile.name}</span>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 border border-white/80 text-gray-600 hover:bg-white/80 transition-all text-sm disabled:opacity-50"
                    data-testid="button-save-file"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              )}
              {/* Monaco Editor */}
              <div className="h-full">
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
                    <Code2 className="w-16 h-16 text-blue-300/50" />
                    <p className="text-lg font-medium text-gray-500">Select a file to start coding</p>
                    <p className="text-sm text-gray-400">Choose a file from the explorer or create a new one.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "preview" && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b border-white/30 flex items-center gap-2 bg-white/20">
                <input 
                  type="text" 
                  value={previewPort ? `http://localhost:${previewPort}` : "Not running"} 
                  readOnly
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/60 border border-white/80 text-sm text-gray-600"
                />
                <button 
                  onClick={() => previewPort && window.open(`http://localhost:${previewPort}`, "_blank")}
                  disabled={!previewPort}
                  className="p-1.5 rounded-lg bg-white/60 hover:bg-white/80 transition-colors text-gray-500 disabled:opacity-50"
                >
                  <Globe className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white">
                {previewPort && isRunning ? (
                  <iframe 
                    src={`http://localhost:${previewPort}`}
                    className="w-full h-full border-0"
                    title="Preview"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                    <Globe className="w-16 h-16 text-blue-300/50" />
                    <p className="text-lg font-medium text-gray-500">No preview available</p>
                    <p className="text-sm text-gray-400">Click Run to start your project</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "console" && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b border-white/30 flex items-center justify-between bg-white/20">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">Console Output</span>
                  {isRunning && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Running
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setConsoleOutput([])}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <div 
                ref={consoleRef}
                className="flex-1 p-4 font-mono text-sm bg-gray-900 text-gray-100 overflow-auto"
              >
                {consoleOutput.length === 0 ? (
                  <div className="text-gray-500">Click Run to start your project...</div>
                ) : (
                  consoleOutput.map((line, idx) => (
                    <pre key={idx} className="whitespace-pre-wrap break-all">{line}</pre>
                  ))
                )}
              </div>
            </div>
          )}
            </div>
          </main>
        </ResizablePanel>

        <ResizableHandle className="mx-1 w-1 rounded-full bg-gray-200/50 hover:bg-blue-300 transition-colors" />

        {/* Right Panel - File Explorer */}
        <ResizablePanel defaultSize={20} minSize={10} maxSize={35}>
          <aside className="h-full backdrop-blur-md bg-white/40 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
            <FileExplorer 
              projectId={projectId} 
              activeFileId={activeFile?.id ?? null} 
              onSelectFile={setActiveFile}
            />
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
