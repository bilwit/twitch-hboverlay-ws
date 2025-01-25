/*
  Warnings:

  - Added the required column `trigger_words` to the `stages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "trigger_words" VARCHAR(255) NOT NULL;

-- CreateTable
CREATE TABLE "stages_on_redeems" (
    "stages_id" INTEGER NOT NULL,
    "redeems_id" INTEGER NOT NULL,

    CONSTRAINT "stages_on_redeems_pkey" PRIMARY KEY ("stages_id","redeems_id")
);

-- AddForeignKey
ALTER TABLE "stages_on_redeems" ADD CONSTRAINT "stages_on_redeems_redeems_id_fkey" FOREIGN KEY ("redeems_id") REFERENCES "redeems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages_on_redeems" ADD CONSTRAINT "stages_on_redeems_stages_id_fkey" FOREIGN KEY ("stages_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
