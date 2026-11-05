import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommentTree } from '../js/utils/buildCommentTree.js';

let clock = 0;

/** A minimal comment; each one is created a minute after the previous. */
function comment(id, parentId = null) {
  clock += 1;
  return { id, parentId, createdAt: new Date(Date.UTC(2026, 10, 5, 12, clock)).toISOString() };
}

const ids = (nodes) => nodes.map((node) => node.comment.id);

describe('buildCommentTree', () => {
  it('shows top-level comments newest first and replies oldest first', () => {
    const comments = [
      comment('a'),
      comment('b'),
      comment('a1', 'a'),
      comment('a2', 'a'),
      comment('a3', 'a'),
    ];

    const tree = buildCommentTree(comments);

    assert.deepEqual(ids(tree), ['b', 'a']);
    assert.deepEqual(ids(tree[1].children), ['a1', 'a2', 'a3']);
  });

  it('nests replies of replies and records their depth', () => {
    const tree = buildCommentTree([comment('a'), comment('b', 'a'), comment('c', 'b')]);

    const [a] = tree;
    const [b] = a.children;
    const [c] = b.children;
    assert.deepEqual([a.depth, b.depth, c.depth], [0, 1, 2]);
    assert.equal(c.comment.id, 'c');
  });

  it('counts all replies in each subtree', () => {
    const tree = buildCommentTree([
      comment('a'),
      comment('b', 'a'),
      comment('c', 'b'),
      comment('d', 'a'),
      comment('e'),
    ]);

    assert.deepEqual(
      tree.map((node) => [node.comment.id, node.descendantCount]),
      [
        ['e', 0],
        ['a', 3],
      ],
    );
    assert.equal(tree[1].children[0].descendantCount, 1);
  });

  it('leaves out a reply whose parent is missing, and its replies', () => {
    const tree = buildCommentTree([comment('a'), comment('x', 'missing'), comment('y', 'x')]);

    assert.deepEqual(ids(tree), ['a']);
    assert.equal(tree[0].descendantCount, 0);
  });

  it('does not freeze on a loop (A → B → A) or a comment that answers itself', () => {
    const tree = buildCommentTree([
      comment('top'),
      comment('A', 'B'),
      comment('B', 'A'),
      comment('self', 'self'),
    ]);

    assert.deepEqual(ids(tree), ['top']);
  });

  it('shows a duplicated id only once', () => {
    const tree = buildCommentTree([comment('a'), comment('r', 'a'), comment('r', 'a')]);

    assert.equal(tree[0].children.length, 1);
  });

  it('stops at the depth limit (50 levels) in a chain of 60', () => {
    const chain = [comment('c0')];
    for (let i = 1; i <= 60; i++) {
      chain.push(comment(`c${i}`, `c${i - 1}`));
    }

    let node = buildCommentTree(chain)[0];
    while (node.children.length) {
      [node] = node.children;
    }

    assert.equal(node.depth, 50);
    assert.equal(node.comment.id, 'c50');
  });

  it('returns an empty tree for no comments', () => {
    assert.deepEqual(buildCommentTree([]), []);
  });
});
