export interface MascotBounds { x: number; y: number; width: number; height: number }

/** Canvas padding may leave the viewport; only the visible character is clamped. */
export function clampMascotPosition(
  position: { x: number; y: number },
  bounds: MascotBounds,
  canvasHeight: number,
  viewport: { width: number; height: number },
) {
  const minX = -bounds.x;
  const maxX = Math.max(minX, viewport.width - bounds.x - bounds.width);
  const minY = bounds.y + bounds.height - canvasHeight;
  const maxY = Math.max(minY, viewport.height - canvasHeight + bounds.y);
  return { x: Math.max(minX, Math.min(maxX, position.x)), y: Math.max(minY, Math.min(maxY, position.y)) };
}
