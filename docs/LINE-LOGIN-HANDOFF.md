# LINE Login local integration — not activated

Baseline:15f3005. Existing password login/register/join remains available. No LINE channel, token, secret, OAuth grant, paid service or new account configuration was created. Current local /api/line/config returns enabled:false. LINE_CHANNEL_ID, LINE_CHANNEL_SECRET and LINE_REDIRECT_URI are absent from the execution environment; the existing Wrangler file is unchanged. This does not establish whether an existing LINE channel exists elsewhere.

## Implemented and tested locally

- Configuration-gated authorization-code flow, exact same-origin HTTPS callback, state + browser HttpOnly proof cookie, nonce and S256 PKCE.
- Server exchanges the code once, then verifies the ID token through LINE; issuer, channel, nonce, expiry and subject are checked. A15-second total network deadline, no automatic retry, one-time consumed callback,10-minute transaction expiry,100 active transactions and expired cleanup on a new start.
- Only openid/profile scopes. No email, bot, friend prompt, SDK, remote profile-image request or additional permission. Tokens/refresh tokens are not persisted or logged. LINE identity never comes from browser-submitted profile claims.
- Existing signed-in family members can link LINE; new LINE users can create a family or accept an existing one-use invitation. Revoked LINE members require a fresh original-family invitation; membership IDs/history remain and old sessions remain invalid.
- Optional buttons are mounted only after the configured flag is true and the original form/page still exists. Unconfigured LINE adds no visible step or control. Current real browser checks therefore cover the original login and member UI, not a real LINE authorization screen.

## Precise remaining external setup

No setup is performed in this local-only task. Before real activation, the account maintainer must identify an existing LINE Login Web channel and securely configure its existing Channel ID/Channel Secret for the Worker. Do not send the secret in chat or commit it. Configure LINE_REDIRECT_URI exactly as:

    https://travelos-baby-daily-preview.chao-jason.workers.dev/api/line/callback

The same callback must be registered in that existing channel's LINE Login settings. Channel access must already permit the intended test account. If it needs a new channel, broader access, publication or new credentials, stop for the relevant Owner decision. Do not silently create them.

Deployment/configuration of this new integration is not authorized by this task. The current live site still runs15f3005 and does not have this callback. A future approved deployment and real-account test are needed to establish LINE SSO/callback cookies, mobile Safari/LINE webview and any provider-consent behavior. Local stub tests do not prove those.

Sources: [LINE web login](https://developers.line.biz/en/docs/line-login/integrate-line-login/), [PKCE](https://developers.line.biz/en/docs/line-login/integrate-pkce/), [server ID-token verification](https://developers.line.biz/en/reference/line-login/#verify-id-token).
