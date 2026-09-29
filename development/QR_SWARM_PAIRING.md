# QR/link swarm pairing

This document describes LCS-1/LCS-1b for ConsciOS issue #72 and #85.

## User flow

1. Person A opens `/local/swarm/`, chooses a connection mode, and creates an invitation.
2. ConsciOS creates an ephemeral P-256 ECDH key pair and a WebRTC offer, waits for complete non-trickle ICE gathering, compresses the envelope in-browser, and puts it in a QR/link URL fragment.
3. Person B scans the QR or opens the link, reviews the host/network/relay information, and explicitly joins.
4. Person B independently obtains any required short-lived TURN credential, generates its own ephemeral key pair, creates a WebRTC answer, and returns the answer as a QR/link.
5. Person A scans/opens the answer; a same-origin helper tab can relay the answer to the original host tab with `BroadcastChannel` / `storage`, or the full answer link can be pasted manually.
6. Both peers derive the same AES-256-GCM application key from ECDH + HKDF-SHA256 and derive the same human-readable safety code from the session and both public keys.
7. Local mode confirms automatically because the two-QR physical flow is already proximity-bound. Internet modes require the people to compare and confirm the safety code before capability/exo metadata is released.
8. Once trusted, peers exchange only bounded capability manifests, peer display names, optional shared exo configuration, encrypted ping/pong, and later explicitly governed swarm messages.

## Connection modes

### Nearby / same Wi-Fi

- `iceServers: []`
- `iceTransportPolicy: all`
- no STUN/TURN infrastructure
- direct local ICE candidates only

### Internet · direct preferred

- configurable STUN, default `stun:stun.cloudflare.com:3478`
- no TURN relay fallback
- best when NAT/firewall behavior permits direct peer-to-peer WebRTC

### Internet · reliable

- STUN plus temporary TURN credentials
- `iceTransportPolicy: all`
- direct path preferred, TURN can relay when necessary

### Internet · private relay

- temporary TURN credentials required
- `iceTransportPolicy: relay`
- only relayed candidates are considered, avoiding a direct WebRTC path between the peers

Internet mode still has **no ConsciOS signaling server**. STUN/TURN solve transport reachability only. Offer/answer signaling remains the QR/link exchange.

## Cryptographic boundary

WebRTC DataChannels already use DTLS. ConsciOS additionally encrypts each application frame:

1. each peer generates an ephemeral non-exported P-256 ECDH private key;
2. only the raw public key is placed in the invitation/answer;
3. both peers derive the ECDH shared secret;
4. HKDF-SHA256 derives an AES-256-GCM key using the swarm session ID as salt/domain separation;
5. every application frame receives a fresh 96-bit random GCM IV and session-bound additional authenticated data;
6. the application key and private keys are memory-only and discarded on close.

A short safety code is SHA-256-derived from the session ID plus both public keys in canonical order. A signaling-substitution attacker cannot make both peers see the same safety code without participating in the key exchange; users should compare it over voice/video or another trusted channel for internet sessions.

This does not turn a compromised browser/device into a trusted environment. Endpoint security, browser integrity, and trusted-origin hygiene still matter.

## TURN credentials

Permanent TURN secrets are forbidden from static browser code, QR payloads, notebook state, or local storage.

For self-hosted coturn, `infrastructure/turn-credentials/worker.mjs` implements the coturn REST convention using short-lived timestamped usernames and HMAC-SHA1 credentials. HMAC-SHA1 here is required for TURN REST compatibility; swarm payload encryption uses ECDH/HKDF-SHA256/AES-GCM instead.

The credential endpoint must be HTTPS in production, must restrict CORS to the ConsciOS origin, and should return only temporary `iceServers` credentials. See `infrastructure/turn/README.md`.

## Privacy boundary

Pairing data is stored in a URL **fragment** (`#offer=` or `#answer=`), which normal HTTP requests do not send to the static page host. The envelope can contain public SDP/ICE candidates, ephemeral public keys, the selected credential-service URL, and an explicitly shared exo endpoint. Treat invitation links as temporary private session material despite their short lifetime.

TURN providers can observe relay metadata such as source/destination timing and bandwidth. In private mode peers avoid a direct WebRTC path, but the TURN service necessarily becomes a transport intermediary. Application payloads remain encrypted end-to-end by ConsciOS in addition to WebRTC transport encryption.

## Relation to exo

Browser swarm pairing does **not** make a phone browser a native exo worker. It establishes consent, authenticated encrypted transport, capability exchange, and shared exo-provider configuration. Native exo continues to provide its own distributed model execution. Later LCS gates may add a separately governed `BrowserSwarmProvider` for actual browser compute contribution.

exo upstream: https://github.com/exo-explore/exo

exo license: Apache License 2.0, Copyright 2025 Exo Technologies Ltd.

## QR renderer attribution

QR rendering uses `qrcode-generator` by Kazuhiko Arase as a static browser dependency pinned to commit `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8`.

License: MIT License, Copyright (c) 2009 Kazuhiko Arase.

The library code is fetched from jsDelivr, but the pairing payload is encoded locally and is not submitted to that CDN by ConsciOS.

## Limitations

- Direct internet connectivity can fail behind symmetric NAT, carrier-grade NAT, enterprise firewalls, or UDP restrictions; Reliable mode exists for this reason.
- TURN availability, DNS, certificates, firewall configuration, and credential-service availability remain operational dependencies.
- A two-person QR/link handshake does not provide multi-party rendezvous. More than two peers will need an explicit topology/bootstrap design.
- The short display/session code is an identity aid, not a lookup service.
- This layer validates authenticated transport, not distributed-inference speed or cognition.
