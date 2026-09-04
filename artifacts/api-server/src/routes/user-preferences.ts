import { Router, type IRouter } from "express";
import { db, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/user-preferences", async (_req, res) => {
  const rows = await db.select().from(userPreferencesTable);
  res.json(rows);
});

router.put("/user-preferences", async (req, res) => {
  const { key, value } = req.body;

  if (!key || typeof key !== "string" || key.trim() === "") {
    res.status(400).json({ error: "key is required" });
    return;
  }
  if (value === undefined || typeof value !== "string") {
    res.status(400).json({ error: "value must be a string" });
    return;
  }

  const [row] = await db
    .insert(userPreferencesTable)
    .values({ key: key.trim(), value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferencesTable.key,
      set: { value, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

export default router;
