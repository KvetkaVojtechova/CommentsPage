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
