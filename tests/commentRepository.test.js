import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../js/config.js';
import { CommentRepository } from '../js/data/commentRepository.js';
import { MemoryStorageAdapter } from '../js/data/storageAdapter.js';
import { storedComment } from './fixtures/comments.js';

describe('CommentRepository', () => {
  it('saves comments and loads them again', async () => {
    const repository = new CommentRepository(new MemoryStorageAdapter());

    await repository.add(storedComment());

    assert.deepEqual(await repository.getAll(), [storedComment()]);
  });

  it('finds a comment by id', async () => {
    const repository = new CommentRepository(new MemoryStorageAdapter());
    await repository.add(storedComment());

    assert.deepEqual(await repository.findById(storedComment().id), storedComment());
    assert.equal(await repository.findById('1c2d3e4f-5a6b-4c7d-9e8f-a0b1c2d3e4f5'), null);
  });

  it('keeps a comment saved by another tab in the meantime', async () => {
    const storage = new MemoryStorageAdapter();
    const firstTab = new CommentRepository(storage);
    const secondTab = new CommentRepository(storage);
    const other = storedComment({ id: '1c2d3e4f-5a6b-4c7d-9e8f-a0b1c2d3e4f5' });

    await firstTab.add(storedComment());
    await secondTab.add(other);

    assert.deepEqual(await firstTab.getAll(), [storedComment(), other]);
  });

  it('loads the valid comments from damaged storage', async (t) => {
    t.mock.method(console, 'warn', () => {});
    const storage = new MemoryStorageAdapter();
    const repository = new CommentRepository(storage);

    storage.writeRaw(STORAGE_KEYS.comments, 'not json');
    assert.deepEqual(await repository.getAll(), []);

    storage.write(STORAGE_KEYS.comments, [storedComment(), { text: 42 }]);
    assert.deepEqual(await repository.getAll(), [storedComment()]);
  });
});
