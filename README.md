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
