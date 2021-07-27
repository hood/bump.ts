import { rect_detectCollision } from '../src/rect';

describe('rect', () => {
  describe('detect', () => {
    it('should return undefined when itemRect does not intersect otherRect', () => {
      const a = rect_detectCollision(0, 1, 1, 1, 5, 5, 1, 1, 0, 0);

      expect(a).toBe(undefined);
    });

    it('should return overlaps, normal, mve, ti diff, itemRect, otherRect when itemRect overlaps otherRect', () => {
      const a = rect_detectCollision(0, 0, 7, 6, 5, 5, 1, 1, 0, 0);

      expect(a?.overlaps).toBe(true);
      expect(a?.ti).toEqual(-2);
      expect(a?.move).toEqual({ x: 0, y: 0 });
      expect(a?.itemRect).toEqual({ x: 0, y: 0, w: 7, h: 6 });
      expect(a?.otherRect).toEqual({ x: 5, y: 5, w: 1, h: 1 });
      expect(a?.normal).toEqual({ x: 0, y: -1 });
    });

    it('should return undefined when a moving itemRect does not intersect otherRect', () => {
      const a = rect_detectCollision(0, 1, 1, 1, 5, 5, 1, 1, 0, 1);

      expect(a).toBe(undefined);
    });

    it('should detect collisions from the left when itemRect intersects otherRect', () => {
      const a = rect_detectCollision(1, 1, 1, 1, 5, 0, 1, 1, 6, 0);

      expect(a?.ti).toEqual(0.6);
      expect(a?.normal).toEqual({ x: -1, y: 0 });
    });
  });
});
