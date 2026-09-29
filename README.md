# EM2 belief-updating demo

A Next.js App Router prototype for the yoked belief-authorship experiment.

## Included flow

- Demo selector for self-generated and provided-belief conditions
- Identical, seeded calibration evidence across conditions
- Constrained hypothesis entry for the self-generated condition
- Standardized evidence review for both members of a yoked pair
- Initial 0–100 confidence rating
- Five evidence blocks with declining diagnostic support
- Repeated confidence ratings and a final trajectory visualization
- JSON session export

The interface follows Graphite's onboarding language: warm off-white canvas, compact typography, thin borders, soft shadows, pale lavender selection states, and small stroked buttons.

## Run locally

Node.js 20.9 or newer is required.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Prototype boundaries

This version is deliberately front-end only. Condition assignment, participant authentication, cross-device yoking, durable response storage, consent, and researcher administration should be added before it is used to collect study data.

The stimulus sequences are deterministic and controlled by the number of diagnostic antecedent → outcome opportunities in each block. That makes the demo reproducible and ensures yoked participants can receive literally identical realized evidence.
