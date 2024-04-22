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

  const createPromptForLLM = (played: PlayedItem[], next: Item) => {
    const datePropIdMap: { [key: string]: string | undefined } = {
        P575: "discovered",
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

    const nextEvent = datePropIdMap[next.date_prop_id] || next.date_prop_id;
    const nextCardLabel = next.label;
    const nextCardDescription = next.description;

    const prompt = `You are playing a historical trivia game. Your task is to analyze the event "${nextCardLabel}", described as "${nextCardDescription}" and categorized under "${nextEvent}". Please predict two possible years for when this event could have occurred, providing a brief explanation for each guess. Conclude by selecting the year you believe is most accurate from your guesses. Respond solely with JSON, in the following JSON format, filling in the final "year" field with your best guess:
    {
        "guesses": [
            {"explanation": "Corresponds to a significant historical event at 420 BCE.", "yearOneGuess": -420},
            {"explanation": "Marks an important discovery that shaped modern history.", "yearTwoGuess": 1492}
        ],
        "year":"
    }`;

    return prompt;
};



async function fetchAIResponse(content: string) {
  let attempts = 0;

  while (attempts < 3) {
      attempts++;
      try {
          const response = await fetch("http://localhost:3000/groq-chat", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({ content }),
          });
          if (!response.ok) {
              throw new Error("Failed to fetch AI decision");
          }
          const data = await response.json();  // This is the outer JSON
          console.log("Outer JSON data from server:", data);

          // Check if 'content' field exists and parse it
          if (data.content) {
              const innerJsonData = JSON.parse(data.content);  // Parse the JSON string from 'content'
              console.log("Parsed inner JSON data:", innerJsonData);

              // Now extract the 'year' from the inner JSON
              if (innerJsonData && innerJsonData.year && /^-?\d+$/.test(innerJsonData.year.toString())) {
                  console.log("Valid year received:", innerJsonData.year);
                  return parseInt(innerJsonData.year, 10);  // Convert and return the year
              } else {
                  console.log("No valid year found or malformed JSON structure in the content:", innerJsonData);

                  // Attempt to extract year using regex from the JSON string if no valid year is found in the parsed JSON
                  const yearMatch = data.content.match(/"year"\s*:\s*(-?\d+)/);
                  if (yearMatch && yearMatch[1]) {
                      console.log("Extracted year from malformed JSON:", yearMatch[1]);
                      return parseInt(yearMatch[1], 10);
                  } else {
                      console.log("Failed to parse year from JSON string, sending request again.");
                      content = "Please send a valid year in the requested JSON format. No other comments are necessary.";
                  }
              }
          } else {
              console.log("No 'content' field found in the server response, retrying...");
          }
      } catch (error) {
          console.error("Error fetching AI response:", error);
          if (attempts >= 3) {  // Only throw an error after all retries fail
              throw error;
          }
      }
  }

  throw new Error("Failed to receive a valid year after three attempts.");
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
