"use client";

import { useEffect, useMemo, useState } from "react";
import { BOT_META } from "@/lib/office";
import type { BotState, OfficeState } from "@/lib/types";

const EMPTY: OfficeState = { bots: [], events: [], now: "" };

export function Office() {
  const [state, setState] = useState<OfficeState>(EMPTY);

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
    const timer = window.setInterval(pull, 400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const recent = useMemo(() => [...state.events].reverse().slice(0, 12), [state.events]);

  return (
    <div className="app">
      <div className="stage-wrap">
        <div className="stage">
          <img className="floor" src="/office-pixel-bg.png" alt="FamBash HQ isometric office" />
          {state.bots.map((bot) => (
            <BotMarker key={bot.id} bot={bot} />
          ))}
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

function BotMarker({ bot }: { bot: BotState }) {
  const meta = BOT_META[bot.id];
  return (
    <div
      className={`bot${bot.status === "walking" ? " is-walking" : ""}`}
      style={{ left: `${bot.x * 100}%`, top: `${bot.y * 100}%`, zIndex: Math.round(bot.y * 100) }}
    >
      {bot.speech ? <div className="speech">{bot.speech}</div> : null}
      <img className="bot-sprite" src={meta.sprite} alt={bot.name} />
      <div className="bot-label">{bot.name.toUpperCase()}</div>
    </div>
  );
}
