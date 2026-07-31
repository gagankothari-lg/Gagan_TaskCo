-- CreateTable
CREATE TABLE "id_counters" (
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "id_counters_pkey" PRIMARY KEY ("prefix")
);

