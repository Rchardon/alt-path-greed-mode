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
  ISCFeature,
  ModCallbackCustom,
  getGridEntities,
  getRoomVariant,
  removeGridEntity,
  spawnGridEntityWithVariant,
  upgradeMod,
} from "isaacscript-common";
import { Config } from "./types/Config";

const MOD_NAME = "alt-path-greed-mode";
const CATEGORY_NAME = "Alt Path Greed Mode";
const GREED_PLATE_GRID_INDEX = 112;

const v = {
  floorReseeded: [false, false, false, false],
  persistent: {
    config: new Config(),
  },
  oldStage: 0,
  oldStageType: 0,
  lastFloorReseeded: false,
  rotgutDefeated: false,
  corpseDDSpawned: false,
};

export const { config } = v.persistent;
// Instantiate a new mod object, which grants the ability to add callback functions that correspond
// to in-game events.
const modVanilla = RegisterMod(MOD_NAME, 1);
const features = [ISCFeature.SAVE_DATA_MANAGER] as const;
const mod = upgradeMod(modVanilla, features);

export function main(): void {
  mod.saveDataManager("modConfigMenu", v);

  registerSubMenuConfig("Settings", SETTINGS);

  mod.AddCallback(ModCallback.POST_PLAYER_INIT, postPlayerInit);
  mod.AddCallbackCustom(
    ModCallbackCustom.POST_NEW_LEVEL_REORDERED,
    postNewLevel,
  );
  mod.AddCallback(ModCallback.POST_NPC_INIT, postNPCInit);
  mod.AddCallbackCustom(ModCallbackCustom.POST_NEW_ROOM_REORDERED, postNewRoom);
  mod.AddCallback(ModCallback.POST_NPC_DEATH, postNPCDeath);

  // Print an initialization message to the "log.txt" file.
  Isaac.DebugString(`${MOD_NAME} initialized.`);
}

function postPlayerInit() {
  v.floorReseeded[0] = false;
  v.floorReseeded[1] = false;
  v.floorReseeded[2] = false;
  v.floorReseeded[3] = false;
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
      v.oldStage = stage;
      v.oldStageType = stageType;
    } else if (
      (stage !== 1 &&
        stage <= 5 &&
        stageType !== 4 &&
        stageType !== 5 &&
        !v.floorReseeded[getEffectiveGreedModeStage() - 2] &&
        !v.lastFloorReseeded) ||
      (v.oldStage === stage - 1 &&
        (v.oldStageType === 4 || v.oldStageType === 5) &&
        v.floorReseeded[getEffectiveGreedModeStage() - 2])
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

function registerSubMenuConfig(
  subMenuName: string,
  descriptions: ConfigDescriptions,
) {
  if (ModConfigMenu === undefined) {
    return;
  }

  for (const [configName, array] of descriptions) {
    const [optionType, code, shortDescription, longDescription] = array;

    ModConfigMenu.AddSetting(CATEGORY_NAME, subMenuName, {
      Type: optionType,
      CurrentSetting: () => config[configName!],
      Display: () => getDisplayTextBoolean(configName!, code, shortDescription),
      OnChange: (newValue: number | boolean | undefined) => {
        if (newValue === undefined) {
          return;
        }

        config[configName!] = newValue as boolean;
        mod.saveDataManagerSave();
      },
      Info: [longDescription],
    });
  }
}

function getDisplayTextBoolean(
  configName: keyof Config,
  code: string,
  shortDescription: string,
) {
  switch (code) {
    case "": {
      return `${shortDescription}: n/a`;
    }

    default: {
      const currentValue = config[configName];
      return `${code} - ${shortDescription}: ${onOff(currentValue)}`;
    }
  }
}

function onOff(setting: boolean) {
  return setting ? "ON" : "OFF";
}

export type ConfigDescriptions = Array<
  [keyof Config | null, [ModConfigMenuOptionType, string, string, string]]
>;

const SETTINGS: ConfigDescriptions = [
  [
    "altPathOnly",
    [
      ModConfigMenuOptionType.BOOLEAN,
      "1",
      "Play on alt path only",
      "Play on alternate path only instead of the mix of regular and alternate floors",
    ],
  ],
] as const;

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
