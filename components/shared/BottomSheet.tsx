"use client";

import { useRef, useState, type ReactNode } from "react";

type SnapPoint = "peek" | "half" | "full";

const SNAP_HEIGHTS: Record<SnapPoint, string> = {
  peek: "80px",
  half: "50vh",
  full: "90vh",
};

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Initial snap point when opened. Defaults to "peek". */
  initialSnap?: SnapPoint;
  /**
   * Explicit background color. Callers should pass a resolved hex value rather
   * than a CSS variable so the color is correct inside Leaflet's DOM context.
   */
  backgroundColor?: string;
  borderColor?: string;
  handleColor?: string;
}

export function BottomSheet({
  open,
  onClose,
  children,
  initialSnap = "peek",
  backgroundColor = "#111118",
  borderColor = "#2a2a38",
  handleColor = "#2a2a38",
}: BottomSheetProps) {
  // snap state is initialized from initialSnap on mount.
  // Callers that need a fresh snap position on re-open should pass a key prop
  // to force unmount/remount (see AlertDetailPanel).
  const [snap, setSnap] = useState<SnapPoint>(initialSnap);
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<SnapPoint>(initialSnap);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY;
    dragStartSnap.current = snap;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;

    // Swipe down threshold: close or reduce snap point
    if (delta > 60) {
      if (dragStartSnap.current === "full") setSnap("half");
      else if (dragStartSnap.current === "half") setSnap("peek");
      else onClose();
    } else if (delta < -60) {
      // Swipe up: expand snap point
      if (dragStartSnap.current === "peek") setSnap("half");
      else if (dragStartSnap.current === "half") setSnap("full");
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — only at full height */}
      {snap === "full" && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          height: SNAP_HEIGHTS[snap],
          backgroundColor,
          borderTop: `1px solid ${borderColor}`,
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderBottom: "none",
          transition: "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: handleColor }}
          />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto h-[calc(100%-40px)] overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}
