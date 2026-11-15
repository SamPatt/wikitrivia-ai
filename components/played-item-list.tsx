import React, { useLayoutEffect, useRef, useState } from "react";
import { Item } from "../types/item";
import ItemCard from "./item-card";
import styles from "../styles/played-item-list.module.scss";

interface PlayedItemListProps {
  badlyPlacedIndex: number | null;
  items: Item[];
  latestId: string | null; // the card that just landed: stays blue and glows until the next one
}

// Native card size (see item-card.module.scss) and gap between cards, before scaling.
const CARD_W = 150;
const CARD_H = 200;
const GAP = 16;
const FLY_MS = 220;

/** Largest scale (<= 1) at which `n` cards fit in a w x h box, wrapping into rows. */
function fitScale(n: number, w: number, h: number) {
  if (!n || !w || !h) return 1;
  for (let s = 1; s > 0.15; s -= 0.01) {
    const cw = CARD_W * s, ch = CARD_H * s, g = GAP * s;
    const cols = Math.max(1, Math.floor((w + g) / (cw + g)));
    const rows = Math.ceil(n / cols);
    if (rows * ch + (rows - 1) * g <= h) return s;
  }
  return 0.15;
}

export default function PlayedItemList(props: PlayedItemListProps) {
  const { items, latestId } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const prevRects = useRef(new Map<string, DOMRect>());

  // Track the space available so the cards always fit on screen.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth - 32, h: el.clientHeight - 32 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale(items.length, box.w, box.h);

  // FLIP: every card animates from where it was (or, for the new card, from the
  // "next card" slot at the top) to where it is now.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const source = document.querySelector("[data-next-slot]")?.getBoundingClientRect();
    const slots = Array.from(el.querySelectorAll<HTMLElement>("[data-card-id]"));
    const next = new Map<string, DOMRect>();

    for (const slot of slots) {
      const id = slot.dataset.cardId!;
      const to = slot.getBoundingClientRect();
      next.set(id, to);
      const from = prevRects.current.get(id) ?? (prevRects.current.size || items.length > 1 ? source : undefined);
      if (!from || reduced) continue;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const ds = from.width / to.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(ds - 1) < 0.01) continue;
      const isNew = !prevRects.current.has(id);
      slot.style.transition = "none";
      slot.style.transformOrigin = "top left";
      slot.style.transform = `translate(${dx}px, ${dy}px) scale(${ds})`;
      slot.style.zIndex = isNew ? "10" : "";
      // Force the start frame, then let it glide home.
      void slot.offsetWidth;
      slot.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      slot.style.transform = "";
      if (isNew) setTimeout(() => (slot.style.zIndex = ""), FLY_MS);
    }
    prevRects.current = next;
  }, [items, scale]);

  return (
    <div className={styles.wrapper} ref={boxRef}>
      <div className={styles.items} style={{ gap: `${GAP * scale}px` }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            data-card-id={item.id}
            className={styles.slot}
            style={{ width: CARD_W * scale, height: CARD_H * scale }}
          >
            <div className={styles.scaler} style={{ transform: `scale(${scale})` }}>
              <ItemCard item={item} index={index} latest={item.id === latestId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
