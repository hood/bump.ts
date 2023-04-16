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
  if (a.ti === b.ti)
    return (
      rect_getSquareDistance(a.itemRect, a.otherRect) -
      rect_getSquareDistance(a.itemRect, b.otherRect)
    );

  return a.ti - b.ti;
}
