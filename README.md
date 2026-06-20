# LinguaFlash — local JSON storage version

## Setup

1. Make sure your `tsconfig.json` has the `@/*` path alias pointing to `src/*`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

If your project doesn't have this, either add it, or replace all `@/...` imports
in the files below with relative paths (e.g. `../../src/types`).

2. Install the one new dependency used for image extraction:

```bash
npm install openai
```

(No `mongodb` package needed anymore — storage is a local JSON file.)

3. Add to `.env.local` (project root):

```
OPENAI_API_KEY=sk-...
```

4. The data file lives at `data/decks.json` (auto-created on first save, starts as `[]`).
   Add it to `.gitignore` if you don't want sample data committed:

```
data/decks.json
```

## File map

| File | Path in your project |
|---|---|
| `app/page.tsx` | `app/page.tsx` |
| `app/page.module.css` | `app/page.module.css` |
| `app/layout.tsx` | `app/layout.tsx` |
| `app/globals.css` | `app/globals.css` |

| `app/api/extract-words/route.ts` | `app/api/extract-words/route.ts` |
| `app/api/decks/route.ts` | `app/api/decks/route.ts` |
| `app/api/decks/[id]/route.ts` | `app/api/decks/[id]/route.ts` |

| `src/lib/deckStore.ts` | `src/lib/deckStore.ts` |

| `src/types/index.ts` | `src/types/index.ts` |

| `src/components/ImageUploader/*` | `src/components/ImageUploader/*` |
| `src/components/SaveDeck/*` | `src/components/SaveDeck/*` |
| `src/components/Flashcards/*` | `src/components/Flashcards/*` |

| `data/decks.json` | `data/decks.json` |
