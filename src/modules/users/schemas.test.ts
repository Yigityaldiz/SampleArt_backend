import { describe, it, expect } from 'vitest';
import { createUserBodySchema, updateUserBodySchema } from './schemas';

describe('user schemas', () => {
  it('normalizes name by trimming and collapsing whitespace', () => {
    const parsed = createUserBodySchema.parse({
      id: 'user_1',
      name: '  Foo    Bar  ',
    });

    expect(parsed.name).toBe('Foo Bar');
  });

  it('rejects names shorter than two characters', () => {
    expect(() =>
      createUserBodySchema.parse({
        id: 'user_1',
        name: 'A',
      }),
    ).toThrow(/at least 2 characters/);
  });

  it('rejects names containing non-printable characters', () => {
    expect(() =>
      updateUserBodySchema.parse({
        name: 'John\u0007',
      }),
    ).toThrow(/printable characters/);
  });
});
