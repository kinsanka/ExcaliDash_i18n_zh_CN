import express from "express";
import { canEditDrawing, canViewDrawing, getDrawingAccess } from "../../authz/sharing";
import type { DrawingRouteContext } from "./drawingRouteContext";

export const registerDrawingHistoryRoutes = (
  app: express.Express,
  context: DrawingRouteContext,
) => {
  const {
    prisma,
    optionalAuth,
    asyncHandler,
    parseJsonField,
    invalidateDrawingsCache,
    getRequestPrincipal,
    respondWithAuthErrorIfPresent,
  } = context;
  // ============================================================
  // Drawing Version History
  // ============================================================

  // List snapshots (metadata only)
  app.get(
    "/drawings/:id/history",
    optionalAuth,
    asyncHandler(async (req, res) => {
      const principal = await getRequestPrincipal(req);
      const { id } = req.params;
      const access = await getDrawingAccess({
        prisma,
        principal,
        drawingId: id,
      });
      if (!canViewDrawing(access)) {
        if (respondWithAuthErrorIfPresent(req, res)) return;
        return res.status(404).json({ error: "Drawing not found" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const [snapshots, totalCount] = await Promise.all([
        prisma.drawingSnapshot.findMany({
          where: { drawingId: id },
          select: { id: true, version: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.drawingSnapshot.count({ where: { drawingId: id } }),
      ]);

      return res.json({ snapshots, totalCount });
    }),
  );

  // Get full snapshot for preview
  app.get(
    "/drawings/:id/history/:snapshotId",
    optionalAuth,
    asyncHandler(async (req, res) => {
      const principal = await getRequestPrincipal(req);
      const { id, snapshotId } = req.params;
      const access = await getDrawingAccess({
        prisma,
        principal,
        drawingId: id,
      });
      if (!canViewDrawing(access)) {
        if (respondWithAuthErrorIfPresent(req, res)) return;
        return res.status(404).json({ error: "Drawing not found" });
      }

      const snapshot = await prisma.drawingSnapshot.findFirst({
        where: { id: snapshotId, drawingId: id },
      });
      if (!snapshot)
        return res.status(404).json({ error: "Snapshot not found" });

      return res.json({
        ...snapshot,
        elements: parseJsonField(snapshot.elements, []),
        appState: parseJsonField(snapshot.appState, {}),
        files: parseJsonField(snapshot.files, {}),
      });
    }),
  );

  // Restore a snapshot (snapshots current state first, then applies old state)
  app.post(
    "/drawings/:id/history/:snapshotId/restore",
    optionalAuth,
    asyncHandler(async (req, res) => {
      const principal = await getRequestPrincipal(req);
      const { id, snapshotId } = req.params;
      const access = await getDrawingAccess({
        prisma,
        principal,
        drawingId: id,
      });
      if (!canEditDrawing(access)) {
        if (respondWithAuthErrorIfPresent(req, res)) return;
        return res.status(404).json({ error: "Drawing not found" });
      }

      const [drawing, snapshot] = await Promise.all([
        prisma.drawing.findUnique({ where: { id } }),
        prisma.drawingSnapshot.findFirst({
          where: { id: snapshotId, drawingId: id },
        }),
      ]);
      if (!drawing) return res.status(404).json({ error: "Drawing not found" });
      if (!snapshot)
        return res.status(404).json({ error: "Snapshot not found" });

      // Snapshot current state before restoring (so restore is reversible)
      await prisma.drawingSnapshot.create({
        data: {
          drawingId: id,
          version: drawing.version,
          elements: drawing.elements,
          appState: drawing.appState,
          files: drawing.files,
        },
      });

      // Apply snapshot
      const updated = await prisma.drawing.update({
        where: { id },
        data: {
          elements: snapshot.elements,
          appState: snapshot.appState,
          files: snapshot.files,
          version: { increment: 1 },
        },
      });

      invalidateDrawingsCache();

      return res.json({
        ...updated,
        elements: parseJsonField(updated.elements, []),
        appState: parseJsonField(updated.appState, {}),
        files: parseJsonField(updated.files, {}),
        accessLevel: access,
      });
    }),
  );
};

