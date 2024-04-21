import React from "react";
import { GameState } from "../types/game";
import { getRandomItem, checkCorrect, preloadImage } from "../lib/items";
import NextItemList from "./next-item-list";
import PlayedItemList from "./played-item-list";
import styles from "../styles/board.module.scss";
import Hearts from "./hearts";
import GameOver from "./game-over";

interface Props {
  highscore: number;
  resetGame: () => void;
  state: GameState;
  setState: (state: GameState) => void;
  updateHighscore: (score: number) => void;
}

export default function Board(props: Props) {
  const { highscore, resetGame, state, setState, updateHighscore } = props;

  const [hasAIAnswered, setHasAIAnswered] = React.useState(false);

  React.useEffect(() => {
    const aiDecisionProcess = async () => {
      if (state.next && !hasAIAnswered) {
        setHasAIAnswered(true);

        // Simulate AI decision (replace this with actual LLM call)
        const position = Math.floor(Math.random() * state.played.length); // This is a placeholder

        const { correct, delta } = checkCorrect(
          state.played,
          state.next,
          position
        );
        const newPlayed = [...state.played];
        newPlayed.splice(position, 0, { ...state.next, played: { correct } });

        const newNext = state.nextButOne;
        const newDeck = [...state.deck];
        const newNextButOne = getRandomItem(newDeck, [
          ...newPlayed,
          ...(newNext ? [newNext] : []),
        ]);
        const newImageCache = [preloadImage(newNextButOne.image)];

        setState({
          ...state,
          deck: newDeck,
          imageCache: newImageCache,
          next: newNext,
          nextButOne: newNextButOne,
          played: newPlayed,
          lives: correct ? state.lives : state.lives - 1,
          badlyPlaced: correct
            ? null
            : { index: position, rendered: false, delta },
        });

        setHasAIAnswered(false);
      }
    };

    aiDecisionProcess();
  }, [state, hasAIAnswered]);

  const score = React.useMemo(() => {
    return state.played.filter((item) => item.played.correct).length - 1;
  }, [state.played]);

  React.useLayoutEffect(() => {
    if (score > highscore) {
      updateHighscore(score);
    }
  }, [score, highscore, updateHighscore]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>
        <Hearts lives={state.lives} />
        {state.lives > 0 ? (
          <>
            <NextItemList next={state.next} />
          </>
        ) : (
          <GameOver highscore={highscore} resetGame={resetGame} score={score} />
        )}
      </div>
      <div id="bottom" className={styles.bottom}>
        <PlayedItemList
          badlyPlacedIndex={
            state.badlyPlaced === null ? null : state.badlyPlaced.index
          }
          items={state.played}
        />
      </div>
    </div>
  );
}