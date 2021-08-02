import { Rect } from '../..';
import { rect_getSquareDistance } from '../../rect';

interface Item {
  // x: number;
  // y: number;
  // w: number;
  // h: number;
  ti: number;
  itemRect: Rect;
  otherRect: Rect;
}

export default function sortByTiAndDistance(a: Item, b: Item): number {
  if (a.ti === b.ti) {
    const ir: Rect = a.itemRect;
    const ar: Rect = a.otherRect;
    const br: Rect = b.otherRect;

    const ad = rect_getSquareDistance(
      ir.x,
      ir.y,
      ir.w,
      ir.h,
      ar.x,
      ar.y,
      ar.w,
      ar.h
    );
    const bd = rect_getSquareDistance(
      ir.x,
      ir.y,
      ir.w,
      ir.h,
      br.x,
      br.y,
      br.w,
      br.h
    );

    return ad - bd;
  }

  return a.ti - b.ti;
}
