# Pedda Dhadi

A browser version of Pedda Dhadi, the traditional Telugu 24-point, three-square "mill" game.
Play against the computer, a friend on the same device, or a friend online.

Live site: https://harsha-nimmagadda.github.io/TriLine/

Built with Vite + TypeScript (no UI framework), an SVG board, Web Audio sound effects, a Web Worker AI
and PeerJS for peer-to-peer online play.

## Run locally

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest): rules engine, AI, online protocol/session
npm run build      # type-check + static build into dist/ (relative base: works under any path)
npm run preview    # serve the production build
npm run ai-ladder  # plays AI levels against each other and prints win/loss/draw tables
```

## Computer levels

Five levels (default: Kids):

- **Kids** (for kids): casual, mostly random play; completes an open dhadi about half the time and rarely blocks.
- **Easy** (new to the game): 2-ply search with noise; usually completes and blocks but about 3 turns in 10 plays casually.
- **Medium** (casual player): 2-ply search with a little noise, occasionally slips and misses a block.
- **Hard** (experienced): iterative deepening to depth 4 within ~450 ms, tiny noise, rare slips.
- **Expert** (veteran): iterative-deepening alpha-beta search, about 1.5 s per move.

`npm run ai-ladder` plays adjacent levels against each other (time caps scaled down: hard 50 ms, expert 150 ms per move).

## Themes

Six themes change the whole app (board, pieces, page, buttons, chat, dialogs, highlights): **Traditional** (default), **Granite**,
**Wooden**, **Modern**, **Rangoli** and **Night**. Pick one with the palette button in the top bar, the Theme button on the home
screen, or the in-game Menu; the choice is saved in your browser. In an online game both players see the host's theme (the
guest's own choice returns when they leave). Previews: `docs/themes/*.png`. To add a theme, create a file in `src/ui/themes/`
(see `theme.ts` for the interface), add it to `registry.ts`; the tests check it defines every token and meets contrast rules.

## How to play

- The board has 24 points on three nested squares. Lines join the squares only through the middle of each side.
- A **dhadi** is three of your pieces in a row on one side of a square or on one of the four lines crossing all three squares.
- **Placing:** Light goes first. Take turns placing one piece on any empty point until all 9 (or 11) pieces are down.
- **Moving:** then take turns sliding a piece to an adjacent empty point. No jumping or flying.
- **Making a dhadi** (placing or moving) lets you remove one opponent piece. A piece in a dhadi is protected
  unless every opponent piece on the board is in a dhadi. Two dhadis at once still remove only one piece.
  Break a dhadi and re-form it later and you capture again.
- **Win** when the opponent has fewer than 3 pieces (board + hand) or has no legal move on their turn.
- **Draw** after 50 moves in the moving phase without a capture, the same position three times, or by agreement online.

## Online play

1. Home, then **Play online**, then **Create game**. Choose pieces (9 or 11) and your colour.
2. Share the 6-character code or the invite link (`https://harsha-nimmagadda.github.io/TriLine/#join=CODE`). Your friend opens
   the link, or enters the code under **Join**.
3. Play. Both browsers check every move against the rules. Text chat is always available; the mic button starts voice
   chat (the other player must accept, and both need microphone permission; browsers require https for the microphone,
   which GitHub Pages provides).
4. If a player disconnects, the other waits 60 seconds. The guest can reopen the invite link (or the page auto-retries)
   and the game resumes. After 60 seconds the game ends.
5. After a game, **Rematch** needs both players; colours swap.

Online play is peer-to-peer (WebRTC). PeerJS's free public broker is only used to introduce the two browsers; moves,
chat and voice go directly between them.

**Limitation:** with only a STUN server (no TURN relay), a direct connection can fail on some strict networks
(some corporate Wi-Fi, some mobile carriers, symmetric NATs). The game then shows a "couldn't connect" message; trying
another network usually fixes it. The free public PeerJS broker can also be slow or briefly unavailable.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` tests, builds and deploys `dist/` on every push to `main`
(or manually via **Actions > Deploy to GitHub Pages > Run workflow**).

One-time setup: in the repository, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
The site is published at `https://<user>.github.io/<repo>/` (for this repo: https://harsha-nimmagadda.github.io/TriLine/).
The build uses a relative base (`./`), so it works under any repository path.

## Project layout

- `src/engine/` pure, serializable rules (`applyAction(state, action)`, `legalActions(state)`); actions are plain JSON.
- `src/ai/` minimax + alpha-beta, iterative deepening, transposition table; runs in `worker.ts`.
- `src/net/` online play: `protocol.ts` (typed, versioned messages + validation), `session.ts` (transport-agnostic game
  session logic), `transport.ts` (interface + in-memory test transport), `peer.ts` (PeerJS host/guest), `voice.ts`, `roomCode.ts`.
- `src/game/` controller tying engine, AI/online session, board and HUD together.
- `src/ui/` SVG board, HUD, screens, chat, sound, and `themes/` (theme interface + `traditional.ts`).
- `tests/` Vitest tests.
