# Pedda Dhadi — Development Plan

A browser version of Pedda Dhadi (the 24-point, three-square "mill" game), hosted on GitHub Pages.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Modes | vs Computer (AI), Online P2P (share link / room code), Same-device 2 player |
| Board | 3 nested squares, lines only through side midpoints (24 points, 16 possible dhadis) |
| Pieces | 9 or 11 per player (setting, default 9) |
| Capture rule | Can't take a piece that's in a dhadi unless *all* opponent pieces are in dhadis |
| Re-forming | Breaking a dhadi and re-forming it captures again |
| Flying | **Off** (pieces always slide to adjacent points) |
| Win | Opponent has fewer than 3 pieces (on board + in hand), or has no legal move on their turn |
| Style | Traditional: chalk lines on a stone/clay floor, seeds vs. pebbles as pieces. Theme system so more skins can be added later |
| Language | English only |
| Extras | Sound effects (with mute), Undo in vs-AI mode, text + voice chat online |
| Hosting | GitHub Pages (static only) |

### Defaults I picked (tell me to change any)
- Forming **two dhadis with one move** captures only **one** piece.
- **Draw** if 50 moves pass in the movement phase with no capture, or the same position repeats 3 times. Online players can also offer a draw.
- Player 1 (light seeds) always moves first; in vs-AI you choose your colour; online the host picks.

## Tech stack
- **Vite + TypeScript**, no UI framework. Builds to static files.
- **SVG** board (scales crisply on phone and desktop; easy to restyle for themes).
- **Vitest** unit tests for the rules engine and AI.
- **PeerJS** for WebRTC peer-to-peer: data channel for moves and text chat, media call for voice. Uses PeerJS's free public broker only to introduce the two browsers; game traffic then goes directly between them.
- **Web Audio API** for sound effects (generated, no asset licensing issues).
- **GitHub Actions** workflow that builds and deploys to GitHub Pages on push to `main`.

Known limit: P2P without a TURN relay fails on some strict networks (some corporate or mobile carrier NATs). The game will show a clear "couldn't connect" message. A free TURN service can be added later if needed.

## Architecture

```
src/
  engine/        pure game logic, no DOM
    board.ts       24 points, adjacency, 16 dhadi lines
    state.ts       GameState type, phases: placing | moving | removing | gameover
    rules.ts       legalActions(), applyAction(), dhadi detection, capture rules, win/draw
  ai/
    search.ts      minimax + alpha-beta, iterative deepening, move ordering
    evaluate.ts    piece count, dhadis, near-dhadis, mobility, blocked pieces
    worker.ts      runs search in a Web Worker so the UI never freezes
  net/
    peer.ts        PeerJS wrapper: host/join, reconnect, message protocol
    protocol.ts    typed messages: hello, action, chat, draw-offer, rematch, resign
    voice.ts       mic permission, call, mute/unmute
  ui/
    boardView.ts   SVG rendering, click/tap handling, highlights, animations
    themes/        traditional.ts (more later)
    screens.ts     home, setup, game, game-over
    hud.ts         turn indicator, pieces in hand, captured pieces, status text
    chat.ts        chat panel + mic button
    sound.ts       place / slide / dhadi / capture / win sounds
  main.ts
tests/           engine + AI tests
.github/workflows/deploy.yml
```

The engine is one pure function, `applyAction(state, action) → newState`. Every mode uses it the same way: local play calls it directly, the AI searches with it, and online play sends actions over the wire and both sides apply and validate them. Undo is just a stack of previous states.

## AI levels
| Level | Behaviour |
|---|---|
| Easy | Depth 1-2 with randomness; takes obvious captures, misses traps |
| Medium | Depth ~4 |
| Hard | Iterative deepening to ~1.5 s per move, transposition table |

## Online flow
1. Host clicks **Play online → Create game**, picks pieces count (9/11) and colour.
2. Gets a link like `https://<user>.github.io/<repo>/#join=ABC123` plus the code `ABC123`, with a copy/share button.
3. Friend opens link (or types code) → connected. Host's rules are shown to the guest.
4. Both sides validate every action with the engine; host is the tie-breaker if states drift.
5. Text chat panel; **mic button** starts voice (asks permission, mute toggle, works only if both allow).
6. Disconnect → "waiting for opponent to reconnect" for 60 s, then game ends. Rematch button after game over.

## Milestones
1. **Engine + tests**: board, rules, all win/draw/capture conditions, 100% of rules covered by tests.
2. **Board UI + same-device play**: traditional theme, tap to place, tap-select-tap to move, tap to capture, highlights for legal moves and capturable pieces, piece animations, sounds, responsive layout.
3. **vs AI**: worker-based AI, 3 levels, colour choice, undo.
4. **Online**: PeerJS host/join via link/code, synced play, text chat, voice chat, disconnect handling, rematch.
5. **Deploy**: GitHub Actions → GitHub Pages, README with how to play and the rules.
6. **Later (if it clicks)**: theme picker (wooden, modern), per-user saved settings, 11-piece diagonal variant, TURN relay, stats.

## Development approach
Coding is done by Sonnet subagents, milestone by milestone; I review and test each milestone in the browser before moving on.
