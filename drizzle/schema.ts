import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Boards table - Quadros de tarefas
export const boards = mysqlTable("boards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  ownerId: int("ownerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

// Board Members - Controle de acesso por quadro
export const boardMembers = mysqlTable("boardMembers", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["viewer", "editor", "admin"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = typeof boardMembers.$inferInsert;

// Lists table - Listas dentro de um quadro
export const lists = mysqlTable("lists", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  position: int("position").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type List = typeof lists.$inferSelect;
export type InsertList = typeof lists.$inferInsert;

// Cards table - Cartões de tarefas
export const cards = mysqlTable("cards", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  position: int("position").notNull().default(0),
  dueDate: timestamp("dueDate"),
  assignedTo: int("assignedTo"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

// Mirrored Cards - Espelhamento de cartões entre quadros
export const mirroredCards = mysqlTable("mirroredCards", {
  id: int("id").autoincrement().primaryKey(),
  originalCardId: int("originalCardId").notNull(),
  mirrorCardId: int("mirrorCardId").notNull(),
  originalBoardId: int("originalBoardId").notNull(),
  mirrorBoardId: int("mirrorBoardId").notNull(),
  syncStatus: mysqlEnum("syncStatus", ["synced", "pending", "failed"]).default("synced").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MirroredCard = typeof mirroredCards.$inferSelect;
export type InsertMirroredCard = typeof mirroredCards.$inferInsert;

// Card Attachments - Arquivos anexados aos cartões
export const cardAttachments = mysqlTable("cardAttachments", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CardAttachment = typeof cardAttachments.$inferSelect;
export type InsertCardAttachment = typeof cardAttachments.$inferInsert;

// Notifications - Sistema de notificações
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["card_assigned", "card_updated", "card_mirrored", "due_date_alert", "comment_mention"]).notNull(),
  cardId: int("cardId"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  read: int("read").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// User Preferences - Preferências de notificação por email
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  emailOnCardAssigned: int("emailOnCardAssigned").default(1).notNull(),
  emailOnCardUpdated: int("emailOnCardUpdated").default(1).notNull(),
  emailOnMirroredCard: int("emailOnMirroredCard").default(1).notNull(),
  emailOnDueDate: int("emailOnDueDate").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;
// Card Labels - Etiquetas para cartões
export const cardLabels = mysqlTable("cardLabels", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CardLabel = typeof cardLabels.$inferSelect;
export type InsertCardLabel = typeof cardLabels.$inferInsert;

// Card Checklist - Checklist para cartões
export const cardChecklists = mysqlTable("cardChecklists", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  completed: int("completed").default(0).notNull(),
  position: int("position").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CardChecklist = typeof cardChecklists.$inferSelect;
export type InsertCardChecklist = typeof cardChecklists.$inferInsert;

// Card Custom Fields - Campos personalizados para cartões
export const cardCustomFields = mysqlTable("cardCustomFields", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  fieldValue: text("fieldValue"),
  fieldType: mysqlEnum("fieldType", ["text", "select", "date", "number"]).default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CardCustomField = typeof cardCustomFields.$inferSelect;
export type InsertCardCustomField = typeof cardCustomFields.$inferInsert;

// Project Dates - Datas do projeto para cartões
export const projectDates = mysqlTable("projectDates", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull().unique(),
  projectStartDate: timestamp("projectStartDate"),
  projectEndDate: timestamp("projectEndDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectDate = typeof projectDates.$inferSelect;
export type InsertProjectDate = typeof projectDates.$inferInsert;
