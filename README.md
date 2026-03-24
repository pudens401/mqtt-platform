# MQTT Dash (TCP)

Minimal React + Vite dashboard builder for MQTT.

## Why a bridge server?

Browsers cannot connect to MQTT over raw TCP directly. This project includes a small local Node bridge that connects to your broker via TCP (e.g. `mqtt://host:1883`) and exposes a simple HTTP API + SSE stream to the frontend.

## Run

Install:

```bash
npm install
```

Start bridge + frontend together:

```bash
npm run dev:full
```

Or run them separately:

```bash
npm run dev:server
npm run dev:client
```

Frontend: `http://localhost:5173`

### Expose to your LAN

The dev servers bind to all interfaces. From another device on the same network, open:

- `http://<YOUR_PC_LAN_IP>:5173`

If it doesn’t load, allow inbound traffic in Windows Firewall for ports `5173` (frontend) and `5174` (bridge).

## Use

1. Open the app and go to **Connection**.
2. Enter broker host + port (default 1883), username/password if needed, and a client ID.
3. Go to **Builder** to add widgets and configure topics/payloads.
4. Go to **Dashboard** to interact live.

All widget payloads are JSON-only.

## Deploy on Render

This repo can be deployed as a single Render **Web Service** (the Node bridge serves the built Vite frontend from `dist/`, and the UI calls `/api/*` on the same origin).

### Option A (recommended): Blueprint via `render.yaml`

1. Push this repo to GitHub.
2. In Render: **New** → **Blueprint** → select the repo.
3. Render will create a service named `mqtt-dash` using:
	- Build: `npm install && npm run build`
	- Start: `node server/index.js`

### Option B: Manual Web Service

1. In Render: **New** → **Web Service** → connect the repo.
2. Environment: **Node**
3. Build command: `npm install && npm run build`
4. Start command: `node server/index.js`

### Important: can Render reach your MQTT broker?

The bridge connects to your broker over TCP (`mqtt://host:port`). If your broker is only on your home LAN (e.g. `192.168.x.x`), Render will **not** be able to reach it.

To use Render, your broker must be reachable from the public internet (or via a private network/VPN you control). If you only need LAN access, run the bridge locally with `npm run dev:server`.

### Multi-user behavior

This bridge is now **session-isolated**:

- **One browser session → one MQTT connection** (each user can choose a different broker + MQTT client ID without affecting others).
- The session is tracked via an HttpOnly cookie (`mqtt_dash_sid`).
- Sessions are stored **in-memory** in the Node process with a TTL cleanup.

If you run multiple instances (horizontal scaling), users may land on different instances unless you add sticky sessions or an external session store.
