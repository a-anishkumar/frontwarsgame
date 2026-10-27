import { sanitizeCosmetics, flagGlyph } from "../customization/cosmetics";
import { Game } from "../core/Game";
import type { GameMap } from "../core/GameMap";
import { PseudoRandom } from "../core/PseudoRandom";
import { PlayerType, clampRoster, type GameSettings } from "../core/types";
import { SpawnTimerExecution } from "../core/executions/SpawnTimerExecution";
import { NationAI } from "../core/ai/NationAI";
import { aiColor, pickAiNames, countryFlag, getDoctrineForNation } from "../core/ai/aiNames";
import type { BotPersonality } from "../core/Player";

const PERSONALITIES: BotPersonality[] = ["Neutral", "Aggressive", "Expansionist", "Defensive", "Opportunist"];

export function createGame(map: GameMap, settings: GameSettings): Game {
  const game = new Game(map, settings);
  const rnd = new PseudoRandom(settings.seed ^ 0x5bd1e995);

  const cosmetics = sanitizeCosmetics(settings.cosmetics, true);
  const human = game.addPlayer(
    settings.playerName || "Commander",
    PlayerType.Human,
    cosmetics.color,
    0,
    flagGlyph(cosmetics.flag),
  );
  human.cosmetics = cosmetics;
  game.human = human;

  const { numBots } = clampRoster(settings.numNations, settings.numBots);

  // If real-world countries are available on this map:
  const validCountries = map.countries
    ? map.countries.filter((c) => c && c.id > 0 && c.tiles > 12 && c.centroid >= 0 && c.name && c.name !== "Antarctica")
    : [];

  if (validCountries.length > 0) {
    const shuffled = rnd.shuffle([...validCountries]);
    const usedNames = new Set([human.name]);

    for (let i = 0; i < numBots; i++) {
      let name = "";
      let countryId = 0;
      let flag = "";

      if (i < shuffled.length) {
        const c = shuffled[i];
        name = c.name;
        countryId = c.id;
        flag = countryFlag(c.name);
      } else {
        const fallback = pickAiNames(1, rnd, usedNames)[0];
        name = fallback;
      }

      let uniqueName = name;
      let counter = 2;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${name} ${counter++}`;
      }
      usedNames.add(uniqueName);

      const p = game.addPlayer(uniqueName, PlayerType.Nation, aiColor(i), countryId, flag);
      p.personality = getDoctrineForNation(uniqueName, i);
      game.addExecution(new NationAI(p));
    }
  } else {
    // Empty map / test mock fallback
    const names = pickAiNames(numBots, rnd, new Set([human.name]));
    for (let i = 0; i < numBots; i++) {
      const p = game.addPlayer(names[i] ?? `AI ${i + 1}`, PlayerType.Nation, aiColor(i));
      p.personality = PERSONALITIES[i % PERSONALITIES.length];
      game.addExecution(new NationAI(p));
    }
  }

  game.addExecution(new SpawnTimerExecution());
  return game;
}
