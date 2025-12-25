import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";

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
      });
      req.session.userId = user.id;
      res.status(201).json({ id: user.id, email: user.email });
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
    res.json({ id: user.id, email: user.email });
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
      const project = await storage.createProject({ ...input, userId: req.userId! });
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
