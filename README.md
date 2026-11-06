# Comments Page

A simple threaded comments page in pure HTML, CSS and JavaScript (no frameworks, no build step).
Users register and log in in the browser, comment and reply at any depth, and every comment is
checked for banned words in a Web Worker before it is saved.

## Run locally

The page must be served over `http(s)://`. Module scripts, Web Workers, `fetch` and Web Crypto do
not work when `index.html` is opened directly from the file system (`file://`).

```sh
npm install
npm run serve
```

Then open <http://localhost:3000>.

Any static server works as well, for example `python3 -m http.server` or VS Code Live Server.

## Development

Requires Node 20.19, 22.13 or newer. The dependencies are development tools only; the page itself has none.

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm test`             | Runs the unit tests (`node:test`) |
| `npm run lint`         | Runs ESLint                       |
| `npm run format`       | Formats all files with Prettier   |
| `npm run format:check` | Checks the formatting             |

To check the drawing speed, start the server and open <http://localhost:3000/tests/perf.html>.
It draws 1 000 generated comments and shows the time.

## Verification

Checked in Chrome on 6 November 2026.

**Security** (spec §12)

| Test                                                                                    | Result                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Comments `<img src=x onerror=alert(1)>`, `<script>`, `javascript:` link, `<svg onload>` | Shown as plain text; no elements created, nothing runs        |
| Username `<script>alert(1)</script>`                                                    | Refused by validation; nothing saved                          |
| Corrupted storage: invalid JSON, wrong types, a `__proto__` key                         | Page loads without errors; no prototype pollution             |
| Normal use (register, post, blocked word, reply, collapse, log out, reload)             | No CSP violations; an injected inline script is blocked       |
| `userId` in sessionStorage changed to another user, forged token, invented session      | Logged out; never acts as the other user                      |
| 5 wrong passwords                                                                       | Even the right password is refused: "Try again in 30 seconds" |

**Performance** (spec, Performance)

| Target                              | Result                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1 000 comments draw in under 200 ms | 97–161 ms over 5 fresh loads, median 103 ms (style and layout included)                                    |
| First load under 100 KB             | 43 KB transferred (gzip), 46 KB after the first comment adds the worker and word list; 131 KB uncompressed |
| No external requests                | None: 40 files, all from the same origin                                                                   |

## Known limitations

- **Colour contrast.** The assignment requires the banned-word message in `#FF8300` (about 2.3:1
  on its background) and the Add Comment text in `#DE5050` (about 3.9:1 on white). Both are below
  WCAG AA (4.5:1). Both are kept as required. The message also has a warning icon and a pale
  orange background, so it does not rely on colour alone.
