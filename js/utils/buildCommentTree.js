import { UI } from '../config.js';

/**
 * @typedef {{ id: string, parentId: string | null, createdAt: string }} CommentRecord
 * @typedef {{ comment: CommentRecord, depth: number, children: TreeNode[], descendantCount: number }} TreeNode
 */

const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);
const oldestFirst = (a, b) => a.createdAt.localeCompare(b.createdAt);

/**
 * Turns the flat list of comments into a tree: top-level comments newest first,
 * replies oldest first. Replies whose parent is missing are never reached, so they are not
 * shown. The visited set and the depth limit stop broken data that loops (A → B → A).
 * @param {CommentRecord[]} comments
 * @param {number} [maxDepth] Replies deeper than this are left out.
 * @returns {TreeNode[]}
 */
export function buildCommentTree(comments, maxDepth = UI.maxDepth) {
  const childrenByParent = new Map();
  for (const comment of comments) {
    const siblings = childrenByParent.get(comment.parentId) ?? [];
    siblings.push(comment);
    childrenByParent.set(comment.parentId, siblings);
  }

  const visited = new Set();

  function buildNode(comment, depth) {
    visited.add(comment.id);
    const children = [];
    if (depth < maxDepth) {
      for (const child of [...(childrenByParent.get(comment.id) ?? [])].sort(oldestFirst)) {
        if (!visited.has(child.id)) {
          children.push(buildNode(child, depth + 1));
        }
      }
    }
    const descendantCount = children.reduce((sum, child) => sum + 1 + child.descendantCount, 0);
    return { comment, depth, children, descendantCount };
  }

  const roots = [...(childrenByParent.get(null) ?? [])].sort(newestFirst);
  return roots
    .filter((comment) => !visited.has(comment.id))
    .map((comment) => buildNode(comment, 0));
}
