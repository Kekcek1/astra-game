# Echo Station prototype

## Run locally

Open `index.html` in a browser, or serve this folder over HTTP:

```powershell
node .\server.cjs
```

The game supports Russian and English. Progress is saved in the browser's `localStorage` under `echo-station-save`.

## Controls

- Desktop: move with WASD or arrow keys; press Space to dash. The pilot fires automatically.
- Mobile: drag the on-screen joystick and tap Dash.

The prototype has one workshop, three combat sectors, two between-sector module choices, one boss, permanent suit upgrades, and local progress persistence. It uses an original canvas scene drawn in code; it loads no external assets or libraries and does not call advertising services.

## Verify

```powershell
node "G:\0_PROGRAMS\opencode-2.2.1\config\opencode\skills\web-gate\scripts\page-check.mjs" ".\index.html" --wait 30000 --fps
node .\smoke-check.cjs
```
