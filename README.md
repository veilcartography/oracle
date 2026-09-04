# The Gnostic Gospels Oracle

Live at **https://veilcartography.github.io/oracle/**

Ask questions of the Nag Hammadi library and get answers grounded in 352 passages
across 12 Gnostic texts.

## This repo is build output only

Do not edit these files by hand — they are generated. The source lives in the
private `gnostic-gospels-app` repository. To change the app, edit it there and run:

```
VITE_ORACLE_API_URL="https://gnostic-oracle-api.aged-shape-01b4.workers.dev" pnpm build
```

then copy `dist/public/` over this repo and push.

## How it works

Retrieval happens in your browser: the page loads the knowledge base, indexes it,
and finds the passages most relevant to your question. Those passages are sent to a
small Cloudflare Worker (`oracle-api` in the source repo) which asks Claude to write
the answer. No account, no database, no tracking.
