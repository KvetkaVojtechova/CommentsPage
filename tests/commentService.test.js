import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModerationError, PermissionError, StorageError } from '../js/core/errors.js';
import { CommentRepository } from '../js/data/commentRepository.js';
import { MemoryStorageAdapter, WebStorageAdapter } from '../js/data/storageAdapter.js';
import { CommentService } from '../js/services/commentService.js';
import { isIsoDate, isUuid } from '../js/utils/validators.js';
import { FakeStorage } from './fixtures/fakeStorage.js';

const ANNA = { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', username: 'Anna' };

describe('CommentService', () => {
  let currentUser;
  let repository;
  let service;
  let checkedTexts;
  let moderate;

  beforeEach(() => {
    currentUser = ANNA;
    checkedTexts = [];
    moderate = async () => ({ blocked: false, words: [] });
    repository = new CommentRepository(new MemoryStorageAdapter());
    service = new CommentService({
      commentRepository: repository,
      authService: { getCurrentUser: async () => currentUser },
      moderationService: {
        check: async (text) => {
          checkedTexts.push(text);
          return moderate(text);
        },
      },
    });
  });

  it('saves a comment with an id, the author and a timestamp', async () => {
    const comment = await service.add({ text: '  Hello\neveryone!  ' });

    assert.equal(isUuid(comment.id), true);
    assert.equal(isIsoDate(comment.createdAt), true);
    assert.deepEqual(
      { parentId: comment.parentId, authorId: comment.authorId, authorName: comment.authorName },
      { parentId: null, authorId: ANNA.id, authorName: 'Anna' },
    );
    assert.equal(comment.text, 'Hello\neveryone!');
    assert.deepEqual(await service.getAll(), [comment]);
  });

  it('refuses a guest, even when called directly', async () => {
    currentUser = null;

    await assert.rejects(service.add({ text: 'Hello' }), PermissionError);
    assert.deepEqual(await repository.getAll(), []);
  });

  it('refuses empty, whitespace-only and too long text', async () => {
    for (const text of ['', '   \n\t ', '\u0007']) {
      await assert.rejects(service.add({ text }), { code: 'commentEmpty' });
    }
    await assert.rejects(service.add({ text: 'x'.repeat(501) }), { code: 'commentTooLong' });
    assert.deepEqual(await repository.getAll(), []);
  });

  it('accepts exactly 500 characters', async () => {
    const comment = await service.add({ text: 'x'.repeat(500) });

    assert.equal(comment.text.length, 500);
  });

  it('stores unsafe-looking text as plain text, unchanged', async () => {
    const text = '<img src=x onerror=alert(1)>';

    assert.equal((await service.add({ text })).text, text);
  });

  it('saves a reply under an existing comment', async () => {
    const parent = await service.add({ text: 'Question?' });
    const reply = await service.add({ parentId: parent.id, text: 'Answer.' });

    assert.equal(reply.parentId, parent.id);
    assert.deepEqual(await service.getAll(), [parent, reply]);
  });

  it('refuses a reply to a comment that does not exist', async () => {
    await assert.rejects(
      service.add({ parentId: '1c2d3e4f-5a6b-4c7d-9e8f-a0b1c2d3e4f5', text: 'Hello' }),
      { field: 'parentId', code: 'parentMissing' },
    );
    await assert.rejects(service.add({ parentId: 'not-an-id', text: 'Hello' }), {
      code: 'parentMissing',
    });
    assert.deepEqual(await repository.getAll(), []);
  });

  it('refuses a guest reply before looking at the parent', async () => {
    currentUser = null;

    await assert.rejects(service.add({ parentId: 'anything', text: 'Hello' }), PermissionError);
  });

  it('checks exactly the text that is saved', async () => {
    const comment = await service.add({ text: '  Hello  ' });

    assert.deepEqual(checkedTexts, ['Hello']);
    assert.equal(comment.text, 'Hello');
  });

  it('does not save a comment with a banned word', async () => {
    moderate = async () => ({ blocked: true, words: ['Putin', 'War'] });

    await assert.rejects(service.add({ text: 'I love Putin and war' }), {
      name: 'ModerationError',
      reason: 'blocked',
      words: ['Putin', 'War'],
    });
    assert.deepEqual(await repository.getAll(), []);
  });

  it('does not save a comment when the check fails', async () => {
    moderate = async () => {
      throw new ModerationError('failed');
    };

    await assert.rejects(service.add({ text: 'Hello' }), { reason: 'failed' });
    assert.deepEqual(await repository.getAll(), []);
  });

  it('does not check empty text', async () => {
    await assert.rejects(service.add({ text: '   ' }), { code: 'commentEmpty' });
    assert.deepEqual(checkedTexts, []);
  });

  it('does not save when the user logged out during the check', async () => {
    moderate = async () => {
      currentUser = null;
      return { blocked: false, words: [] };
    };

    await assert.rejects(service.add({ text: 'Hello' }), PermissionError);
    assert.deepEqual(await repository.getAll(), []);
  });

  it('reports a full storage as a StorageError and saves nothing', async () => {
    const storage = new FakeStorage();
    const fullRepository = new CommentRepository(new WebStorageAdapter(storage));
    const fullService = new CommentService({
      commentRepository: fullRepository,
      authService: { getCurrentUser: async () => ANNA },
      moderationService: { check: async () => ({ blocked: false, words: [] }) },
    });
    storage.failWrites = true;

    await assert.rejects(fullService.add({ text: 'Hello' }), StorageError);
    assert.deepEqual(await fullRepository.getAll(), []);
  });
});
