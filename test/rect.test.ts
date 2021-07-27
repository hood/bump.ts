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

    it('should detect collisions from the right when itemRect intersects otherRect', () => {
      const a = rect_detectCollision(6, 0, 1, 1, 1, 0, 1, 1, 1, 1);

      expect(a?.overlaps).toBe(false);
      expect(a?.ti).toEqual(0.8);
      expect(a?.normal).toEqual({ x: 1, y: 0 });
    });

    it('should detect collisions from the top when itemRect intersects otherRect', () => {
      const a = rect_detectCollision(0, 0, 1, 1, 0, 4, 1, 1, 0, 5);

      expect(a?.overlaps).toBe(false);
      expect(a?.ti).toEqual(0.6);
      expect(a?.normal).toEqual({ x: 0, y: -1 });
    });

    it('should detect collisions from the bottom when itemRect intersects otherRect', () => {
      const a = rect_detectCollision(0, 4, 1, 1, 0, 0, 1, 1, 0, -1);

      expect(a?.overlaps).toBe(false);
      expect(a?.ti).toEqual(0.6);
      expect(a?.normal).toEqual({ x: 0, y: 1 });
    });

    it('should not get caught by nasty corner cases', () => {
      expect(rect_detectCollision(0, 16, 16, 16, 16, 0, 16, 16, -1, 15)).toBe(
        undefined
      );
    });
  });
});
