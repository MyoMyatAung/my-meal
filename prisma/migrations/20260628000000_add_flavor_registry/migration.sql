-- CreateSchema
CREATE TABLE "Flavor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Flavor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flavor_name_userId_key" ON "Flavor"("name", "userId");

-- AddForeignKey
ALTER TABLE "Flavor" ADD CONSTRAINT "Flavor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedData: Insert distinct flavors from existing DishFlavor rows
INSERT INTO "Flavor" ("id", "name", "userId")
SELECT gen_random_uuid()::text, sub."flavor", sub."userId"
FROM (
    SELECT DISTINCT df."flavor", d."userId"
    FROM "DishFlavor" df
    INNER JOIN "Dish" d ON d.id = df."dishId"
) sub;

-- AlterTable: Add flavorId column to DishFlavor
ALTER TABLE "DishFlavor" ADD COLUMN "flavorId" TEXT;

-- BackfillData: Populate flavorId from Flavor table
UPDATE "DishFlavor" SET "flavorId" = (
    SELECT "id" FROM "Flavor" WHERE "Flavor"."name" = "DishFlavor"."flavor" LIMIT 1
);

-- AlterTable: Set flavorId to NOT NULL
ALTER TABLE "DishFlavor" ALTER COLUMN "flavorId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "DishFlavor" ADD CONSTRAINT "DishFlavor_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn: Remove old flavor text column
ALTER TABLE "DishFlavor" DROP COLUMN "flavor";

-- DropIndex: Remove old unique index
DROP INDEX "DishFlavor_dishId_flavor_key";

-- CreateIndex: New unique index on junction table
CREATE UNIQUE INDEX "DishFlavor_dishId_flavorId_key" ON "DishFlavor"("dishId", "flavorId");
