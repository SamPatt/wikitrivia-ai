import { Item, PlayedItem } from "../types/item";
import { createWikimediaImage } from "./image";

const correctSound = new Audio('/sounds/goodbeep.wav');
const wrongSound = new Audio('/sounds/error.wav');

export function getRandomItem(deck: Item[], played: Item[]): Item {
  const periods: [number, number][] = [
    [-100000, 1000],
    [1000, 1800],
    [1800, 2020],
  ];
  const [fromYear, toYear] =
    periods[Math.floor(Math.random() * periods.length)];
  const avoidPeople = Math.random() > 0.5;
  const candidates = deck.filter((candidate) => {
    if (avoidPeople && candidate.instance_of.includes("human")) {
      return false;
    }
    if (candidate.year < fromYear || candidate.year > toYear) {
      return false;
    }
    if (tooClose(candidate, played)) {
      return false;
    }
    return true;
  });

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return deck[Math.floor(Math.random() * deck.length)];
}

const playSound = (soundType: string) => {
  switch (soundType) {
    case 'correct':
      correctSound.currentTime = 0;
      correctSound.volume = 0.3;
      correctSound.play();
      break;
    case 'wrong':
      wrongSound.currentTime = 0;
      wrongSound.volume = 0.3;
      wrongSound.play();
      break;
    default:
      console.log('No sound for this type');
  }
};

function tooClose(item: Item, played: Item[]) {
  let distance = (played.length < 40) ? 5 : 1;
  if (played.length < 11)
    distance = 110 - 10 * played.length;

  return played.some((p) => Math.abs(item.year - p.year) < distance);
}

export function checkCorrect(
  played: PlayedItem[],
  item: Item,
  index: number
): { correct: boolean; delta: number } {
  const sorted = [...played, item].sort((a, b) => a.year - b.year);
  const correctIndex = sorted.findIndex((i) => {
    return i.id === item.id;
  });

  if (index !== correctIndex) {
    playSound('wrong');
    console.log("Incorrectly placed item:", item.label, item.year);
    return { correct: false, delta: correctIndex - index };
  }
  console.log("Correctly placed item:", item.label, item.year);
  playSound('correct');
  return { correct: true, delta: 0 };
}

export function preloadImage(url: string): HTMLImageElement {
  const img = new Image();
  img.src = createWikimediaImage(url);
  return img;
}
