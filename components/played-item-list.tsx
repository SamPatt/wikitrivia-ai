import React from "react";
import { Item } from "../types/item";
import ItemCard from "./item-card";
import styles from "../styles/played-item-list.module.scss";

interface PlayedItemListProps {
  badlyPlacedIndex: number | null;
  items: Item[];
}

export default function PlayedItemList(props: PlayedItemListProps) {
  const { badlyPlacedIndex, items } = props;

  return (
    <div className={styles.wrapper}>
      <div className={styles.listContainer}>
        <div className={styles.timelineContainer}>
          <div className={styles.timeline}></div>
        </div>
        <div className={styles.items}>
          {items.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
