import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DrawingCard } from "./DrawingCard";

vi.mock("../api", () => ({
  getDrawing: vi.fn(),
}));

describe("DrawingCard - Shared Collection Permissions", () => {
  it("prevents viewer-level shared users from rename/delete/edit actions", () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onMoveToCollection = vi.fn();
    const onDuplicate = vi.fn();

    render(
      <DrawingCard
        drawing={{
          id: "d1",
          name: "Shared Viewer Drawing",
          collectionId: "shared-col-1",
          updatedAt: Date.now(),
          createdAt: Date.now(),
          version: 1,
          preview: "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
          accessLevel: "view",
        }}
        collections={[
          {
            id: "shared-col-1",
            name: "Shared Collection",
            createdAt: Date.now(),
          },
        ]}
        isSelected={false}
        isShared
        isSharedCollection
        onToggleSelection={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
        onMoveToCollection={onMoveToCollection}
        onDuplicate={onDuplicate}
        onClick={vi.fn()}
      />,
    );

    const cardRoot = screen
      .getByText("Shared Viewer Drawing")
      .closest(".drawing-card") as HTMLElement;
    fireEvent.contextMenu(cardRoot);

    expect(screen.queryByText("Rename")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Move to...")).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("Shared Viewer Drawing"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onMoveToCollection).not.toHaveBeenCalled();
  });
});

