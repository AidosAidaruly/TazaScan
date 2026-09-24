import type { Prisma } from '../generated/prisma/client';

// Match a name/brand prefix or a prefix after common word separators. Keep
// partial typing ("choco") without matching "cola" inside "chocolate".
export function wordPrefixFilter(
  field: 'name' | 'brand',
  query: string
): Prisma.ProductWhereInput {
  const literal = query.trim().replace(/[\\%_]/g, '\\$&');
  return {
    OR: [
      { [field]: { startsWith: literal, mode: 'insensitive' } },
      ...[' ', '-', '/', '(', '.', ',', ':', ';', '\t', '\n', '\r', '\u00a0'].map(
        (separator) => ({ [field]: { contains: separator + literal, mode: 'insensitive' } })
      )
    ]
  };
}
