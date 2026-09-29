# Serverless QR swarm pairing

This document describes the first LCS-1 implementation for ConsciOS issue #72.

## User flow

1. Phone A opens `/local/swarm/` and creates a swarm invitation.
2. ConsciOS creates a WebRTC offer using `RTCPeerConnection({iceServers: []})`, waits for local ICE gathering, compresses the invitation in-browser, and encodes it into the QR URL fragment.
3. Phone B scans the offer QR with the normal camera app, reviews the consent screen, and taps **Join swarm**.
4. Phone B creates a WebRTC answer and renders it as a second QR.
5. Phone A scans the answer QR. The newly opened same-origin tab passes the answer to the original host tab with `BroadcastChannel` / `storage` messaging.
6. The two original tabs establish a direct WebRTC DataChannel and exchange bounded capability manifests, peer display names, the optional shared exo endpoint, and ping/pong RTT messages.

No signaling server, websocket rendezvous service, account, database, STUN server, or TURN relay is configured in this first same-LAN implementation.

## Privacy boundary

The QR payload is placed in a URL **fragment** (`#offer=` or `#answer=`). Browser URL fragments are not sent in normal HTTP requests to the static page host. The invitation contains the temporary WebRTC session description and may contain the LAN exo endpoint chosen by the host, so users should still treat a pairing QR/link as temporary private session material.

The session invitation expires after 15 minutes. Room membership is revocable by closing/leaving the swarm. Peers exchange only the bounded manifest currently implemented by `capabilityManifest()`; no photos, arbitrary files, repository context, credentials, or cognitive-role authority are granted.

## Relation to exo

This first slice does **not** make a phone browser a native exo worker. It makes phone-to-phone consent, discovery, direct transport, and shared exo-provider configuration easy. Native exo continues to provide distributed model execution. Later LCS gates may add a separately governed `BrowserSwarmProvider` for actual browser compute contribution.

exo upstream: https://github.com/exo-explore/exo

exo license: Apache License 2.0, Copyright 2025 Exo Technologies Ltd.

## QR renderer attribution

QR rendering uses `qrcode-generator` by Kazuhiko Arase as a static browser dependency pinned to commit `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8`:

https://github.com/kazuhikoarase/qrcode-generator

License: MIT License, Copyright (c) 2009 Kazuhiko Arase.

The library code is fetched from jsDelivr, but the pairing payload is supplied to the QR encoder locally in the browser and is not sent to the CDN by ConsciOS.

## Same-LAN limitations

With `iceServers: []`, peers rely on direct local ICE candidates. Networks with client isolation, restrictive enterprise Wi-Fi, browser/platform WebRTC limitations, or incompatible mDNS candidate behavior may prevent pairing. The correct failure mode is explicit connection failure; the application does not silently introduce a relay.

The fallback remains copying the full offer/answer pairing link between devices. A short six-character room code alone cannot resolve a WebRTC session without some rendezvous mechanism, so the displayed short code is an identity/check aid rather than a server-resolved locator.
