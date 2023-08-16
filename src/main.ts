import {
  Difficulty,
  EntityType,
  GridEntityType,
  LevelStage,
  ModCallback,
  PressurePlateVariant,
  RoomType,
  StageType,
} from "isaac-typescript-definitions";
import {
  ModCallbackCustom,
  getGridEntities,
  getRoomVariant,
  isGreedMode,
  removeGridEntity,
  spawnGridEntityWithVariant,
} from "isaacscript-common";
import { mod } from "./mod";
import { config, initModConfigMenu } from "./modConfigMenu";

const GREED_PLATE_GRID_INDEX = 112;

const floorReseeded = [false, false, false, false];
let oldStage = 0;
let oldStageType = 0;
let lastFloorReseeded = false;
let rotgutDefeated = false;
let corpseDDSpawned = false;

export function main(): void {
  initModConfigMenu();

  mod.AddCallback(ModCallback.POST_PLAYER_INIT, postPlayerInit);
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_LEVEL_REORDERED,
    postNewLevel,
  );
  mod.AddCallback(ModCallback.POST_NPC_INIT, postNPCInit);
  mod.AddCallbackCustom(ModCallbackCustom.POST_NEW_ROOM_REORDERED, postNewRoom);
  mod.AddCallback(ModCallback.POST_NPC_DEATH, postNPCDeath);
}

function postPlayerInit() {
  floorReseeded[0] = false;
  floorReseeded[1] = false;
  floorReseeded[2] = false;
  floorReseeded[3] = false;
}

function postNewLevel() {
  if (isGreedMode()) {
    const level = Game().GetLevel();
    const stage = level.GetStage();
    const stageType = level.GetStageType();

    if (
      stage === 1 &&
      (stageType === 0 || stageType === 1 || stageType === 2)
    ) {
      oldStage = stage;
      oldStageType = stageType;
    } else if (
      (stage !== 1 &&
        stage <= 5 &&
        stageType !== 4 &&
        stageType !== 5 &&
        !floorReseeded[getEffectiveGreedModeStage() - 2] &&
        !lastFloorReseeded) ||
      (oldStage === stage - 1 &&
        (oldStageType === 4 || oldStageType === 5) &&
        floorReseeded[getEffectiveGreedModeStage() - 2])
    ) {
      reseed(stage, stageType, level);
    } else {
      lastFloorReseeded = false;
    }
  }
}

function reseed(stage: number, stageType: number, level: Level) {
  const stage123StageTypes = [0, 1, 2, 4, 5];
  const stage5StageTypes = [0, 4];

  let newStageType = 0;

  if (config.altPathOnly) {
    newStageType = stage === 4 ? 4 : math.random(4, 5);
  } else if (oldStage === 4 && oldStageType === 4) {
    newStageType = 0;
  } else if (stage === 4 || stage === 5) {
    newStageType = stage5StageTypes[math.random(0, 1)] ?? 0;
  } else {
    newStageType = stage123StageTypes[math.random(0, 4)] ?? 0;
  }

  let newStage: int;

  if (oldStage === 4 && oldStageType === 4) {
    newStage = 6;
  } else if (
    (newStageType === 4 || newStageType === 5) &&
    (oldStageType === 0 || oldStageType === 1 || oldStageType === 2)
  ) {
    newStage = oldStage;
  } else if (
    (oldStageType === 4 || oldStageType === 5) &&
    (newStageType === 0 || newStageType === 1 || newStageType === 2)
  ) {
    newStage = oldStage + 2;
  } else if (
    stage === oldStage &&
    stageType === oldStageType &&
    !floorReseeded[getEffectiveGreedModeStage() - 2]
  ) {
    newStage = newStageType === 4 || newStageType === 5 ? stage - 1 : stage;
  } else {
    newStage = oldStage + 1;
  }

  floorReseeded[getEffectiveGreedModeStage() - 2] = true;
  lastFloorReseeded = true;

  level.SetStage(newStage, newStageType);
  oldStage = newStage;
  oldStageType = newStageType;
  Isaac.ExecuteCommand("reseed");
}

function postNPCInit(npc: EntityNPC) {
  const level = Game().GetLevel();
  const stage = level.GetStage();

  if (npc.Type !== EntityType.PIN) {
    return;
  }

  // Wormwood
  if (
    isGreedMode() &&
    stage === 4 &&
    npc.Type === EntityType.PIN &&
    npc.Variant === 3
  ) {
    const sprite = npc.GetSprite();
    sprite.Load("gfx/wormwood_corpse.anm2", false);
    sprite.ReplaceSpritesheet(0, "gfx/bosses/repentance/wormwood_corpse.png");
    sprite.LoadGraphics();
    sprite.Update();
  }
}

function getEffectiveGreedModeStage(): number {
  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();

  if (stageType === 4 || stageType === 5) {
    return stage + 1;
  }

  return stage;
}

function postNewRoom() {
  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();
  const room = Game().GetRoom();
  const roomType = room.GetType();
  const numGreedWave = level.GreedModeWave;
  const GameDifficulty = Game().Difficulty;
  const roomVariant = getRoomVariant();

  if (
    room.GetType() === RoomType.DUNGEON &&
    (roomVariant === 1010 || roomVariant === 1020)
  ) {
    level.GreedModeWave++;
  }

  if (
    isGreedMode() &&
    stage === 4 &&
    stageType === 4 &&
    rotgutDefeated &&
    !corpseDDSpawned
  ) {
    level.GreedModeWave++;
    room.TrySpawnDevilRoomDoor(true, true);
    corpseDDSpawned = true;
  }

  if (
    isGreedMode() &&
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    rotgutDefeated &&
    corpseDDSpawned
  ) {
    level.GreedModeWave = GameDifficulty === Difficulty.GREEDIER ? 12 : 11;
  }

  // Respawn the Greed plate in case it was replaced by a trapdoor or a poop spawned by Clog.
  if (
    isGreedMode() &&
    roomType === RoomType.DEFAULT &&
    stage === LevelStage.BASEMENT_GREED_MODE &&
    roomVariant > 999 &&
    ((numGreedWave <= 11 &&
      numGreedWave >= 10 &&
      GameDifficulty === Difficulty.GREEDIER) ||
      (numGreedWave <= 10 &&
        numGreedWave >= 9 &&
        GameDifficulty === Difficulty.GREED))
  ) {
    const gridPoops = getGridEntities(GridEntityType.POOP);
    for (const gridPoop of gridPoops) {
      if (gridPoop.GetGridIndex() === GREED_PLATE_GRID_INDEX) {
        removeGridEntity(gridPoop, true);
      }
    }
    spawnGridEntityWithVariant(
      GridEntityType.PRESSURE_PLATE,
      PressurePlateVariant.GREED_PLATE,
      GREED_PLATE_GRID_INDEX,
    );
  }
}

function postNPCDeath(npc: EntityNPC) {
  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();

  // Rotgut
  if (
    isGreedMode() &&
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    npc.Type === EntityType.ROTGUT &&
    npc.Variant === 2
  ) {
    rotgutDefeated = true;
  }
}
