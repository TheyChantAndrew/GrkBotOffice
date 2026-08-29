import type { BotId, BotState } from "./types";

export const OFFICE_SIZE = { width: 1536, height: 1024 };

/** Home desks as fractions of the isometric floor image. */
export const HOME_DESKS: Record<BotId, { x: number; y: number }> = {
  "building-manager": { x: 0.2, y: 0.34 },
  fambash: { x: 0.76, y: 0.3 },
  value: { x: 0.22, y: 0.74 },
  sideline: { x: 0.78, y: 0.74 }
};

export const BOT_META: Record<
  BotId,
  { name: string; role: string; sprite: string }
> = {
  fambash: {
    name: "FamBash",
    role: "GM · glass office, back-right",
    sprite: "/sprites/fambash.png"
  },
  value: {
    name: "Value",
    role: "Rankings scout · front-left analytics desk",
    sprite: "/sprites/value.png"
  },
  sideline: {
    name: "Sideline",
    role: "Injury scout · front-right medical desk",
    sprite: "/sprites/sideline.png"
  },
  "building-manager": {
    name: "Building Manager",
    role: "Facilities · window desk, left",
    sprite: "/sprites/building-manager.png"
  }
};

export function createBot(id: BotId): BotState {
  const home = HOME_DESKS[id];
  const meta = BOT_META[id];
  return {
    id,
    name: meta.name,
    role: meta.role,
    status: "idle",
    x: home.x,
    y: home.y,
    homeX: home.x,
    homeY: home.y,
    destX: home.x,
    destY: home.y,
    speech: null,
    lastEventAt: null
  };
}
