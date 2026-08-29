# GrkBotOffice

FamBash HQ is a live isometric pixel-art office. Four bots sit at their home desks. A talk event with a `targetBotId` sends that bot walking across the floor; every other event keeps them idle at home.

## Run

```bash
git clone https://github.com/TheyChantAndrew/GrkBotOffice.git
cd GrkBotOffice
npm install
npm run dev
```

Open [http://localhost:43173](http://localhost:43173).

## API

Event shape:

```ts
{
  botId: "value" | "sideline" | "fambash" | "building-manager",
  type: "status" | "report" | "talk" | "idle",
  text?: string,
  targetBotId?: "value" | "sideline" | "fambash" | "building-manager",
  at?: string
}
```

`POST /api/events` records an event. `GET /api/state` returns bot positions, speech, and recent events.

Talk plus `targetBotId` makes that target bot walk to the speaker's desk, then return home. `status`, `report`, and `idle` leave bots at their desks.

### Example curl

```bash
curl -X POST http://localhost:43173/api/events \
  -H "Content-Type: application/json" \
  -d '{"botId":"fambash","type":"talk","text":"Need the latest rankings.","targetBotId":"value","at":"2026-08-29T16:00:00.000Z"}'
```

```bash
curl http://localhost:43173/api/state
```

## Bots

| `botId`            | Role            | Home desk                         |
| ------------------ | --------------- | --------------------------------- |
| `fambash`          | GM              | Glass office, back-right          |
| `value`            | Rankings scout  | Front-left analytics desk         |
| `sideline`         | Injury scout    | Front-right medical desk          |
| `building-manager` | Building manager | Window desk, left                |

## File ingest

Drop events on disk and the office will pick them up:

- `data/inbox.jsonl` — one JSON event per line
- `data/feed.json` — a single event object or an array of events

See `data/feed.example.json` for a sample payload.

## Pixel assets

- `public/office-pixel-bg.png` — isometric floor
- `public/bot-sprites.png` — FamBash, Value, Sideline, Building Manager (left to right)
- `public/sprites/` — cropped transparent sprites used on the floor
