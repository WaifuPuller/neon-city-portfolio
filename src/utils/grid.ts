/**
 * Tailwind column classes that never leave a lonely item in a wide grid.
 *
 * A portfolio starts small and grows: with one project you want one full-width
 * card, not one card and a column of empty space. This picks the largest
 * sensible column count for the number of items actually present.
 *
 * Classes are written out in full rather than interpolated, because Tailwind
 * scans source text and would not generate `sm:grid-cols-${n}`.
 */
export function gridCols(count: number, max: 2 | 3 | 4): string {
  if (count <= 1) return 'grid-cols-1';

  if (max === 2) return 'sm:grid-cols-2';

  if (max === 3) {
    if (count === 2) return 'sm:grid-cols-2';
    return 'sm:grid-cols-2 lg:grid-cols-3';
  }

  // max === 4
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-2 sm:grid-cols-3';
  return 'grid-cols-2 sm:grid-cols-4';
}
