# Implementation Plan

The page is built in small steps. Each step adds one complete feature, from the HTML down to
storage, so the page works after every step. Steps 1–5 cover the whole assignment; steps 6–14
make it robust and easier to use.

| Step | Feature                           | Working after this step                                                  |
| ---- | --------------------------------- | ------------------------------------------------------------------------ |
| 1    | Project setup and styled page     | Layout, colours and font from the assignment, empty state                |
| 2    | Accounts                          | Register, log in, log out; passwords hashed                              |
| 3    | Top-level comments                | Logged-in users post comments; guests only read                          |
| 4    | Replies at any depth              | Comments form a tree                                                     |
| 5    | Banned-word check in a Web Worker | A new worker checks every comment; blocked words show an orange message  |
| 6    | "Any form" detection              | "W.A.R", "Russ1a" and "Pu tin" are blocked; "software" and "put in" pass |
| 7    | Thread presentation               | Thread lines, collapsing, large threads, relative times                  |
| 8    | Composer extras                   | "Comment posted" message, counter warning, Ctrl/Cmd + Enter, held keys   |
| 9    | Password and login rules          | Password rules, strength hint, lockout after failed logins               |
| 10   | Sessions                          | Session tokens with expiry; logout reaches other tabs                    |
| 11   | Storage errors and multiple tabs  | Full or damaged storage handled; tabs stay in sync                       |
| 12   | Accessibility                     | Keyboard and screen reader support                                       |
| 13   | Checks                            | Security tests in the browser, performance with 1 000 comments           |
| 14   | Documentation                     | README with setup, decisions and known limits                            |

## Rules for every step

- Tests are written together with the code; `npm test` and `npm run lint` pass.
- No errors in the browser console.
- No `innerHTML`, `eval`, inline styles or inline handlers.
- Limits come from `config.js` and texts from `messages.js`.
- Earlier steps still work.
- Small commits with clear messages.

## Notes on the order

- Accounts come before comments, because only logged-in users can comment.
- Some steps start simple and a later step replaces that part, so every step stays small:

  | Simple version first                                 | Added in | Replaced in |
  | ---------------------------------------------------- | -------- | ----------- |
  | Session without token or expiry                      | Step 2   | Step 10     |
  | Password rules: only length and matching entries     | Step 2   | Step 9      |
  | Comments saved without the banned-word check         | Step 3   | Step 5      |
  | Full dates instead of relative times                 | Step 3   | Step 7      |
  | Matcher catches only letter case and plurals         | Step 5   | Step 6      |
  | Storage errors and other tabs only partly handled    | Step 3   | Step 11     |

  This way the worker flow works and is tested before the harder detection rules are added.
- Security and performance are checked again at the end, in step 13, with the finished page.
