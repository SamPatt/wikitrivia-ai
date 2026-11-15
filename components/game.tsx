import React, { useState, useEffect, useCallback } from "react";
import { GameState } from "../types/game";
import { Item } from "../types/item";
import createState from "../lib/create-state";
import Board from "./board";
import Loading from "./loading";
import Instructions from "./instructions";
import badCards from "../lib/bad-cards";

export interface ModelOption {
  id: string;
  label: string;
}

const params = new URLSearchParams(window.location.search);

function readStorage(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  // ?autostart skips the start screen (handy for screen recording)
  const [started, setStarted] = useState(params.has("autostart"));
  const [items, setItems] = useState<Item[] | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelId, setModelId] = useState<string>(params.get("model") ?? readStorage("modelId", ""));

  useEffect(() => {
    const initializeGameData = async () => {
      try {
        const [response, modelRes] = await Promise.all([fetch("/data/items.json"), fetch("/api/guess")]);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const list: ModelOption[] = await modelRes.json();
        setModels(list);
        setModelId((cur) => (list.some((m) => m.id === cur) ? cur : list[0].id));

        const textData = await response.text();
        const jsonData = textData.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));

        const filteredItems: Item[] = jsonData
          .filter((item: Item) => !item.label.includes(String(item.year)))
          .filter((item: Item) => !item.description.includes(String(item.year)))
          .filter((item: Item) => !["st century", "nd century", "th century"].some((term) => item.description.includes(term)))
          .filter((item: Item) => !(item.id in badCards));

        setItems(filteredItems);
        setState(await createState(filteredItems));
        setLoaded(true);
      } catch (error) {
        console.error("Failed to load items:", error);
      }
    };

    initializeGameData();
  }, []);

  const highscoreKey = `highscore:${modelId}`;
  const [highscore, setHighscore] = useState<number>(0);
  useEffect(() => {
    setHighscore(Number(readStorage(highscoreKey, "0")));
  }, [highscoreKey]);

  const selectModel = useCallback((id: string) => {
    setModelId(id);
    try {
      localStorage.setItem("modelId", id);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const updateHighscore = React.useCallback(
    (score: number) => {
      try {
        localStorage.setItem(highscoreKey, String(score));
      } catch {
        /* storage unavailable */
      }
      setHighscore(score);
    },
    [highscoreKey]
  );

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
      <Instructions
        highscore={highscore}
        models={models}
        modelId={modelId}
        selectModel={selectModel}
        start={() => setStarted(true)}
      />
    );
  }

  return (
    <Board
      modelId={modelId}
      modelLabel={models.find((m) => m.id === modelId)?.label ?? modelId}
      highscore={highscore}
      state={state}
      setState={setState}
      resetGame={resetGame}
      updateHighscore={updateHighscore}
    />
  );
}
