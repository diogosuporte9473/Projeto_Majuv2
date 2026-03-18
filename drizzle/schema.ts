import { pgTable, serial, text, timestamp, varchar, pgEnum, integer, boolean, uniqueIndex, bigint } from "drizzle-orm/pg-core";

/**
 * Enums para PostgreSQL
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const memberRoleEnum = pgEnum("member_role", ["viewer", "editor", "admin"]);
export const syncStatusEnum = pgEnum("sync_status", ["synced", "pending", "failed"]);
export const notificationTypeEnum = pgEnum("notification_type", ["card_assigned", "card_updated", "card_mirrored", "due_date_alert", "comment_mention"]);
export const fieldTypeEnum = pgEnum("field_type", ["text", "select", "date", "number"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Boards table - Quadros de tarefas
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  ownerId: integer("ownerId").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

// Board Members - Controle de acesso por quadro
export const boardMembers = pgTable("boardMembers", {
  id: serial("id").primaryKey(),
  boardId: integer("boardId").notNull(),
  userId: integer("userId").notNull(),
  role: memberRoleEnum("role").default("viewer").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = typeof boardMembers.$inferInsert;

// Lists table - Listas dentro de um quadro
export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  boardId: integer("boardId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type List = typeof lists.$inferSelect;
export type InsertList = typeof lists.$inferInsert;

// Cards table - Cartões de tarefas
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  listId: integer("listId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  assignedTo: integer("assignedTo"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

// Mirrored Cards - Espelhamento de cartões entre quadros
export const mirroredCards = pgTable("mirroredCards", {
  id: serial("id").primaryKey(),
  originalCardId: integer("originalCardId").notNull(),
  mirrorCardId: integer("mirrorCardId").notNull(),
  originalBoardId: integer("originalBoardId").notNull(),
  mirrorBoardId: integer("mirrorBoardId").notNull(),
  syncStatus: syncStatusEnum("syncStatus").default("synced").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type MirroredCard = typeof mirroredCards.$inferSelect;
export type InsertMirroredCard = typeof mirroredCards.$inferInsert;

// Card Attachments - Arquivos anexados aos cartões
export const cardAttachments = pgTable("cardAttachments", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CardAttachment = typeof cardAttachments.$inferSelect;
export type InsertCardAttachment = typeof cardAttachments.$inferInsert;

// Notifications - Sistema de notificações
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  relatedCardId: integer("relatedCardId"),
  relatedBoardId: integer("relatedBoardId"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// User Preferences - Preferências de notificação por email
export const userPreferences = pgTable("userPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  emailOnCardAssigned: boolean("emailOnCardAssigned").default(true).notNull(),
  emailOnCardUpdated: boolean("emailOnCardUpdated").default(true).notNull(),
  emailOnMirroredCard: boolean("emailOnMirroredCard").default(true).notNull(),
  emailOnDueDate: boolean("emailOnDueDate").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// Card Labels - Etiquetas para cartões
export const cardLabels = pgTable("cardLabels", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CardLabel = typeof cardLabels.$inferSelect;
export type InsertCardLabel = typeof cardLabels.$inferInsert;

// Card Checklist - Checklist para cartões
export const cardChecklists = pgTable("cardChecklists", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CardChecklist = typeof cardChecklists.$inferSelect;
export type InsertCardChecklist = typeof cardChecklists.$inferInsert;

// Card Custom Fields - Campos personalizados para cartões
export const cardCustomFields = pgTable("cardCustomFields", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull(),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  fieldValue: text("fieldValue"),
  fieldType: fieldTypeEnum("fieldType").default("text").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CardCustomField = typeof cardCustomFields.$inferSelect;
export type InsertCardCustomField = typeof cardCustomFields.$inferInsert;

// Project Dates - Datas do projeto para cartões
export const projectDates = pgTable("projectDates", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull().unique(),
  projectStartDate: timestamp("projectStartDate", { withTimezone: true }),
  projectEndDate: timestamp("projectEndDate", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ProjectDate = typeof projectDates.$inferSelect;
export type InsertProjectDate = typeof projectDates.$inferInsert;

// Notes table - Notas simples (conforme SQL)
export const notes = pgTable("notes", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
