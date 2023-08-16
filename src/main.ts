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
  removeGridEntity,
  spawnGridEntityWithVariant,
} from "isaacscript-common";
import { mod } from "./mod";
import { initModConfigMenu } from "./modConfigMenu";

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
  if (Game().IsGreedMode()) {
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
      v.lastFloorReseeded = false;
    }
  }
}

function reseed(stage: number, stageType: number, level: Level) {
  const stage123StageTypes = [0, 1, 2, 4, 5];
  const stage5StageTypes = [0, 4];

  let newStageType = 0;

  if (config.altPathOnly) {
    newStageType = stage === 4 ? 4 : math.random(4, 5);
  } else if (v.oldStage === 4 && v.oldStageType === 4) {
    newStageType = 0;
  } else if (stage === 4 || stage === 5) {
    newStageType = stage5StageTypes[math.random(0, 1)] ?? 0;
  } else {
    newStageType = stage123StageTypes[math.random(0, 4)] ?? 0;
  }

  let newStage: int;

  if (v.oldStage === 4 && v.oldStageType === 4) {
    newStage = 6;
  } else if (
    (newStageType === 4 || newStageType === 5) &&
    (v.oldStageType === 0 || v.oldStageType === 1 || v.oldStageType === 2)
  ) {
    newStage = v.oldStage;
  } else if (
    (v.oldStageType === 4 || v.oldStageType === 5) &&
    (newStageType === 0 || newStageType === 1 || newStageType === 2)
  ) {
    newStage = v.oldStage + 2;
  } else if (
    stage === v.oldStage &&
    stageType === v.oldStageType &&
    !v.floorReseeded[getEffectiveGreedModeStage() - 2]
  ) {
    newStage = newStageType === 4 || newStageType === 5 ? stage - 1 : stage;
  } else {
    newStage = v.oldStage + 1;
  }

  v.floorReseeded[getEffectiveGreedModeStage() - 2] = true;
  v.lastFloorReseeded = true;

  level.SetStage(newStage, newStageType);
  v.oldStage = newStage;
  v.oldStageType = newStageType;
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
    Game().IsGreedMode() &&
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
  const IsGreedMode = Game().IsGreedMode();
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
    Game().IsGreedMode() &&
    stage === 4 &&
    stageType === 4 &&
    v.rotgutDefeated &&
    !v.corpseDDSpawned
  ) {
    level.GreedModeWave++;
    room.TrySpawnDevilRoomDoor(true, true);
    v.corpseDDSpawned = true;
  }

  if (
    Game().IsGreedMode() &&
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    v.rotgutDefeated &&
    v.corpseDDSpawned
  ) {
    level.GreedModeWave = GameDifficulty === Difficulty.GREEDIER ? 12 : 11;
  }

  // Respawn the Greed plate in case it was replaced by a trapdoor or a poop spawned by Clog.
  if (
    roomType === RoomType.DEFAULT &&
    IsGreedMode &&
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
    Game().IsGreedMode() &&
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    npc.Type === EntityType.ROTGUT &&
    npc.Variant === 2
  ) {
    v.rotgutDefeated = true;
  }
}
