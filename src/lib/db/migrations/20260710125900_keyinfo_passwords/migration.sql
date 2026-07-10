-- Hand-written instead of Prisma's generated DROP+ADD so existing KeyInfo
-- rows keep their data through the value -> password rename.
ALTER TABLE "KeyInfo" RENAME COLUMN "value" TO "password";
ALTER TABLE "KeyInfo" ADD COLUMN "username" TEXT;
