import React, { useState, useEffect, useCallback } from "react";
import { GameState } from "../types/game";
import { Item } from "../types/item";
import createState from "../lib/create-state";
import Board from "./board";
import Loading from "./loading";
import Instructions from "./instructions";
import badCards from "../lib/bad-cards";

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    const initializeGameData = async () => {
      try {
        const response = await fetch("/data/items.json");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const textData = await response.text(); // Fetch as text first
        const jsonData = textData.split('\n').filter(line => line.trim()).map(JSON.parse); // Split by newline and parse each line
  
        const filteredItems: Item[] = jsonData
          .filter((item: Item) => !item.label.includes(String(item.year)))
          .filter((item: Item) => !item.description.includes(String(item.year)))
          .filter((item: Item) =>
            !["st century", "nd century", "th century"].some(term => item.description.includes(term))
          )
          .filter((item: Item) => !(item.id in badCards));
  
        const initialState = await createState(filteredItems);
        setState(initialState);
        setLoaded(true);
      } catch (error) {
        console.error("Failed to load items:", error);
      }
    };
  
    initializeGameData();
  }, []);
  

  const [highscore, setHighscore] = useState<number>(
    Number(localStorage.getItem("highscore") ?? "0")
  );

  const updateHighscore = React.useCallback((score: number) => {
    localStorage.setItem("highscore", String(score));
    setHighscore(score);
  }, []);

  const resetGame = useCallback(async () => {
    if (items) {
      setState(await createState(items));
    }
  }, [items]);

  if (!loaded || !state) {
    return <Loading />;
  }

  if (!started) {
    return (
      <Instructions highscore={highscore} start={() => setStarted(true)} />
    );
  }

  return (
    <Board
      highscore={highscore}
      state={state}
      setState={setState}
      resetGame={resetGame}
      updateHighscore={updateHighscore}
    />
  );
}
