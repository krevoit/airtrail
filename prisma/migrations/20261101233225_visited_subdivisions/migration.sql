-- CreateTable
CREATE TABLE "visited_subdivision" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "visited_subdivision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visited_subdivision_user_id_country_idx" ON "visited_subdivision"("user_id", "country");

-- CreateIndex
CREATE UNIQUE INDEX "visited_subdivision_code_user_id_key" ON "visited_subdivision"("code", "user_id");

-- AddForeignKey
ALTER TABLE "visited_subdivision" ADD CONSTRAINT "visited_subdivision_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
