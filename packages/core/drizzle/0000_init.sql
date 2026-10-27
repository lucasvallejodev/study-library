CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text,
	"chapter_id" text,
	"type" text NOT NULL,
	"color" text,
	"selectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quote" text,
	"body" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"orphaned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(quote, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"document_id" text NOT NULL,
	"id" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"file" text NOT NULL,
	"matter" text DEFAULT 'body' NOT NULL,
	"depth" integer DEFAULT 1 NOT NULL,
	"content_hash" text NOT NULL,
	"word_count" integer NOT NULL,
	"plain_text" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(plain_text, '')), 'B')) STORED,
	CONSTRAINT "chapters_document_id_id_pk" PRIMARY KEY("document_id","id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"cover" text,
	"source_type" text NOT NULL,
	"source_url" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"input_type" text NOT NULL,
	"input" text NOT NULL,
	"original_name" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"log" text DEFAULT '' NOT NULL,
	"error" text,
	"document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"document_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"percent" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_document_id_chapter_id_pk" PRIMARY KEY("document_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"chapter_id" text,
	"kind" text DEFAULT 'study' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" real,
	"summary" text,
	"follow_ups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotations_chapter_idx" ON "annotations" USING btree ("document_id","chapter_id");--> statement-breakpoint
CREATE INDEX "annotations_created_idx" ON "annotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "annotations_search_idx" ON "annotations" USING gin ("search");--> statement-breakpoint
CREATE INDEX "chapters_search_idx" ON "chapters" USING gin ("search");--> statement-breakpoint
CREATE INDEX "documents_title_trgm" ON "documents" USING gin ("title" gin_trgm_ops);