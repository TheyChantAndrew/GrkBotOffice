export const BOT_IDS = [
  "value",
  "sideline",
  "fambash",
  "building-manager"
] as const;

export const EVENT_TYPES = ["status", "report", "talk", "idle"] as const;

export type BotId = (typeof BOT_IDS)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export type OfficeEvent = {
  botId: BotId;
  type: EventType;
  text?: string;
  targetBotId?: BotId;
  at: string;
};

export type BotStatus = "idle" | "walking" | "talking";

export type BotState = {
  id: BotId;
  name: string;
  role: string;
  status: BotStatus;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  destX: number;
  destY: number;
  walkingTo: BotId | null;
  speech: string | null;
  lastEventAt: string | null;
};

export type OfficeState = {
  bots: BotState[];
  events: OfficeEvent[];
  now: string;
};

export function isBotId(value: unknown): value is BotId {
  return typeof value === "string" && (BOT_IDS as readonly string[]).includes(value);
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}
