import { useEffect, useState } from "react";

export const useEditorAutoHide = (
  drawingId: string | undefined,
  defaultEnabled = false,
) => {
  const [autoHideEnabled, setAutoHideEnabled] = useState(defaultEnabled);

  // The toolbar toggle applies to the current visit. Old per-drawing storage
  // must not override the user's global preference on later visits.
  useEffect(() => {
    setAutoHideEnabled(defaultEnabled);
  }, [defaultEnabled, drawingId]);

  return {
    autoHideEnabled,
    setAutoHideEnabled,
  };
};
