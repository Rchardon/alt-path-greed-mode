import {
  Difficulty,
  EntityType,
  GridEntityType,
  LevelStage,
  PinVariant,
  PressurePlateVariant,
  RoomType,
  RotgutVariant,
  StageType,
} from "isaac-typescript-definitions";
import {
  ModCallbackCustom,
  game,
  getGridEntities,
  getRoomVariant,
  getStage,
  isGreedMode,
  isRepentanceStage,
  onRepentanceStage,
  onStage,
  onStageType,
  removeGridEntity,
  spawnGridEntityWithVariant,
} from "isaacscript-common";
import { mod } from "./mod";
import { config, initModConfigMenu } from "./modConfigMenu";

const GREED_PLATE_GRID_INDEX = 112;

const v = {
  run: {
    floorsReseeded: new Set<LevelStage>(),
    oldStage: LevelStage.BASEMENT_GREED_MODE,
    oldStageType: StageType.ORIGINAL,
    lastFloorReseeded: false,
    rotgutDefeated: false,
    corpseDDSpawned: false,
  },
};

export function main(): void {
  initModConfigMenu();
  mod.saveDataManager("main", v);

  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_LEVEL_REORDERED,
    postNewLevelReordered,
  );
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_ROOM_REORDERED,
    postNewRoomReordered,
  );
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NPC_DEATH_FILTER,
    postNPCDeathRotGutPhase3,
    EntityType.ROTGUT,
    RotgutVariant.PHASE_3_HEART,
  );
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NPC_INIT_FILTER,
    postNPCInitWormwood,
    EntityType.PIN,
    PinVariant.WORMWOOD,
  );
}

// ModCallbackCustom.POST_NEW_LEVEL_REORDERED
function postNewLevelReordered() {
  if (!isGreedMode()) {
    return;
  }

  const level = game.GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();
  const effectiveGreedModeStage = getEffectiveGreedModeStage();

  if (
    stage === LevelStage.BASEMENT_GREED_MODE &&
    (stageType === StageType.ORIGINAL ||
      stageType === StageType.WRATH_OF_THE_LAMB ||
      stageType === StageType.AFTERBIRTH)
  ) {
    v.run.oldStage = stage;
    v.run.oldStageType = stageType;
  } else if (
    (stage !== LevelStage.BASEMENT_GREED_MODE &&
      stage <= LevelStage.SHEOL_GREED_MODE &&
      !isRepentanceStage(stageType) &&
      !v.run.floorsReseeded.has(effectiveGreedModeStage) &&
      !v.run.lastFloorReseeded) ||
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    (v.run.oldStage === stage - 1 &&
      isRepentanceStage(v.run.oldStageType) &&
      v.run.floorsReseeded.has(effectiveGreedModeStage))
  ) {
    reseed(stage, stageType, level);
  } else {
    v.run.lastFloorReseeded = false;
  }
}

function reseed(stage: LevelStage, stageType: StageType, level: Level) {
  const stage123StageTypes = [0, 1, 2, 4, 5];
  const stage5StageTypes = [0, 4];

  const effectiveGreedModeStage = getEffectiveGreedModeStage();

  let newStageType = StageType.ORIGINAL;

  if (config.altPathOnly) {
    newStageType = stage === LevelStage.WOMB_GREED_MODE ? 4 : math.random(4, 5);
  } else if (
    v.run.oldStage === LevelStage.WOMB_GREED_MODE &&
    v.run.oldStageType === StageType.REPENTANCE
  ) {
    newStageType = 0;
  } else if (
    stage === LevelStage.WOMB_GREED_MODE ||
    stage === LevelStage.SHEOL_GREED_MODE
  ) {
    newStageType = stage5StageTypes[math.random(0, 1)] ?? 0;
  } else {
    newStageType = stage123StageTypes[math.random(0, 4)] ?? 0;
  }

  let newStage: LevelStage;

  if (
    v.run.oldStage === LevelStage.WOMB_GREED_MODE &&
    v.run.oldStageType === StageType.REPENTANCE
  ) {
    newStage = LevelStage.SHOP_GREED_MODE;
  } else if (
    (newStageType === StageType.REPENTANCE ||
      newStageType === StageType.REPENTANCE_B) &&
    (v.run.oldStageType === StageType.ORIGINAL ||
      v.run.oldStageType === StageType.WRATH_OF_THE_LAMB ||
      v.run.oldStageType === StageType.AFTERBIRTH)
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
    !v.run.floorsReseeded.has(effectiveGreedModeStage)
  ) {
    newStage = newStageType === 4 || newStageType === 5 ? stage - 1 : stage;
  } else {
    newStage = v.run.oldStage + 1;
  }

  v.run.floorsReseeded.add(effectiveGreedModeStage);
  v.run.lastFloorReseeded = true;

  level.SetStage(newStage, newStageType);
  v.run.oldStage = newStage;
  v.run.oldStageType = newStageType;

  Isaac.ExecuteCommand("reseed");
}

function getEffectiveGreedModeStage(): LevelStage {
  const stage = getStage();
  return onRepentanceStage() ? stage + 1 : stage;
}

// ModCallbackCustom.POST_NEW_ROOM_REORDERED
function postNewRoomReordered() {
  if (!isGreedMode()) {
    return;
  }

  const level = game.GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();
  const room = game.GetRoom();
  const roomType = room.GetType();
  const numGreedWave = level.GreedModeWave;
  const roomVariant = getRoomVariant();

  if (
    room.GetType() === RoomType.DUNGEON &&
    (roomVariant === 1010 || roomVariant === 1020)
  ) {
    level.GreedModeWave++;
  }

  if (
    stage === LevelStage.WOMB_GREED_MODE &&
    stageType === StageType.REPENTANCE &&
    v.run.rotgutDefeated &&
    !v.run.corpseDDSpawned
  ) {
    level.GreedModeWave++;
    room.TrySpawnDevilRoomDoor(true, true);
    v.run.corpseDDSpawned = true;
  }

  if (
    stage === LevelStage.WOMB_GREED_MODE &&
    stageType === StageType.REPENTANCE &&
    v.run.rotgutDefeated &&
    v.run.corpseDDSpawned
  ) {
    level.GreedModeWave = game.Difficulty === Difficulty.GREEDIER ? 12 : 11;
  }

  // Respawn the Greed plate in case it was replaced by a trapdoor or a poop spawned by Clog.
  if (
    roomType === RoomType.DEFAULT &&
    stage === LevelStage.BASEMENT_GREED_MODE &&
    roomVariant > 999 &&
    ((numGreedWave <= 11 &&
      numGreedWave >= 10 &&
      game.Difficulty === Difficulty.GREEDIER) ||
      (numGreedWave <= 10 &&
        numGreedWave >= 9 &&
        game.Difficulty === Difficulty.GREED))
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

// ModCallbackCustom.POST_NPC_DEATH_FILTER
// EntityType.ROTGUT (911)
// RotgutVariant.PHASE_3_HEART (2)
function postNPCDeathRotGutPhase3() {
  if (!isGreedMode()) {
    return;
  }

  if (
    onStage(LevelStage.WOMB_GREED_MODE) &&
    onStageType(StageType.REPENTANCE)
  ) {
    v.run.rotgutDefeated = true;
  }
}

// ModCallbackFilter.POST_NPC_INIT_FILTER
// EntityType.PIN (62)
// PinVariant.WORMWOOD (3)
function postNPCInitWormwood(npc: EntityNPC) {
  if (!isGreedMode()) {
    return;
  }

  if (onStage(LevelStage.WOMB_GREED_MODE) && onRepentanceStage()) {
    // Replace the normal wormwood graphics with the red wormwood spritesheet.
    const sprite = npc.GetSprite();
    sprite.Load("gfx/wormwood_corpse.anm2", false);
    sprite.ReplaceSpritesheet(0, "gfx/bosses/repentance/wormwood_corpse.png");
    sprite.LoadGraphics();
    sprite.Update();
  }
}
