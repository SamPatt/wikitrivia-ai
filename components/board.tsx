import React from "react";
import { GameState } from "../types/game";
import { getRandomItem, checkCorrect, preloadImage } from "../lib/items";
import NextItemList from "./next-item-list";
import PlayedItemList from "./played-item-list";
import styles from "../styles/board.module.scss";
import Hearts from "./hearts";
import GameOver from "./game-over";
import { Item, PlayedItem } from "../types/item";

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

  const datePropIdMap: { [key: string]: string } = {
    P575: "discovered", // or invented
    P7589: "date of assent",
    P577: "published",
    P1191: "first performed",
    P1619: "officially opened",
    P571: "created",
    P1249: "earliest record",
    P576: "ended",
    P8556: "became extinct",
    P6949: "announced",
    P1319: "earliest",
    P569: "born",
    P570: "died",
    P582: "ended",
    P580: "started",
    P7125: "latest one",
    P7124: "first one",
  };

  const createPromptForLLM = (played: PlayedItem[], next: Item) => {
    // const playedCards = played.map((item, index) => ({
    //   index,
    //   year: item.year,
    //   title: item.label,
    //   description: item.description,
    //   event: datePropIdMap[item.date_prop_id] || item.date_prop_id,
    // }));

    const nextCard = {
      label: next.label,
      description: next.description,
      event: datePropIdMap[next.date_prop_id] || next.date_prop_id,
    };

    const instructions = "You are playing a historical trivia game. Your task is to respond with the closest year to the event described on the card. If you are unsure, you must guess a valid year anyway. Only respond with a year, which is either a positive or negative integer. Don't use the characters BC or BCE or CE or AD, only use positive or negative integers. For example, if an event ocurred in 500 BC, you would respond -500. 1952 AD, you would respond 1952. No other information is required.";

    const promptPayload = {
      instructions,
      nextCard,
      //playedCards
    };

    return JSON.stringify(promptPayload);
};

async function fetchAIResponse(content: string) {
  console.log("Sending request to server with content:", content);

  let isValidYear = false;
  let attempts = 0;

  while (!isValidYear && attempts < 5) {  // Limit the number of retries to prevent infinite loops
      attempts++;
      try {
          const response = await fetch("http://localhost:3000/groq-chat", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({ content }),
          });
          console.log("Server response:", response);
          if (!response.ok) {
              throw new Error("Failed to fetch AI decision");
          }
          const data = await response.json();
          console.log("Data received from server:", data);

          // Check if the response is a valid year
          const yearPattern = /^-?\d+$/;  // Regex for a valid integer (positive or negative)
          if (yearPattern.test(data.content)) {
              console.log("Valid year received:", data.content);
              isValidYear = true;
              return parseInt(data.content, 10);  // Convert string to integer
          } else {
              console.log("Invalid year received, sending request again:", data.content);
              content = "Please send a valid year.";  // Change the prompt to request a valid year
          }
      } catch (error) {
          console.error("Error fetching AI response:", error);
          throw error;  // Re-throw the error if it's a fetch failure or other critical issue
      }
  }

  throw new Error("Failed to receive a valid year after several attempts.");
}

function findPositionByYear(played: PlayedItem[], year: number): number {
  const sorted = [...played];
  sorted.sort((a, b) => a.year - b.year);
  const position = sorted.findIndex(item => year <= item.year);
  console.log("Position found:", position);
  return position === -1 ? played.length : position;
}


  React.useEffect(() => {
    const aiDecisionProcess = async () => {
      if (state.next && !hasAIAnswered && state.lives > 0) {
        setHasAIAnswered(true);

        try {
          const promptContent = createPromptForLLM(state.played, state.next);
          console.log("Prompt content:", promptContent);
          const predictedYear = await fetchAIResponse(promptContent);
          const position = findPositionByYear(state.played, predictedYear);

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
          console.error("Failed to process AI decision:", error);
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
