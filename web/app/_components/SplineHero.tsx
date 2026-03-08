"use client";

import Spline from "@splinetool/react-spline";

/**
 * Client-side wrapper for the Spline hero scene.
 *
 * Only blocks contextmenu / dragstart when the event target is the actual
 * <canvas> element. This keeps right-click working on every other element in
 * the hero (text, buttons, margins) while still preventing the browser from
 * offering "Save image as..." on the 3D scene itself.
 */
export default function SplineHero({ scene }: { scene: string }) {
  const onContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "CANVAS") {
      e.preventDefault();
    }
  };
  const onDragStart = (e: React.DragEvent) => {
    if ((e.target as HTMLElement).tagName === "CANVAS") {
      e.preventDefault();
    }
  };
  return (
    <div
      className="spline-wrap"
      aria-hidden="true"
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
    >
      <Spline scene={scene} />
    </div>
  );
}
