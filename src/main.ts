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
  getRandomArrayElement,
  getRoomVariant,
  getStage,
  isGreedMode,
  isRepentanceStage,
  onRepentanceStage,
  onStage,
  onStageOrHigher,
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  const onIncreasedStage = stage === v.run.oldStage + 1;

  if (onStage(LevelStage.BASEMENT_GREED_MODE) && !onRepentanceStage()) {
    v.run.oldStage = stage;
    v.run.oldStageType = stageType;
  } else if (
    (stage > LevelStage.BASEMENT_GREED_MODE &&
      stage < LevelStage.SHOP_GREED_MODE &&
      !isRepentanceStage(stageType) &&
      !v.run.floorsReseeded.has(effectiveGreedModeStage) &&
      !v.run.lastFloorReseeded) ||
    (onIncreasedStage &&
      isRepentanceStage(v.run.oldStageType) &&
      v.run.floorsReseeded.has(effectiveGreedModeStage))
  ) {
    reseed();
  } else {
    v.run.lastFloorReseeded = false;
  }
}

function reseed() {
  const level = game.GetLevel();
  const effectiveGreedModeStage = getEffectiveGreedModeStage();

  const newStageType = getStageTypeForReseed();
  const newStage = getStageForReseed(newStageType);

  v.run.floorsReseeded.add(effectiveGreedModeStage);
  v.run.oldStage = newStage;
  v.run.oldStageType = newStageType;
  v.run.lastFloorReseeded = true;

  level.SetStage(newStage, newStageType);
  Isaac.ExecuteCommand("reseed");
}

function getStageTypeForReseed(): StageType {
  // Corpse --> The Shop (this if statement might be unnecessary)
  if (
    v.run.oldStage === LevelStage.WOMB_GREED_MODE &&
    v.run.oldStageType === StageType.REPENTANCE
  ) {
    return StageType.ORIGINAL;
  }

  // Sheol and later floors do not have any alt floors.
  if (onStageOrHigher(LevelStage.SHEOL_GREED_MODE)) {
    return StageType.ORIGINAL;
  }

  // First, handle the case where there should always be an alt path.
  if (config.altPathOnly) {
    // Womb only has one Repentance alt floor, Corpse (because Mortis was never implemented).
    return onStage(LevelStage.WOMB_GREED_MODE)
      ? StageType.REPENTANCE
      : getRandomArrayElement([StageType.REPENTANCE, StageType.REPENTANCE_B]);
  }

  // Womb only has one Repentance alt floor, Corpse (because Mortis was never implemented).
  if (onStage(LevelStage.WOMB_GREED_MODE)) {
    return getRandomArrayElement([
      StageType.ORIGINAL,
      StageType.WRATH_OF_THE_LAMB,
      StageType.AFTERBIRTH,
      StageType.REPENTANCE,
    ]);
  }

  return getRandomArrayElement([
    StageType.ORIGINAL,
    StageType.WRATH_OF_THE_LAMB,
    StageType.AFTERBIRTH,
    StageType.REPENTANCE,
    StageType.REPENTANCE_B,
  ]);
}

function getStageForReseed(newStageType: StageType): LevelStage {
  const effectiveGreedModeStage = getEffectiveGreedModeStage();

  // Corpse --> The Shop
  if (
    v.run.oldStage === LevelStage.WOMB_GREED_MODE &&
    v.run.oldStageType === StageType.REPENTANCE
  ) {
    return LevelStage.SHOP_GREED_MODE;
  }

  // e.g. Basement --> Downpour
  if (
    isRepentanceStage(newStageType) &&
    !isRepentanceStage(v.run.oldStageType)
  ) {
    return v.run.oldStage;
  }

  // e.g. Downpour --> Depths
  if (
    isRepentanceStage(v.run.oldStageType) &&
    !isRepentanceStage(newStageType)
  ) {
    return v.run.oldStage + 2;
  }

  if (
    onStage(v.run.oldStage) &&
    onStageType(v.run.oldStageType) &&
    !v.run.floorsReseeded.has(effectiveGreedModeStage)
  ) {
    const stage = getStage();
    return isRepentanceStage(newStageType) ? stage - 1 : stage;
  }

  return v.run.oldStage + 1;
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
