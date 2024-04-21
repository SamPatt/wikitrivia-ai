import React from "react";
import { Item } from "../types/item";
import ItemCard from "./item-card";
import styles from "../styles/next-item-list.module.scss";

interface NextItemListProps {
  next: Item | null;
}

export default function NextItemList(props: NextItemListProps) {
  const { next } = props;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.list}>
          {next && (
            <ItemCard index={0} item={next} key={next.id} />
          )}
        </div>
      </div>
    </div>
  );
}