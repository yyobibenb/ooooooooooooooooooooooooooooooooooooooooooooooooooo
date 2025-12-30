import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { type File as FileType } from "@shared/schema";
import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  file: FileType | null;
  onChange: (value: string | undefined) => void;
}

export function CodeEditor({ file, onChange }: CodeEditorProps) {
  // We can use next-themes or just assume dark for this custom aesthetic
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Define a custom theme matching our CSS variables
    monaco.editor.defineTheme('replit-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f1117', // var(--background) rough hex
        'editor.foreground': '#f8fafc',
        'editor.lineHighlightBackground': '#1e293b',
        'editorLineNumber.foreground': '#475569',
        'editorIndentGuide.background': '#334155',
      }
    });
    
    monaco.editor.setTheme('replit-dark');
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-[#0f1117]">
        <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin opacity-20" />
        </div>
        <p>Select a file to start editing</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-[#0f1117]">
      <Editor
        height="100%"
        path={file.name} // Helps monaco infer language
        defaultLanguage={file.language}
        language={file.language}
        value={file.content}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="replit-dark" // Will fall back to vs-dark until mounted
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 24,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
        }}
      />
    </div>
  );
}
