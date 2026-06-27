# Split the Bill

A mobile-first web app for splitting restaurant receipts. Take a photo, assign items to people, and see exactly what everyone owes.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Mobile)                   │
│                                                      │
│  /  (Home)                /split (Split UI)          │
│  ┌──────────────┐         ┌──────────────────────┐   │
│  │ Camera/Upload│         │ People strip         │   │
│  │ Saved groups │  ─────▶ │ Items tab            │   │
│  └──────────────┘         │ Summary tab          │   │
│                           └──────────────────────┘   │
│                                                      │
│  sessionStorage: receipt JSON (page-to-page)         │
│  localStorage:  saved groups (name + phone list)     │
└─────────────────────┬───────────────────────────────┘
                      │ POST /api/parse-receipt
                      ▼
┌─────────────────────────────────────────────────────┐
│               Next.js API Route (server)             │
│                                                      │
│  Receives image → base64 encodes → calls Claude      │
└─────────────────────┬───────────────────────────────┘
                      │ Anthropic SDK
                      ▼
┌─────────────────────────────────────────────────────┐
│            Claude claude-opus-4-8 (Vision)           │
│                                                      │
│  Extracts: restaurant name, line items (name+price), │
│  subtotal, tax, tip, total                           │
└─────────────────────────────────────────────────────┘
```

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Receipt parsing | Claude claude-opus-4-8 via Anthropic SDK |
| Persistence | localStorage (saved groups only — sessions are stateless) |

## Data flow

1. User takes/uploads a photo on the home screen
2. Image is `POST`ed to `/api/parse-receipt` as `multipart/form-data`
3. Server base64-encodes the image and sends it to Claude Vision
4. Claude returns structured JSON: `{ restaurantName, items[], subtotal, tax, tip, total }`
5. Receipt is stored in `sessionStorage` and the user is navigated to `/split`
6. On `/split`, users add people (name + phone), then tap each item to assign it to one or more people
7. Tax and tip are prorated proportionally to each person's share of the assigned subtotal
8. The Summary tab shows each person's total owed and itemized breakdown

## Splitting logic

```
personShare = sum(item.price / item.assignedTo.length)  for each assigned item
fraction    = personShare / totalAssignedSubtotal
personTotal = personShare + fraction * (tax + tip)
```

Items split between multiple people are divided evenly. Tax and tip are prorated by food share.

## Setup

```bash
git clone <repo>
cd dining
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Get an API key at [console.anthropic.com](https://console.anthropic.com).
