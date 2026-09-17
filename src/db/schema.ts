import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const promptDocuments = pgTable(
  "prompt_documents",
  {
    id: serial("id").primaryKey(),
    sourcePath: text("source_path").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("prompt_documents_source_path_idx").on(table.sourcePath)],
);

export const trainingSamples = pgTable("training_samples", {
  id: serial("id").primaryKey(),
  sourcePath: text("source_path").notNull(),
  sampleText: text("sample_text").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const neuralModels = pgTable("neural_models", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").notNull().default("coding-agent-v3"),
  modelType: text("model_type").notNull().default("ml-knn"),
  labels: jsonb("labels").$type<string[]>().notNull(),
  vocabulary: jsonb("vocabulary").$type<Record<string, number>>().notNull(),
  modelJson: jsonb("model_json").$type<Record<string, unknown> | null>(),
  w1: jsonb("w1").$type<number[][] | null>(),
  b1: jsonb("b1").$type<number[] | null>(),
  w2: jsonb("w2").$type<number[][] | null>(),
  b2: jsonb("b2").$type<number[] | null>(),
  trainingLoss: text("training_loss").notNull().default("0"),
  trainingAccuracy: real("training_accuracy").notNull().default(0),
  validationAccuracy: real("validation_accuracy").notNull().default(0),
  epochs: integer("epochs").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  answer: text("answer").notNull(),
  predictedLabel: text("predicted_label").notNull(),
  confidence: real("confidence").notNull().default(0),
  topScores: jsonb("top_scores").$type<Array<{ label: string; score: number }>>().notNull(),
  references: jsonb("references")
    .$type<Array<{ sourcePath: string; sample: string }>>()
    .notNull(),
  channel: text("channel").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telegramUsers = pgTable(
  "telegram_users",
  {
    id: serial("id").primaryKey(),
    telegramId: text("telegram_id").notNull(),
    chatId: text("chat_id"),
    username: text("username"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    languageCode: text("language_code"),
    isBot: boolean("is_bot").notNull().default(false),
    isPremium: boolean("is_premium").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("telegram_users_telegram_id_idx").on(table.telegramId)],
);

export const telegramMessages = pgTable("telegram_messages", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsers.id),
  chatId: text("chat_id").notNull(),
  direction: text("direction").notNull(),
  text: text("text").notNull(),
  rawUpdate: jsonb("raw_update").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
