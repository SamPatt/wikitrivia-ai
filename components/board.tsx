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

  async function fetchAIResponse(content: string) {
    console.log('Sending request to server with content:', content);
    try {
      const response = await fetch('http://localhost:3000/groq-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      console.log('Server response:', response);
      if (!response.ok) {
        throw new Error('Failed to fetch AI decision');
      }
      const data = await response.json();
      console.log('Data received from server:', data);
      return data.position;
    } catch (error) {
      console.error('Error fetching AI response:', error);
      throw error;
    }
  }
  
  

  React.useEffect(() => {
    const aiDecisionProcess = async () => {
      if (state.next && !hasAIAnswered && state.lives > 0) {
        setHasAIAnswered(true);
  
        try {
          const content = state.next.description;
          const position = await fetchAIResponse(content);
  
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
        } catch (error) {
          console.error('Failed to process AI decision:', error);
        } finally {
          setHasAIAnswered(false);
        }
      }
    };
  
    aiDecisionProcess();
  }, [hasAIAnswered]);
  

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