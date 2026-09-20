import React, { useState } from "react";
import clsx from "clsx";

interface SidebarItemProps {
  id: string | null;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  extraAction?: React.ReactNode;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (val: string) => void;
  onEditSubmit?: (e: React.FormEvent) => void;
  onEditBlur?: () => void;
  onDrop?: (e: React.DragEvent, collectionId: string | null) => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  id,
  icon,
  label,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu,
  extraAction,
  isEditing,
  editValue,
  onEditChange,
  onEditSubmit,
  onEditBlur,
  onDrop,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="relative group/item pl-3 pr-2">
      {isEditing ? (
        <form onSubmit={onEditSubmit} className="py-1">
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => onEditChange?.(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border-2 border-black dark:border-neutral-700 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] outline-none font-bold text-slate-900 dark:text-white"
            onBlur={onEditBlur}
          />
        </form>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            onDrop?.(e, id);
          }}
          className={clsx(
            "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 border-2 group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-2 dark:focus-visible:ring-neutral-500",
            isActive || isDragOver
              ? "bg-indigo-50 dark:bg-neutral-800 text-indigo-900 dark:text-neutral-200 border-black dark:border-neutral-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] -translate-y-0.5"
              : "text-slate-600 dark:text-neutral-400 border-transparent hover:bg-slate-50 dark:hover:bg-neutral-800 hover:border-black dark:hover:border-neutral-700 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5",
          )}
        >
          <span
            className={clsx(
              "transition-colors duration-200",
              isActive || isDragOver
                ? "text-indigo-900 dark:text-neutral-200"
                : "text-slate-400 dark:text-neutral-500 group-hover:text-slate-900 dark:group-hover:text-neutral-200",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1 text-left font-bold">{label}</span>
          {extraAction && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {extraAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

