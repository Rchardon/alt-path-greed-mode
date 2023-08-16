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

const v = {
  run: {
    floorReseeded: [false, false, false, false],
    oldStage: 0,
    oldStageType: 0,
    lastFloorReseeded: false,
    rotgutDefeated: false,
    corpseDDSpawned: false,
  },
};

export function main(): void {
  initModConfigMenu();
  mod.saveDataManager("main", v);

  // Vanilla callbacks
  mod.AddCallback(ModCallback.POST_NPC_INIT, postNPCInit); // 27
  mod.AddCallback(ModCallback.POST_NPC_DEATH, postNPCDeath); // 29

  // Custom callbacks
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_LEVEL_REORDERED,
    postNewLevelReordered,
  );
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_ROOM_REORDERED,
    postNewRoomReordered,
  );
}

// ModCallback.POST_NPC_INIT (27)
function postNPCInit(npc: EntityNPC) {
  if (!isGreedMode()) {
    return;
  }

  const level = Game().GetLevel();
  const stage = level.GetStage();

  if (npc.Type !== EntityType.PIN) {
    return;
  }

  // Wormwood
  if (stage === 4 && npc.Type === EntityType.PIN && npc.Variant === 3) {
    const sprite = npc.GetSprite();
    sprite.Load("gfx/wormwood_corpse.anm2", false);
    sprite.ReplaceSpritesheet(0, "gfx/bosses/repentance/wormwood_corpse.png");
    sprite.LoadGraphics();
    sprite.Update();
  }
}

// ModCallback.POST_NPC_DEATH (29)
function postNPCDeath(npc: EntityNPC) {
  if (!isGreedMode()) {
    return;
  }

  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();

  // Rotgut
  if (
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    npc.Type === EntityType.ROTGUT &&
    npc.Variant === 2
  ) {
    v.run.rotgutDefeated = true;
  }
}

// ModCallbackCustom.POST_NEW_LEVEL_REORDERED
function postNewLevelReordered() {
  if (!isGreedMode()) {
    return;
  }

  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();

  if (
    stage === LevelStage.BASEMENT_GREED_MODE &&
    (stageType === 0 || stageType === 1 || stageType === 2)
  ) {
    v.run.oldStage = stage;
    v.run.oldStageType = stageType;
  } else if (
    (stage !== 1 &&
      stage <= 5 &&
      stageType !== 4 &&
      stageType !== 5 &&
      !v.run.floorReseeded[getEffectiveGreedModeStage() - 2] &&
      !v.run.lastFloorReseeded) ||
    (v.run.oldStage === stage - 1 &&
      (v.run.oldStageType === 4 || v.run.oldStageType === 5) &&
      v.run.floorReseeded[getEffectiveGreedModeStage() - 2])
  ) {
    reseed(stage, stageType, level);
  } else {
    v.run.lastFloorReseeded = false;
  }
}

function reseed(stage: number, stageType: number, level: Level) {
  const stage123StageTypes = [0, 1, 2, 4, 5];
  const stage5StageTypes = [0, 4];

  let newStageType = 0;

  if (config.altPathOnly) {
    newStageType = stage === 4 ? 4 : math.random(4, 5);
  } else if (v.run.oldStage === 4 && v.run.oldStageType === 4) {
    newStageType = 0;
  } else if (stage === 4 || stage === 5) {
    newStageType = stage5StageTypes[math.random(0, 1)] ?? 0;
  } else {
    newStageType = stage123StageTypes[math.random(0, 4)] ?? 0;
  }

  let newStage: int;

  if (v.run.oldStage === 4 && v.run.oldStageType === 4) {
    newStage = 6;
  } else if (
    (newStageType === 4 || newStageType === 5) &&
    (v.run.oldStageType === 0 ||
      v.run.oldStageType === 1 ||
      v.run.oldStageType === 2)
  ) {
    newStage = v.run.oldStage;
  } else if (
    (v.run.oldStageType === 4 || v.run.oldStageType === 5) &&
    (newStageType === 0 || newStageType === 1 || newStageType === 2)
  ) {
    newStage = v.run.oldStage + 2;
  } else if (
    stage === v.run.oldStage &&
    stageType === v.run.oldStageType &&
    !v.run.floorReseeded[getEffectiveGreedModeStage() - 2]
  ) {
    newStage = newStageType === 4 || newStageType === 5 ? stage - 1 : stage;
  } else {
    newStage = v.run.oldStage + 1;
  }

  v.run.floorReseeded[getEffectiveGreedModeStage() - 2] = true;
  v.run.lastFloorReseeded = true;

  level.SetStage(newStage, newStageType);
  v.run.oldStage = newStage;
  v.run.oldStageType = newStageType;

  Isaac.ExecuteCommand("reseed");
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

// ModCallbackCustom.POST_NEW_ROOM_REORDERED
function postNewRoomReordered() {
  if (!isGreedMode()) {
    return;
  }

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
    stage === 4 &&
    stageType === 4 &&
    v.run.rotgutDefeated &&
    !v.run.corpseDDSpawned
  ) {
    level.GreedModeWave++;
    room.TrySpawnDevilRoomDoor(true, true);
    v.run.corpseDDSpawned = true;
  }

  if (
    stage === 4 &&
    stageType === StageType.REPENTANCE &&
    v.run.rotgutDefeated &&
    v.run.corpseDDSpawned
  ) {
    level.GreedModeWave = GameDifficulty === Difficulty.GREEDIER ? 12 : 11;
  }

  // Respawn the Greed plate in case it was replaced by a trapdoor or a poop spawned by Clog.
  if (
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
