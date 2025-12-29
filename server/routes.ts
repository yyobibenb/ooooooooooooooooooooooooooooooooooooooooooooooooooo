import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import * as fs from "fs/promises";
import * as path from "path";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import archiver from "archiver";
import { startProject, stopProject, isProjectRunning, getProjectPort } from "./project-runner";

const WORKSPACE_ROOT = path.join(process.cwd(), "workspace");
const BLOCKED_PATHS = ["node_modules", ".git"];

function getLanguageFromExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json', '.css': 'css', '.html': 'html', '.md': 'markdown', '.txt': 'text',
    '.py': 'python', '.sql': 'sql', '.sh': 'shell'
  };
  return langMap[ext] || 'text';
}

// Session middleware
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.userId = req.session.userId;
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup session middleware
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const PgSession = pgSession(session);

  app.use(
    session({
      store: new PgSession({ pool }),
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  app.set("trust proxy", 1);

  // Auth routes
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({
        email: input.email,
        password: hashedPassword,
        name: input.name,
      });
      req.session.userId = user.id;
      res.status(201).json({ id: user.id, email: user.email, name: user.name });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const isValid = await bcrypt.compare(input.password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json({ id: user.id, email: user.email });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get(api.auth.user.path, isAuthenticated, async (req, res) => {
    const user = await storage.getUserById(req.userId!);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  // Projects
  app.get(api.projects.list.path, isAuthenticated, async (req, res) => {
    const projects = await storage.getProjects(req.userId!);
    res.json(projects);
  });

  app.post(api.projects.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      
      // Use AI to generate a short project name from the description
      let projectName = input.name || "New Project";
      if (input.description && process.env.ANTHROPIC_API_KEY) {
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20241022",
            max_tokens: 20,
            messages: [{
              role: "user",
              content: `Generate a single short word (1-2 words max) that describes this project idea. Just reply with the word, nothing else: "${input.description}"`
            }]
          });
          const aiName = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
          if (aiName && aiName.length < 30) {
            projectName = aiName;
          }
        } catch (e) {
          // If AI fails, use description as fallback
          projectName = input.description.slice(0, 30) || "New Project";
        }
      }
      
      const project = await storage.createProject({ 
        name: projectName, 
        description: input.description,
        userId: req.userId! 
      });
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get(api.projects.get.path, isAuthenticated, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const { name, description } = req.body;
      const project = await storage.updateProject(Number(req.params.id), { name, description });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (err) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete(api.projects.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteProject(Number(req.params.id));
    res.status(204).send();
  });

  // Files
  app.get(api.files.list.path, isAuthenticated, async (req, res) => {
    const files = await storage.getFiles(Number(req.params.projectId));
    res.json(files);
  });

  app.post(api.files.create.path, isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const input = api.files.create.input.parse(req.body);
      const file = await storage.createFile({ ...input, projectId });
      res.status(201).json(file);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Failed to create file" });
    }
  });

  app.put(api.files.update.path, isAuthenticated, async (req, res) => {
    try {
      const { content } = req.body;
      const file = await storage.updateFile(Number(req.params.id), content);
      res.json(file);
    } catch (err) {
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  app.delete(api.files.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteFile(Number(req.params.id));
    res.status(204).send();
  });

  // Filesystem-based file operations (per-project)
  const getProjectWorkspace = (projectId: number) => path.join(WORKSPACE_ROOT, `project_${projectId}`);

  app.get("/api/fs/:projectId/files", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      await fs.mkdir(projectRoot, { recursive: true });
      
      const files: { id: string; name: string; path: string; language: string; isDirectory: boolean }[] = [];
      
      const walk = async (dir: string, prefix: string = "") => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (BLOCKED_PATHS.some(b => entry.name.includes(b))) continue;
          
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            files.push({
              id: relativePath,
              name: entry.name,
              path: relativePath,
              language: "folder",
              isDirectory: true
            });
            await walk(fullPath, relativePath);
          } else {
            files.push({
              id: relativePath,
              name: entry.name,
              path: relativePath,
              language: getLanguageFromExt(entry.name),
              isDirectory: false
            });
          }
        }
      };
      
      await walk(projectRoot);
      res.json(files);
    } catch (err) {
      console.error("List files error:", err);
      res.json([]);
    }
  });

  app.get("/api/fs/:projectId/file", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(projectRoot, filePath);
      if (!fullPath.startsWith(projectRoot)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const content = await fs.readFile(fullPath, "utf-8");
      res.json({ 
        id: filePath,
        name: path.basename(filePath),
        path: filePath,
        content,
        language: getLanguageFromExt(filePath)
      });
    } catch (err) {
      res.status(404).json({ message: "File not found" });
    }
  });

  app.post("/api/fs/:projectId/file", isAuthenticated, express.json(), async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const { path: filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(projectRoot, filePath);
      if (!fullPath.startsWith(projectRoot)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content || "", "utf-8");
      
      res.json({ 
        id: filePath,
        name: path.basename(filePath),
        path: filePath,
        content: content || "",
        language: getLanguageFromExt(filePath)
      });
    } catch (err) {
      console.error("Write file error:", err);
      res.status(500).json({ message: "Failed to write file" });
    }
  });

  app.put("/api/fs/:projectId/file", isAuthenticated, express.json(), async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const { path: filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(projectRoot, filePath);
      if (!fullPath.startsWith(projectRoot)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await fs.writeFile(fullPath, content, "utf-8");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  app.delete("/api/fs/:projectId/file", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(projectRoot, filePath);
      if (!fullPath.startsWith(projectRoot)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await fs.unlink(fullPath);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Download single file
  app.get("/api/fs/:projectId/download", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(projectRoot, filePath);
      if (!fullPath.startsWith(projectRoot)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const content = await fs.readFile(fullPath);
      const filename = path.basename(filePath);
      
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(content);
    } catch (err) {
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Download entire project as ZIP
  app.get("/api/fs/:projectId/download-zip", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectRoot = getProjectWorkspace(projectId);
      const project = await storage.getProject(projectId);
      const projectName = project?.name || `project-${projectId}`;
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${projectName}.zip"`);
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to create ZIP" });
        } else {
          res.end();
        }
      });
      
      archive.pipe(res);
      
      const addFilesToArchive = async (dir: string, archivePath: string = "") => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (BLOCKED_PATHS.includes(entry.name)) continue;
            
            const fullPath = path.join(dir, entry.name);
            const entryArchivePath = archivePath ? `${archivePath}/${entry.name}` : entry.name;
            
            if (entry.isDirectory()) {
              await addFilesToArchive(fullPath, entryArchivePath);
            } else {
              archive.file(fullPath, { name: entryArchivePath });
            }
          }
        } catch (err) {
          console.error("Error reading directory:", err);
        }
      };
      
      await addFilesToArchive(projectRoot);
      await archive.finalize();
    } catch (err) {
      console.error("ZIP error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to create ZIP" });
      }
    }
  });

  // Upload file (for drag & drop)
  app.post("/api/fs/upload", isAuthenticated, express.raw({ limit: "10mb", type: "*/*" }), async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path required" });
      
      const fullPath = path.join(WORKSPACE_ROOT, filePath);
      if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, req.body);
      
      res.json({ 
        id: filePath,
        name: path.basename(filePath),
        path: filePath,
        language: getLanguageFromExt(filePath)
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Project runner endpoints
  app.get("/api/projects/:projectId/run", isAuthenticated, async (req, res) => {
    const projectId = Number(req.params.projectId);
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    const result = await startProject(
      projectId,
      (data) => res.write(`data: ${JSON.stringify({ type: "stdout", data })}\n\n`),
      (data) => res.write(`data: ${JSON.stringify({ type: "stderr", data })}\n\n`),
      (code) => {
        res.write(`data: ${JSON.stringify({ type: "exit", code })}\n\n`);
        res.end();
      }
    );
    
    if (!result.success) {
      res.write(`data: ${JSON.stringify({ type: "error", message: result.message })}\n\n`);
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify({ type: "started", port: result.port, message: result.message })}\n\n`);
    
    req.on("close", () => {
      stopProject(projectId);
    });
  });
  
  app.post("/api/projects/:projectId/stop", isAuthenticated, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const result = stopProject(projectId);
    res.json(result);
  });
  
  app.get("/api/projects/:projectId/status", isAuthenticated, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const running = isProjectRunning(projectId);
    const port = getProjectPort(projectId);
    res.json({ running, port });
  });

  // Conversations
  app.get(api.conversations.list.path, isAuthenticated, async (req, res) => {
    const conversations = await storage.getConversations();
    res.json(conversations);
  });

  app.post(api.conversations.create.path, isAuthenticated, async (req, res) => {
    try {
      const { title, projectId } = req.body;
      const conversation = await storage.createConversation({
        title: title || "New Chat",
        projectId: projectId ? Number(projectId) : undefined,
      });
      res.json(conversation);
    } catch (err) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get or create conversation for a project
  app.get("/api/projects/:projectId/conversation", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const conversation = await storage.getOrCreateConversation(projectId);
      const messages = await storage.getConversationMessages(conversation.id);
      res.json({ ...conversation, messages });
    } catch (err) {
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  app.get(api.conversations.get.path, isAuthenticated, async (req, res) => {
    const conversation = await storage.getConversation(Number(req.params.id));
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const messages = await storage.getConversationMessages(conversation.id);
    res.json({ ...conversation, messages });
  });

  // Chat
  app.get(api.chat.list.path, isAuthenticated, async (req, res) => {
    const messages = await storage.getConversationMessages(Number(req.params.conversationId));
    res.json(messages);
  });

  app.post(api.chat.send.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.chat.send.input.parse(req.body);
      const conversationId = Number(req.params.conversationId);
      
      // Get conversation to find projectId
      const conversation = await storage.getConversation(conversationId);
      const projectId = conversation?.projectId;
      
      // Save user message
      await storage.addMessage({
        conversationId,
        role: "user",
        content: input.content,
      });

      // Get conversation history
      const messages = await storage.getConversationMessages(conversationId);
      
      // Set up SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // Import AI service dynamically to handle missing API key gracefully
      const { streamChatResponse } = await import("./ai/chat-service");
      
      // Convert messages to chat format
      const chatMessages = messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

      // Extract project context from the last message if it contains code blocks
      const projectContext: { currentFile?: { name: string; language: string; content: string } } = {};
      const lastUserMsg = input.content;
      const contextMatch = lastUserMsg.match(/\[Context: Current file '([^']+)'\]\n```(\w+)\n([\s\S]*?)```/);
      if (contextMatch) {
        projectContext.currentFile = {
          name: contextMatch[1],
          language: contextMatch[2],
          content: contextMatch[3]
        };
      }

      // Stream response from Claude (with model override from user)
      const fullResponse = await streamChatResponse(chatMessages, res, {
        taskType: "chat",
        projectContext,
        conversationId,
        projectId: projectId ?? undefined,
        modelOverride: input.modelOverride as "auto" | "haiku" | "sonnet" | "opus",
      });

      // Save assistant message to database
      await storage.addMessage({
        conversationId,
        role: "assistant",
        content: fullResponse,
      });

      res.end();
    } catch (err) {
      console.error("Chat error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to send message" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
        res.end();
      }
    }
  });

  // Agent routes
  app.post(api.agent.run.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.agent.run.input.parse(req.body);
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const { runAgentLoop } = await import("./ai/agent-orchestrator");
      
      await runAgentLoop(input.prompt, res, {
        maxIterations: 5,
        projectContext: input.projectContext,
      });

      res.end();
    } catch (err) {
      console.error("Agent error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to run agent" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Agent failed" })}\n\n`);
        res.end();
      }
    }
  });

  app.post(api.agent.plan.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.agent.plan.input.parse(req.body);
      const { planTask } = await import("./ai/agent-orchestrator");
      
      const plan = await planTask(input.prompt, {
        fileTree: input.fileTree,
      });
      
      res.json(plan);
    } catch (err) {
      console.error("Plan error:", err);
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  return httpServer;
}
