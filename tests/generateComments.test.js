import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../js/config.js';
import { parseComment } from '../js/data/schemas.js';
import { buildCommentTree } from '../js/utils/buildCommentTree.js';
import { generateComments } from './fixtures/generateComments.js';

describe('generateComments', () => {
  const comments = generateComments(1_000);

  it('creates valid stored comments', () => {
    assert.equal(comments.length, 1_000);
    for (const comment of comments) {
      assert.deepEqual(parseComment(comment), comment);
    }
  });

  it('builds a tree where every comment is drawn without "Show more" or "Continue"', () => {
    const visit = (nodes, depth) => {
      assert.ok(nodes.length <= UI.repliesPreview || depth === 0);
      assert.ok(depth < UI.continueThreadAfter);
      return nodes.reduce((sum, node) => sum + 1 + visit(node.children, depth + 1), 0);
    };

    assert.equal(visit(buildCommentTree(comments), 0), 1_000);
  });
});
