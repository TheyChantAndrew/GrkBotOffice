import {
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  statSync,
  readFileSync,
  appendFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { BOT_IDS, isBotId, isEventType, type BotId, type BotState, type OfficeEvent, type OfficeState } from "./types";
import { createBot, HOME_DESKS } from "./office";

const DATA_DIR = path.join(process.cwd(), "data");
const INBOX_PATH = path.join(DATA_DIR, "inbox.jsonl");
const FEED_PATH = path.join(DATA_DIR, "feed.json");
const EVENTS_PATH = path.join(DATA_DIR, "events.jsonl");
const RUNTIME_PATH = path.join(DATA_DIR, "runtime-state.json");

export const WALK_SPEED = 0.22;
const ARRIVE_EPS = 0.01;
const TALK_HOLD_MS = 20000;
const MAX_EVENTS = 200;

type InternalBot = BotState & { returnAt: number | null };

type Memory = {
  bots: Record<BotId, InternalBot>;
  events: OfficeEvent[];
  lastTick: number;
  inboxOffset: number;
  feedHash: string;
};

function emptyMemory(): Memory {
  const bots = {} as Record<BotId, InternalBot>;
  for (const id of BOT_IDS) {
    bots[id] = { ...createBot(id), returnAt: null };
  }
  return {
    bots,
    events: [],
    lastTick: Date.now(),
    inboxOffset: 0,
    feedHash: ""
  };
}

const globalStore = globalThis as typeof globalThis & { __fambashOffice?: Memory };

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hydrateBot(raw: InternalBot): InternalBot {
  const base = createBot(raw.id);
  return {
    ...base,
    ...raw,
    walkingTo: raw.walkingTo ?? null,
    returnAt: raw.returnAt ?? null
  };
}

function readSnapshot(): Memory | null {
  if (!existsSync(RUNTIME_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(RUNTIME_PATH, "utf8")) as Memory;
    const mem = emptyMemory();
    mem.lastTick = typeof parsed.lastTick === "number" ? parsed.lastTick : Date.now();
    mem.inboxOffset = typeof parsed.inboxOffset === "number" ? parsed.inboxOffset : 0;
    mem.feedHash = typeof parsed.feedHash === "string" ? parsed.feedHash : "";
    mem.events = Array.isArray(parsed.events) ? parsed.events.filter((e) => normalizeEvent(e)) : [];
    for (const id of BOT_IDS) {
      if (parsed.bots?.[id]) mem.bots[id] = hydrateBot(parsed.bots[id]);
    }
    return mem;
  } catch {
    return null;
  }
}

function writeSnapshot(mem: Memory) {
  ensureDataDir();
  writeFileSync(RUNTIME_PATH, JSON.stringify(mem), "utf8");
}

function loadEventLogOnly(mem: Memory) {
  if (!existsSync(EVENTS_PATH)) return;
  const lines = readFileSync(EVENTS_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const event = parseEventLine(line);
    if (event) mem.events.push(event);
  }
  if (mem.events.length > MAX_EVENTS) {
    mem.events.splice(0, mem.events.length - MAX_EVENTS);
  }
}

function memory(): Memory {
  if (!globalStore.__fambashOffice) {
    globalStore.__fambashOffice = readSnapshot() ?? emptyMemory();
    if (!existsSync(RUNTIME_PATH)) {
      loadEventLogOnly(globalStore.__fambashOffice);
    }
  }
  return globalStore.__fambashOffice;
}

function syncFromDisk() {
  const disk = readSnapshot();
  if (disk) {
    globalStore.__fambashOffice = disk;
    return;
  }
  memory();
}

function persistEvent(event: OfficeEvent) {
  ensureDataDir();
  appendFileSync(EVENTS_PATH, `${JSON.stringify(event)}\n`, "utf8");
}

function parseEventLine(line: string): OfficeEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return normalizeEvent(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function normalizeEvent(raw: unknown): OfficeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (!isBotId(body.botId) || !isEventType(body.type)) return null;

  const event: OfficeEvent = {
    botId: body.botId,
    type: body.type,
    at: typeof body.at === "string" && body.at ? body.at : new Date().toISOString()
  };

  if (typeof body.text === "string" && body.text.trim()) {
    event.text = body.text.trim();
  }
  if (isBotId(body.targetBotId)) {
    event.targetBotId = body.targetBotId;
  }
  return event;
}

function deskOwner(x: number, y: number): BotId | null {
  for (const id of BOT_IDS) {
    const desk = HOME_DESKS[id];
    if (Math.hypot(x - desk.x, y - desk.y) < 0.04) return id;
  }
  return null;
}

function refreshWalkMeta(bot: InternalBot) {
  const destOwner = deskOwner(bot.destX, bot.destY);
  const atHome = Math.hypot(bot.destX - bot.homeX, bot.destY - bot.homeY) < ARRIVE_EPS;
  bot.walkingTo = atHome || destOwner === bot.id ? null : destOwner;
}

function advanceBots(now = Date.now()) {
  const mem = memory();
  const dt = Math.min(0.25, Math.max(0, (now - mem.lastTick) / 1000));
  mem.lastTick = now;

  for (const bot of Object.values(mem.bots)) {
    const dx = bot.destX - bot.x;
    const dy = bot.destY - bot.y;
    const dist = Math.hypot(dx, dy);

    if (dist > ARRIVE_EPS) {
      const step = WALK_SPEED * dt;
      const t = Math.min(1, step / dist);
      bot.x += dx * t;
      bot.y += dy * t;
      bot.status = "walking";
      refreshWalkMeta(bot);
      continue;
    }

    bot.x = bot.destX;
    bot.y = bot.destY;

    if (bot.returnAt && now >= bot.returnAt) {
      bot.destX = bot.homeX;
      bot.destY = bot.homeY;
      bot.returnAt = null;
      bot.status = "walking";
      refreshWalkMeta(bot);
      continue;
    }

    refreshWalkMeta(bot);
    const atHome = Math.hypot(bot.x - bot.homeX, bot.y - bot.homeY) < ARRIVE_EPS;
    if (atHome && !bot.speech) {
      bot.status = "idle";
    } else {
      bot.status = bot.speech ? "talking" : "idle";
    }
  }
}

function sendHome(bot: InternalBot) {
  bot.destX = bot.homeX;
  bot.destY = bot.homeY;
  bot.returnAt = null;
  refreshWalkMeta(bot);
}

function applyEvent(event: OfficeEvent, opts: { persist: boolean }) {
  const mem = memory();
  advanceBots();

  const speaker = mem.bots[event.botId];
  speaker.lastEventAt = event.at;

  if (event.type === "idle") {
    speaker.speech = null;
    sendHome(speaker);
  } else if (event.text) {
    speaker.speech = event.text;
  }

  if (event.type === "talk" && event.targetBotId && event.targetBotId !== event.botId) {
    const walker = mem.bots[event.targetBotId];
    const targetDesk = HOME_DESKS[event.botId];
    walker.destX = targetDesk.x;
    walker.destY = targetDesk.y;
    walker.returnAt = Date.now() + TALK_HOLD_MS;
    walker.lastEventAt = event.at;
    walker.status = "walking";
    refreshWalkMeta(walker);
  }

  if (event.type !== "talk" && event.type !== "idle") {
    sendHome(speaker);
  }

  mem.events.push(event);
  if (mem.events.length > MAX_EVENTS) {
    mem.events.splice(0, mem.events.length - MAX_EVENTS);
  }

  if (opts.persist) persistEvent(event);
  writeSnapshot(mem);
}

function ingestInbox() {
  if (!existsSync(INBOX_PATH)) return;
  const mem = memory();
  const size = statSync(INBOX_PATH).size;
  if (size < mem.inboxOffset) mem.inboxOffset = 0;
  if (size === mem.inboxOffset) return;

  const length = size - mem.inboxOffset;
  const buf = Buffer.alloc(length);
  const fd = openSync(INBOX_PATH, "r");
  readSync(fd, buf, 0, length, mem.inboxOffset);
  closeSync(fd);

  const text = buf.toString("utf8");
  const parts = text.split(/\r?\n/);
  const complete = text.endsWith("\n") ? parts : parts.slice(0, -1);
  const consumed = text.endsWith("\n")
    ? text.length
    : text.length - (parts.at(-1)?.length ?? 0);

  for (const line of complete) {
    const event = parseEventLine(line);
    if (event) applyEvent(event, { persist: true });
  }
  mem.inboxOffset += consumed;
  writeSnapshot(mem);
}

function ingestFeed() {
  if (!existsSync(FEED_PATH)) return;
  const raw = readFileSync(FEED_PATH, "utf8");
  const mem = memory();
  if (raw === mem.feedHash) return;
  mem.feedHash = raw;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const event = normalizeEvent(item);
      if (event) applyEvent(event, { persist: true });
    }
  } catch {
    // ignore malformed feed until the next write
  }
}

export function recordEvent(raw: unknown): { event: OfficeEvent } | { error: string } {
  const event = normalizeEvent(raw);
  if (!event) {
    return {
      error:
        "Expected { botId: value|sideline|fambash|building-manager, type: status|report|talk|idle, text?, targetBotId?, at? }"
    };
  }
  syncFromDisk();
  ingestInbox();
  ingestFeed();
  applyEvent(event, { persist: true });
  return { event };
}

export function getState(): OfficeState {
  syncFromDisk();
  ingestInbox();
  ingestFeed();
  advanceBots();
  const mem = memory();
  writeSnapshot(mem);
  return {
    bots: BOT_IDS.map((id) => {
      const bot = mem.bots[id];
      const { returnAt: _returnAt, ...publicBot } = bot;
      return publicBot;
    }),
    events: mem.events.slice(-50),
    now: new Date().toISOString()
  };
}
