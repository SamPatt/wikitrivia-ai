import React, { useState, useEffect, useRef } from "react";
import { GameState } from "../types/game";
import { getRandomItem, checkCorrect, preloadImage } from "../lib/items";
import NextItemList from "./next-item-list";
import PlayedItemList from "./played-item-list";
import styles from "../styles/board.module.scss";
import Hearts from "./hearts";
import GameOver from "./game-over";
import { Item, PlayedItem } from "../types/item";

// Credit for the Llama gifs goes to Bare Tree Media on Tenor: https://tenor.com/official/baretreemedia

interface Props {
  modelId: string;
  modelLabel: string;
  highscore: number;
  resetGame: () => void;
  state: GameState;
  setState: (state: GameState) => void;
  updateHighscore: (score: number) => void;
}

interface LastAnswer {
  id: string;
  label: string;
  guess: number;
  actual: number;
  ms: number;
  correct: boolean;
}

const fmtYear = (y: number) => (y < 0 ? `${-y} BCE` : String(y));

// ?pace=800 waits 800 ms between moves so a viewer can follow; default is flat out.
const PACE_MS = Number(new URLSearchParams(window.location.search).get("pace") ?? 0);
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export default function Board(props: Props) {
  const { modelId, modelLabel, highscore, resetGame, state, setState, updateHighscore } = props;

  const [kick, setKick] = useState(0);
  const [costSeen, setCostSeen] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingGif, setLoadingGif] = useState("");
  const [animateClass, setAnimateClass] = useState("");
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [timings, setTimings] = useState<number[]>([]);
  const [spend, setSpend] = useState(0);

  const getRandomGif = () => {
    const number = Math.floor(Math.random() * 6) + 1;
    return `/images/llama${number}.gif`;
  };

  async function fetchAIGuess(card: Item): Promise<{ year: number; ms: number }> {
    const response = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId,
        card: { label: card.label, description: card.description, date_prop_id: card.date_prop_id },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    setTimings((t) => [...t, data.ms]);
    if (typeof data.cost === "number") {
      setSpend((c) => c + data.cost);
      setCostSeen(true);
    }
    return { year: data.year, ms: data.ms };
  }

  function findPositionByYear(played: PlayedItem[], year: number): number {
    const sorted = [...played];
    sorted.sort((a, b) => a.year - b.year);
    const position = sorted.findIndex((item) => year <= item.year);
    return position === -1 ? played.length : position;
  }

  // The AI loop: whenever the game state changes (a card was placed, or a new game
  // started), place the next card. inFlight stops double calls; a reply that comes
  // back after the game was reset is thrown away.
  const inFlight = useRef(false);
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    const card = state.next;
    if (!card || state.lives <= 0 || retryCount >= 3 || inFlight.current) return;
    inFlight.current = true;
    setLoadingGif(getRandomGif());
    setIsLoading(true);
    setError(null);
    const aiDecisionProcess = async () => {
      {
        try {
          if (PACE_MS > 0) await sleep(PACE_MS);
          const { year: predictedYear, ms } = await fetchAIGuess(card);
          if (latestState.current !== state) return; // game was reset meanwhile
          const position = findPositionByYear(state.played, predictedYear);
          const { correct, delta } = checkCorrect(state.played, card, position);
          setLastAnswer({ id: card.id, label: card.label, guess: predictedYear, actual: card.year, ms, correct });

          const newPlayed = [...state.played];
          // A wrong card still lands in its true spot (shown red) so the timeline stays in order.
          newPlayed.splice(correct ? position : position + delta, 0, { ...card, played: { correct } });

          const newNext = state.nextButOne;
          const newDeck = [...state.deck];
          const newNextButOne = getRandomItem(newDeck, [...newPlayed, ...(newNext ? [newNext] : [])]);
          const newImageCache = [preloadImage(newNextButOne.image)];

          setState({
            ...state,
            deck: newDeck,
            imageCache: newImageCache,
            next: newNext,
            nextButOne: newNextButOne,
            played: newPlayed,
            lives: correct ? state.lives : state.lives - 1,
            badlyPlaced: correct ? null : { index: position, rendered: false, delta },
          });
          setRetryCount(0);
        } catch (err) {
          console.warn("AI call failed, retrying:", err);
          setError(`${(err as Error).message} — retrying…`);
          setRetryCount(retryCount + 1);
        } finally {
          inFlight.current = false;
          setIsLoading(false);
          // If the game was reset while this call was out, kick the loop for the new game.
          if (latestState.current !== state) setKick((k) => k + 1);
        }
      }
    };

    aiDecisionProcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, retryCount, kick]);

  // A new game (Play again) resets the per-game AI stats.
  useEffect(() => {
    if (state.played.length === 1) {
      setTimings([]);
      setSpend(0);
      setCostSeen(false);
      setLastAnswer(null);
      setRetryCount(0);
      setStartedAt(Date.now());
      setEndedAt(null);
    }
  }, [state.played.length]);

  useEffect(() => {
    if (state.lives === 0 && endedAt === null) setEndedAt(Date.now());
  }, [state.lives, endedAt]);

  const score = React.useMemo(() => {
    return state.played.filter((item) => item.played.correct).length - 1;
  }, [state.played]);

  useEffect(() => {
    setAnimateClass(`growAndShake ${0.5 + score * 0.05}s ease-out`);
    const timer = setTimeout(() => setAnimateClass(""), 500 + score * 50);
    return () => clearTimeout(timer);
  }, [score]);

  React.useLayoutEffect(() => {
    if (score > highscore) {
      updateHighscore(score);
    }
  }, [score, highscore, updateHighscore]);

  const avgMs = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>
        <div className={styles.topLeft}>
          {isLoading && <img src={loadingGif} alt="Loading" className={styles.loadingGif} />}
          {state.lives === 0 && <img src="/images/sleep.gif" alt="Game Over" className={styles.gameOverGif} />}
        </div>
        <div className={styles.topCenter}>
          <Hearts lives={state.lives} />
          {error && <div className={styles.error}>Error: {error}</div>}
          {state.lives > 0 ? (
            <NextItemList next={state.next} />
          ) : (
            <GameOver highscore={highscore} resetGame={resetGame} score={score} />
          )}
        </div>
        <div className={styles.topRight}>
          <div className={`${styles.streak} ${animateClass}`}>Score: {score}</div>
          <div className={styles.aiStats}>
            <div className={styles.aiModel}>{modelLabel}</div>
            {lastAnswer && (
              <div>
                {lastAnswer.label}: guessed <b>{fmtYear(lastAnswer.guess)}</b>, actual{" "}
                <b>{fmtYear(lastAnswer.actual)}</b> {lastAnswer.correct ? "✓" : "✗"}
              </div>
            )}
            {state.lives === 0 && timings.length > 0 && (
              <div className={styles.summary}>
                <div className={styles.summaryTitle}>Run summary</div>
                <dl>
                  <dt>Total cost</dt>
                  <dd>{costSeen ? `$${spend < 0.01 ? spend.toFixed(5) : spend.toFixed(4)}` : "free / not reported"}</dd>
                  <dt>Cost per card</dt>
                  <dd>{costSeen ? `$${(spend / timings.length).toFixed(6)}` : "–"}</dd>
                  <dt>Cards played</dt>
                  <dd>
                    {state.played.length - 1} ({score} right, {state.played.length - 1 - score} wrong)
                  </dd>
                  <dt>Model time</dt>
                  <dd>
                    {((avgMs * timings.length) / 1000).toFixed(2)} s total · {Math.round(avgMs)} ms avg ·{" "}
                    {Math.round(Math.min(...timings))}–{Math.round(Math.max(...timings))} ms range
                  </dd>
                  <dt>API calls</dt>
                  <dd>{timings.length}</dd>
                  <dt>Wall clock</dt>
                  <dd>{endedAt ? `${((endedAt - startedAt) / 1000).toFixed(1)} s` : "–"}</dd>
                </dl>
              </div>
            )}
            {state.lives > 0 && timings.length > 0 && (
              <div className={styles.aiTiming}>
                last {Math.round(lastAnswer?.ms ?? 0)} ms · avg {Math.round(avgMs)} ms · {timings.length} calls ·{" "}
                {((avgMs * timings.length) / 1000).toFixed(1)} s total thinking
                {spend > 0 ? ` · $${spend.toFixed(4)}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>
      <div id="bottom" className={styles.bottom}>
        <PlayedItemList
          badlyPlacedIndex={state.badlyPlaced === null ? null : state.badlyPlaced.index}
          items={state.played}
          latestId={lastAnswer?.id ?? null}
        />
      </div>
    </div>
  );
}
