const AUTHORS = ['Anna', 'Ben', 'Ľubomír', 'Zoe'].map((name, index) => ({
  id: `a000000${index}-0000-4000-8000-000000000000`,
  name,
}));
const SENTENCE = 'This is a sample comment for checking how fast the page draws. ';
const BASE_TIME = Date.UTC(2026, 10, 1);

/**
 * Comments in threads of 8: a comment with 3 replies, 3 replies to the first one and 1 reply
 * below that. No branch has more than 3 replies or 10 levels, so every comment is drawn.
 */
const THREAD = [null, 0, 0, 0, 1, 1, 1, 4];

/** @returns {object[]} `count` valid stored comments, oldest first. */
export function generateComments(count) {
  const comments = [];
  for (let index = 0; index < count; index++) {
    const threadStart = index - (index % THREAD.length);
    const parentOffset = THREAD[index % THREAD.length];
    const author = AUTHORS[index % AUTHORS.length];
    comments.push({
      id: idFor(index),
      parentId: parentOffset === null ? null : idFor(threadStart + parentOffset),
      authorId: author.id,
      authorName: author.name,
      text: SENTENCE.repeat(1 + (index % 4)).trim(),
      createdAt: new Date(BASE_TIME + index * 60_000).toISOString(),
    });
  }
  return comments;
}

function idFor(index) {
  return `${index.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
}
