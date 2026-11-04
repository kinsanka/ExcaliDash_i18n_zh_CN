import React from "react";
import { HistoryPanel } from "../../components/HistoryPanel";
import type { DrawingSnapshotFull } from "../../api";

type EditorDialogsProps = {
  drawingId?: string;
  historyButtonRef: React.RefObject<HTMLButtonElement>;
  getCurrentVersion: () => number | null;
  isHistoryOpen: boolean;
  onPreviewHistory: (snapshot: DrawingSnapshotFull | null) => void;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onCloseHistory: () => void;
};

export const EditorDialogs: React.FC<EditorDialogsProps> = ({
  drawingId,
  historyButtonRef,
  getCurrentVersion,
  isHistoryOpen,
  onPreviewHistory,
  onRestoreSnapshot,
  onCloseHistory,
}) => {
  if (!drawingId) return null;

  return (
    <HistoryPanel
      drawingId={drawingId}
      anchorRef={historyButtonRef}
      getCurrentVersion={getCurrentVersion}
      isOpen={isHistoryOpen}
      onClose={onCloseHistory}
      onPreview={onPreviewHistory}
      onRestoreSnapshot={onRestoreSnapshot}
      onRestore={() => window.location.reload()}
    />
  );
};
