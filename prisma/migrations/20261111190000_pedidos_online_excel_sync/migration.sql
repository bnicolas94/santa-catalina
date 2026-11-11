CREATE TABLE "pedidos_online_excel_sync" (
    "id" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "source_hash" TEXT NOT NULL,
    "source_status" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "payload" JSONB,
    "operation" TEXT,
    "state" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "applied_version" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_online_excel_sync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pedidos_online_excel_sync_spreadsheet_id_external_id_key"
    ON "pedidos_online_excel_sync"("spreadsheet_id", "external_id");
CREATE INDEX "pedidos_online_excel_sync_state_updatedAt_idx"
    ON "pedidos_online_excel_sync"("state", "updatedAt");
