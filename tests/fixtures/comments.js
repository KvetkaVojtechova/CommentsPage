/** A comment record as it is stored. */
export function storedComment(overrides = {}) {
  return {
    id: '9b1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
    parentId: null,
    authorId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
    authorName: 'Anna',
    text: 'Hello everyone!',
    createdAt: '2026-11-05T18:30:00.000Z',
    ...overrides,
  };
}
