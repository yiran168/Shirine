import { expect, test } from "bun:test";
import { clampMascotPosition } from "../../client/src/utils/mascot-position";

test("transparent Live2D padding does not prevent reaching any viewport corner", () => {
  const bounds = { x: 68, y: 138, width: 156, height: 156 };
  const canvasHeight = 360;
  for (const viewport of [{width:1280,height:900},{width:375,height:812}]) {
    for (const right of [false,true]) for (const top of [false,true]) {
      const result = clampMascotPosition({ x:right?10000:-10000, y:top?10000:-10000 }, bounds, canvasHeight, viewport);
      const left = result.x + bounds.x;
      const visibleTop = viewport.height - result.y - canvasHeight + bounds.y;
      expect(left).toBe(right ? viewport.width - bounds.width : 0);
      expect(visibleTop).toBe(top ? 0 : viewport.height - bounds.height);
    }
  }
});

test("a saved position at the old canvas padding stays stable and adapts on resize", () => {
  const bounds = {x:68,y:138,width:156,height:156};
  const saved = {x:-68,y:-66};
  expect(clampMascotPosition(saved,bounds,360,{width:1280,height:900})).toEqual(saved);
  const moved = clampMascotPosition({x:1056,y:678},bounds,360,{width:375,height:812});
  expect(moved.x + bounds.x + bounds.width).toBe(375);
  expect(812 - moved.y - 360 + bounds.y).toBe(0);
});
