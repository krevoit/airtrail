-- Disputed territories use GISCO codes, some of which are three characters long.
ALTER TABLE "visited_country" ALTER COLUMN "code" SET DATA TYPE VARCHAR(3);
