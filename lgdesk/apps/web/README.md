This is the [Next.js](https://nextjs.org) app for LG Desk, part of the `lgdesk` npm workspaces monorepo (see the root [`README.md`](../../README.md) and [`DEPLOY.md`](../../DEPLOY.md)). This repo uses **npm workspaces only** — no pnpm, yarn, or bun.

## Getting Started

From the `lgdesk/` monorepo root, run both apps:

```bash
npm run dev
```

Or run just this app:

```bash
npm run dev --workspace=apps/web
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load **Montserrat** (see `CLAUDE.md`'s Design System section) — not the `create-next-app` default Geist font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
