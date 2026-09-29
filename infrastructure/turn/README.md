# ConsciOS Internet Swarm TURN

Internet swarm pairing still uses **QR/link offer-answer signaling**. TURN is only a WebRTC relay fallback; it is not a signaling, account, database, or cognitive service.

## Recommended layout

```text
ConsciOS browser A ─┐
                    ├─ direct WebRTC when possible
ConsciOS browser B ─┘

If direct ICE fails:
A ⇄ coturn ⇄ B

Temporary credential request:
browser → HTTPS credential worker → timestamped coturn REST username/password
```

## Security properties

- `TURN_SHARED_SECRET` exists only on coturn and the credential worker.
- Browser credentials are short-lived (10 minutes by default).
- QR/link invitations never contain the permanent TURN secret.
- TURN sees relay metadata and WebRTC packets, but ConsciOS application payloads are additionally AES-GCM encrypted with an ephemeral ECDH/HKDF session key.
- `Internet · private relay` uses WebRTC `iceTransportPolicy: relay` so only TURN relay candidates are considered.
- A safety code derived from both ephemeral public keys detects offer/answer substitution when users compare the code out-of-band.

## Minimal deployment

1. Create a small VM with a public IPv4/IPv6 address and DNS name such as `turn.example.com`.
2. Install coturn and copy `coturn.conf.example` to the system coturn configuration.
3. Generate a long random shared secret and place it in the coturn config as `static-auth-secret`.
4. Configure TLS certificates and firewall rules for 3478 UDP/TCP, 5349 TCP, and the configured relay UDP range.
5. Deploy `../turn-credentials/worker.mjs` behind HTTPS.
6. Store the *same* secret as `TURN_SHARED_SECRET` in the worker's encrypted secret store.
7. Restrict `ALLOWED_ORIGINS` to the ConsciOS origin(s), not `*`, for production.
8. Enter the worker URL in ConsciOS under **TURN credential endpoint**.

The credential worker implements coturn's time-limited REST credential convention: `expiry:user` plus an HMAC-SHA1 credential generated from the shared secret. This is compatibility HMAC for TURN authentication; ConsciOS session encryption itself uses ECDH P-256, HKDF-SHA256, and AES-256-GCM.

## Modes

- **Nearby / same Wi-Fi** — no ICE infrastructure.
- **Internet · direct preferred** — public STUN only, no relay fallback.
- **Internet · reliable** — STUN plus short-lived TURN fallback.
- **Internet · private relay** — TURN only (`iceTransportPolicy: relay`).

## Managed TURN

The browser contract is intentionally provider-neutral. A managed TURN credential service can be used instead of coturn if it returns:

```json
{
  "iceServers": [
    {
      "urls": ["turn:turn.example.com:3478?transport=udp"],
      "username": "temporary-user",
      "credential": "temporary-password"
    }
  ],
  "expiresAt": 1790000000000
}
```

Do not put permanent managed-service API tokens in browser JavaScript.
