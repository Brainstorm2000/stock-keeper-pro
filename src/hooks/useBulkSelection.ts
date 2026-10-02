import { useState } from "react";

export function useBulkSelection<T extends { id: string }>(visibleItems: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visibleIds = visibleItems.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  return {
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection: () => setSelectedIds(new Set()),
  };
}