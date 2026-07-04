-- CreateTable
CREATE TABLE "DishPairing" (
    "id" TEXT NOT NULL,
    "dishAId" TEXT NOT NULL,
    "dishBId" TEXT NOT NULL,

    CONSTRAINT "DishPairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DishPairing_dishAId_dishBId_key" ON "DishPairing"("dishAId", "dishBId");

-- CreateIndex
CREATE INDEX "DishPairing_dishBId_idx" ON "DishPairing"("dishBId");

-- AddForeignKey
ALTER TABLE "DishPairing" ADD CONSTRAINT "DishPairing_dishAId_fkey" FOREIGN KEY ("dishAId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishPairing" ADD CONSTRAINT "DishPairing_dishBId_fkey" FOREIGN KEY ("dishBId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
