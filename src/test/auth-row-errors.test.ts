import { describe, it, expect } from 'vitest';
import { isMissingRowError } from '@/lib/auth';

describe('isMissingRowError', () => {
  it('treats empty-row and multiple-row PostgREST errors as non-fatal', () => {
    expect(isMissingRowError({ code: 'PGRST116' })).toBe(true);
    expect(
      isMissingRowError({
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      }),
    ).toBe(true);
    expect(isMissingRowError({ code: '23505' })).toBe(false);
    expect(isMissingRowError(null)).toBe(false);
  });
});
