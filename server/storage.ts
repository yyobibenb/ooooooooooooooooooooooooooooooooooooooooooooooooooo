import { db } from "./db";
import {
  users,
  projects,
  files,
  conversations,
  messages,
  type InsertUser,
  type InsertProject,
  type InsertFile,
  type InsertConversation,
  type InsertMessage,
  type User,
  type Project,
  type File,
  type Conversation,
  type Message
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject & { userId: number }): Promise<Project>;
  updateProject(id: number, data: { name?: string; description?: string }): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  // File operations
  getFiles(projectId: number): Promise<File[]>;
  getFile(id: number): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: number, content: string): Promise<File>;
  deleteFile(id: number): Promise<void>;

  // Conversation operations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(data: { title: string; projectId?: number }): Promise<Conversation>;
  getOrCreateConversation(projectId: number): Promise<Conversation>;
  getConversationMessages(conversationId: number): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getProjects(userId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject & { userId: number }): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, data: { name?: string; description?: string }): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    // Delete messages for conversations linked to this project
    const projectConversations = await db.select().from(conversations).where(eq(conversations.projectId, id));
    for (const conv of projectConversations) {
      await db.delete(messages).where(eq(messages.conversationId, conv.id));
    }
    // Delete conversations linked to this project
    await db.delete(conversations).where(eq(conversations.projectId, id));
    // Delete files
    await db.delete(files).where(eq(files.projectId, id));
    // Delete project
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getFiles(projectId: number): Promise<File[]> {
    return await db.select().from(files).where(eq(files.projectId, projectId));
  }

  async getFile(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createFile(file: InsertFile): Promise<File> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  async updateFile(id: number, content: string): Promise<File> {
    const [updatedFile] = await db
      .update(files)
      .set({ content })
      .where(eq(files.id, id))
      .returning();
    return updatedFile;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async getConversations(): Promise<Conversation[]> {
    return await db.select().from(conversations);
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(data: { title: string; projectId?: number }): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations).values({
      title: data.title,
      projectId: data.projectId,
    }).returning();
    return newConversation;
  }

  async getOrCreateConversation(projectId: number): Promise<Conversation> {
    let [conversation] = await db.select().from(conversations).where(eq(conversations.projectId, projectId));
    if (!conversation) {
      [conversation] = await db.insert(conversations).values({ projectId }).returning();
    }
    return conversation;
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.conversationId, conversationId));
  }

  async addMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();
