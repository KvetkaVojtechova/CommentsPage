# Comments Page

A threaded comments page in pure HTML, CSS and JavaScript, with no frameworks and no build step.
Users register and log in in the browser, then comment and reply at any depth. Before a comment
is saved, a new Web Worker checks it for banned words in any form.

**Live:** <https://kvetkavojtechova.github.io/CommentsPage/>

## Run locally

The page must be served over `http(s)://`, because module scripts, Web Workers, `fetch` and Web
Crypto do not work from `file://`.

```sh
npm install
npm run serve
```

Then open <http://localhost:3000>. Any static server works too, for example
`python3 -m http.server`.

## The assignment and how it is met

| Assignment                                  | How it works                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Register and log in, stored in the browser  | Users in `localStorage` with hashed passwords; the session in `sessionStorage`                   |
| Guests can only read                        | Guests see every comment, but no comment box and no Reply buttons                                |
| Anybody can reply, at any depth             | Comments are stored as a flat list with a `parentId` and drawn as a tree                         |
| A new Web Worker checks every comment       | Add Comment starts a new worker, which loads `data/banned-words.json`, checks the text and stops |
| Banned words in any form are blocked        | Case, plurals, nationality forms, look-alike letters, leetspeak, spaced letters, hashtags        |
| The user is told which word they cannot use | An orange `#FF8300` message names each banned word; the text stays                               |
| Clean comments are added with a timestamp   | Saved under the right parent; shown as "5 min ago"                                               |
| Layout and style                            | 70% wide and centred, `#F5F5F5`, Lucida Handwriting at 18px, button colours swap on hover        |

**Beyond the assignment:** an empty state, a character counter, collapsible replies and thread
lines, Ctrl/Cmd + Enter to post, keyboard and screen reader support, a guard against a held-down
key, password rules, a login lockout and session expiry.

## How it is built

The code is split into layers: views → controllers → services → repositories → storage.
`main.js` creates all objects and connects them, so services are tested in Node without a
browser. Only the repositories touch browser storage, so switching to a real API would change
only that layer.

Details, including how the banned-word matcher works, are in
[docs/technical-design.md](docs/technical-design.md). The build order is in
[docs/implementation-plan.md](docs/implementation-plan.md).

## Decisions

| Topic                | Decision                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| "Anybody can reply"  | Any logged-in user; guests cannot, as they cannot comment either                                |
| "In any form"        | Whole-word matching of generated forms and disguised spellings, so "software" and "award" pass  |
| New worker per click | As the assignment says. Reusing one worker would be faster                                      |
| Fail closed          | If the worker fails or takes over 5 seconds, the comment is not saved                           |
| Enter in the box     | Enter adds a new line; Ctrl/Cmd + Enter posts                                                   |
| Large threads        | 3 replies shown, then "Show N more replies"; very deep branches open via "Continue this thread" |
| Not built            | Editing, deleting, sorting and rate limiting, as they are not part of the assignment            |

A word filter matches spelling, not meaning, so "Star Wars" or "Russian doll" are blocked too.

To ban another word, add it to `data/banned-words.json` and add an example to
`tests/wordMatcher.test.js`. Plurals and disguised spellings apply automatically.

## Security

- All text is added with `textContent` through one helper; ESLint forbids `innerHTML` and `eval`.
- A Content Security Policy allows scripts and requests only from the page's own origin.
- Stored data is validated on every read, so edited or broken storage cannot break the page.
- Passwords are hashed with PBKDF2-SHA-256 and a random salt, and never stored in plain text.

**Limits.** Without a server, everything lives in one browser, and anyone with developer tools
can edit `localStorage` directly. A real product would need a backend that stores the data and
repeats every check.

## Development

Requires Node 20.19, 22.13 or newer. The dependencies are development tools only.

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm test`             | Runs the unit tests (`node:test`) |
| `npm run lint`         | Runs ESLint                       |
| `npm run format:check` | Checks the formatting             |

Checked in Chrome: script injection attempts are shown as plain text, damaged storage does not
break the page, and 1 000 comments draw in about 100 ms (open `/tests/perf.html` on the local
server to measure).

## Known limitations

- The assignment's colours `#FF8300` and `#DE5050` are below the WCAG AA contrast ratio. They are
  kept as required; the blocked message also has an icon and a pale background.
- Lucida Handwriting is installed on Windows only; other systems use a similar handwriting font.
- A stretched word with only one extra letter, such as "warr", is not caught, so that normal
  double letters stay allowed.
- **Next steps:** a backend for shared accounts and comments, editing and deleting own comments,
  and paging for long discussions.
