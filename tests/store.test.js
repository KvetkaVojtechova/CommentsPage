import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Store, STORE_EVENTS } from '../js/core/store.js';

function recordEvents(store) {
  const events = [];
  for (const type of Object.values(STORE_EVENTS)) {
    store.on(type, (payload) => events.push({ type, payload }));
  }
  return events;
}

describe('Store', () => {
  it('starts with no user, no comments and a closed modal', () => {
    const { state } = new Store();

    assert.equal(state.currentUser, null);
    assert.deepEqual(state.comments, []);
    assert.equal(state.ui.modal, null);
  });

  it('setUser stores the user and emits user:changed', () => {
    const store = new Store();
    const events = recordEvents(store);
    const user = { id: 'u1', username: 'Anna' };

    store.setUser(user);

    assert.equal(store.state.currentUser, user);
    assert.deepEqual(events, [{ type: STORE_EVENTS.userChanged, payload: user }]);
  });

  it('setComments stores a copy and emits comments:loaded', () => {
    const store = new Store();
    const events = recordEvents(store);
    const comments = [{ id: 'c1' }];

    store.setComments(comments);
    comments.push({ id: 'c2' });

    assert.deepEqual(store.state.comments, [{ id: 'c1' }]);
    assert.deepEqual(events, [{ type: STORE_EVENTS.commentsLoaded, payload: [{ id: 'c1' }] }]);
  });

  it('addComment appends the comment and emits comment:added', () => {
    const store = new Store();
    store.setComments([{ id: 'c1' }]);
    const events = recordEvents(store);
    const comment = { id: 'c2' };

    store.addComment(comment);

    assert.deepEqual(store.state.comments, [{ id: 'c1' }, { id: 'c2' }]);
    assert.deepEqual(events, [{ type: STORE_EVENTS.commentAdded, payload: comment }]);
  });

  it('openModal and closeModal update the UI state and emit ui:changed', () => {
    const store = new Store();
    const events = recordEvents(store);

    store.openModal('register');
    assert.equal(store.state.ui.modal, 'register');

    store.closeModal();
    assert.equal(store.state.ui.modal, null);

    assert.deepEqual(
      events.map((event) => event.type),
      [STORE_EVENTS.uiChanged, STORE_EVENTS.uiChanged],
    );
  });
});
