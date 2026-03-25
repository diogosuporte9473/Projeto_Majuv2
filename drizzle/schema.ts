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
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Boards table - Quadros de tarefas
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  ownerId: integer("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

export const boardMirrorSettings = pgTable("board_mirror_settings", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  mirrorLabels: boolean("mirror_labels").notNull().default(true),
  mirrorChecklists: boolean("mirror_checklists").notNull().default(true),
  mirrorComments: boolean("mirror_comments").notNull().default(false),
  mirrorAttachments: boolean("mirror_attachments").notNull().default(false),
  mirrorCustomFields: boolean("mirror_custom_fields").notNull().default(true),
  mirrorDates: boolean("mirror_dates").notNull().default(true),
  mirrorDescription: boolean("mirror_description").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Board Members - Controle de acesso por quadro
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull(),
  userId: integer("user_id").notNull(),
  role: memberRoleEnum("role").default("viewer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = typeof boardMembers.$inferInsert;

// Lists table - Listas dentro de um quadro
export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type List = typeof lists.$inferSelect;
export type InsertList = typeof lists.$inferInsert;

// Cards table - Cartões de tarefas
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by").notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

// Mirrored Cards - Espelhamento de cartões entre quadros
export const mirroredCards = pgTable("mirrored_cards", {
  id: serial("id").primaryKey(),
  originalCardId: integer("original_card_id").notNull(),
  mirrorCardId: integer("mirror_card_id").notNull(),
  originalBoardId: integer("original_board_id").notNull(),
  mirrorBoardId: integer("mirror_board_id").notNull(),
  syncStatus: syncStatusEnum("sync_status").default("synced").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MirroredCard = typeof mirroredCards.$inferSelect;
export type InsertMirroredCard = typeof mirroredCards.$inferInsert;

// Card Comments - Comentários nos cartões
export const cardComments = pgTable("card_comments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CardComment = typeof cardComments.$inferSelect;
export type InsertCardComment = typeof cardComments.$inferInsert;

// Card Attachments - Arquivos anexados aos cartões
export const cardAttachments = pgTable("card_attachments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: varchar("file_key", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CardAttachment = typeof cardAttachments.$inferSelect;
export type InsertCardAttachment = typeof cardAttachments.$inferInsert;

// Notifications - Sistema de notificações
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  relatedCardId: integer("related_card_id"),
  relatedBoardId: integer("related_board_id"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// User Preferences - Preferências de notificação por email
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  emailOnCardAssigned: boolean("email_on_card_assigned").default(true).notNull(),
  emailOnCardUpdated: boolean("email_on_card_updated").default(true).notNull(),
  emailOnMirroredCard: boolean("email_on_mirrored_card").default(true).notNull(),
  emailOnDueDate: boolean("email_on_due_date").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// Card Checklist Groups - Grupos de checklists para cartões
export const cardChecklistGroups = pgTable("card_checklist_groups", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CardChecklistGroup = typeof cardChecklistGroups.$inferSelect;
export type InsertCardChecklistGroup = typeof cardChecklistGroups.$inferInsert;

// Card Checklist - Checklist para cartões
export const cardChecklists = pgTable("card_checklists", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  groupId: integer("group_id"), // Novo campo para vincular ao grupo
  title: varchar("title", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  position: integer("position").notNull().default(0),
  dueDate: timestamp("due_date", { withTimezone: true }),
  assignedUserId: integer("assigned_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CardChecklist = typeof cardChecklists.$inferSelect;
export type InsertCardChecklist = typeof cardChecklists.$inferInsert;

// Card Custom Fields - Campos personalizados para cartões
export const cardCustomFields = pgTable("card_custom_fields", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  fieldName: varchar("field_name", { length: 255 }).notNull(),
  fieldValue: text("field_value"),
  fieldType: fieldTypeEnum("field_type").default("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cardFieldIdx: uniqueIndex("card_field_idx").on(table.cardId, table.fieldName),
}));

export type CardCustomField = typeof cardCustomFields.$inferSelect;
export type InsertCardCustomField = typeof cardCustomFields.$inferInsert;

// Card Labels - Etiquetas para cartões
export const cardLabels = pgTable("card_labels", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#4b4897").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CardLabel = typeof cardLabels.$inferSelect;
export type InsertCardLabel = typeof cardLabels.$inferInsert;

// Project Dates - Datas do projeto para cartões
export const projectDates = pgTable("project_dates", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().unique(),
  projectStartDate: timestamp("project_start_date", { withTimezone: true }),
  projectEndDate: timestamp("project_end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

// Checklist Templates - Modelos de checklists reutilizáveis
export const checklistTemplates = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  items: text("items").notNull(), // JSON string de array de strings
  isGlobal: boolean("is_global").default(false).notNull(),
  createdBy: integer("created_by"),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = typeof checklistTemplates.$inferInsert;
