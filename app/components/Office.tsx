"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOT_META } from "@/lib/office";
import type { BotState, OfficeState } from "@/lib/types";

const EMPTY: OfficeState = { bots: [], events: [], now: "" };
const WALK_SPEED = 0.22;

export function Office() {
  const [state, setState] = useState<OfficeState>(EMPTY);
  const [display, setDisplay] = useState<Record<string, { x: number; y: number }>>({});
  const botsRef = useRef<BotState[]>([]);

  useEffect(() => {
    botsRef.current = state.bots;
  }, [state.bots]);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as OfficeState;
        if (!cancelled) setState(next);
      } catch {
        // keep last frame if the server blips
      }
    }

    pull();
    const timer = window.setInterval(pull, 350);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const bots = botsRef.current;
      if (bots.length) {
        setDisplay((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const bot of bots) {
            const cur = next[bot.id] ?? { x: bot.x, y: bot.y };
            const dx = bot.destX - cur.x;
            const dy = bot.destY - cur.y;
            const dist = Math.hypot(dx, dy);
            let pos = cur;
            if (dist < 0.004) {
              pos = { x: bot.destX, y: bot.destY };
            } else {
              const t = Math.min(1, (WALK_SPEED * dt) / dist);
              pos = { x: cur.x + dx * t, y: cur.y + dy * t };
            }
            if (pos.x !== cur.x || pos.y !== cur.y || !next[bot.id]) {
              next[bot.id] = pos;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const recent = useMemo(() => [...state.events].reverse().slice(0, 12), [state.events]);

  return (
    <div className="app">
      <div className="stage-wrap">
        <div className="stage">
          <img className="floor" src="/office-pixel-bg.png" alt="FamBash HQ isometric office" />
          {state.bots.map((bot) => {
            const pos = display[bot.id] ?? { x: bot.x, y: bot.y };
            const moving =
              bot.status === "walking" ||
              Math.hypot(pos.x - bot.destX, pos.y - bot.destY) > 0.012;
            return <BotMarker key={bot.id} bot={bot} x={pos.x} y={pos.y} walking={moving} />;
          })}
        </div>
      </div>
      <aside className="hud">
        <div>
          <h1 className="brand">FAMBASH HQ</h1>
          <p className="tag">Live office · four bots at their home desks</p>
        </div>
        <ul className="bot-list">
          {state.bots.map((bot) => (
            <li key={bot.id} className="bot-row">
              <strong>{bot.name}</strong>
              <span>
                {bot.status}
                {bot.walkingTo ? ` → ${bot.walkingTo}` : ""}
                {bot.speech ? ` · “${bot.speech}”` : ""}
              </span>
            </li>
          ))}
        </ul>
        <ul className="feed">
          {recent.map((event, index) => (
            <li key={`${event.at}-${index}`} className="feed-item">
              <em>{event.botId}</em> {event.type}
              {event.targetBotId ? ` → ${event.targetBotId}` : ""}
              {event.text ? ` · ${event.text}` : ""}
            </li>
          ))}
        </ul>
        <p className="hint">
          POST <code>/api/events</code> with <code>type: talk</code> and a{" "}
          <code>targetBotId</code> to send that bot walking. Otherwise they idle at home.
        </p>
      </aside>
    </div>
  );
}

function BotMarker({
  bot,
  x,
  y,
  walking
}: {
  bot: BotState;
  x: number;
  y: number;
  walking: boolean;
}) {
  const meta = BOT_META[bot.id];
  return (
    <div
      className={`bot${walking ? " is-walking" : ""}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, zIndex: Math.round(y * 100) }}
    >
      {bot.speech ? <div className="speech">{bot.speech}</div> : null}
      <img className="bot-sprite" src={meta.sprite} alt={bot.name} />
      <div className="bot-label">{bot.name.toUpperCase()}</div>
    </div>
  );
}
