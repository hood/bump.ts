import { IRect } from '../..';
import { rect_getSquareDistance } from '../../rect';

interface Item {
  // x: number;
  // y: number;
  // w: number;
  // h: number;
  ti: number;
  itemRect: IRect;
  otherRect: IRect;
}

export default function sortByTiAndDistance(a: Item, b: Item): number {
  if (a.ti === b.ti) {
    const ir: IRect = a.itemRect;
    const ar: IRect = a.otherRect;
    const br: IRect = b.otherRect;

    const ad = rect_getSquareDistance(ir, ar);
    const bd = rect_getSquareDistance(ir, br);

    return ad - bd;
  }

  return a.ti - b.ti;
}
