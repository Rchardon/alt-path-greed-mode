import {
  saveDataManager,
  saveDataManagerSave,
  upgradeMod,
} from "isaacscript-common";
import { Config } from "./types/Config";

const MOD_NAME = "alt-path-greed-mode";
const CATEGORY_NAME = "Alt Path Greed Mode";

const v = {
  floorReseeded: [false, false, false, false, false],
  persistent: {
    config: new Config(),
  },
  oldStage: 0,
  oldStageType: 0,
};

export const config = v.persistent.config;

export function main(): void {
  // Instantiate a new mod object, which grants the ability to add callback functions that
  // correspond to in-game events
  const modVanilla = RegisterMod(MOD_NAME, 1);
  const mod = upgradeMod(modVanilla);

  saveDataManager("modConfigMenu", v);

  registerSubMenuConfig("Major", MAJOR);

  mod.AddCallback(ModCallbacks.MC_POST_PLAYER_INIT, postPlayerInit);
  mod.AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, postNewLevel);
  mod.AddCallback(ModCallbacks.MC_POST_NPC_INIT, postNPCInit);

  // Print an initialization message to the "log.txt" file
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

    Isaac.DebugString(
      `floor ${getEffectiveGreedModeStage().toString()} reseeded ${
        v.floorReseeded[getEffectiveGreedModeStage() - 2]
      }`,
    );

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
        !v.floorReseeded[getEffectiveGreedModeStage() - 2]) ||
      (v.oldStage === stage - 1 &&
        (v.oldStageType === 4 || v.oldStageType === 5) &&
        v.floorReseeded[getEffectiveGreedModeStage() - 2])
    ) {
      reseed(stage, stageType, level);
    }
  }
}

function reseed(stage: number, stageType: number, level: Level) {
  const stage123StageTypes = [0, 1, 2, 4, 5];
  const stage4StageTypes = [0, 1, 2, 4];

  Isaac.DebugString(`stage ${stage.toString()}`);
  Isaac.DebugString(`stageType ${level.GetStageType().toString()}`);
  Isaac.DebugString(`oldstage ${v.oldStage.toString()}`);
  Isaac.DebugString(`oldstageType ${v.oldStageType.toString()}`);
  let newStageType;

  if (config.altPathOnly) {
    if (stage === 4) {
      newStageType = 4;
    } else {
      newStageType = math.random(4, 5);
    }
  } else if (v.oldStage === 4 && v.oldStageType === 4) {
    newStageType = 0;
  } else if (stage === 4 || stage === 5) {
    newStageType = stage4StageTypes[math.random(0, 3)];
  } else {
    newStageType = stage123StageTypes[math.random(0, 4)];
  }

  let newStage;

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

  Isaac.DebugString(`newStage ${newStage.toString()}`);
  Isaac.DebugString(`newStageType ${newStageType.toString()}`);

  level.SetStage(newStage, newStageType);
  v.oldStage = newStage;
  v.oldStageType = newStageType;
  Isaac.ExecuteCommand("reseed");
}

function postNPCInit(npc: EntityNPC) {
  const level = Game().GetLevel();
  const stage = level.GetStage();

  if (npc.Type !== EntityType.ENTITY_PIN) {
    return;
  }

  if (
    Game().IsGreedMode() &&
    stage === 4 &&
    npc.Type === EntityType.ENTITY_PIN &&
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
      CurrentSetting: () => config[configName as keyof Config],
      Display: () =>
        getDisplayTextBoolean(
          configName as keyof Config,
          code,
          shortDescription,
        ),
      OnChange: (newValue: number | boolean | undefined) => {
        if (newValue === undefined) {
          return;
        }

        config[configName as keyof Config] = newValue as boolean;
        saveDataManagerSave();
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

const MAJOR: ConfigDescriptions = [
  [
    "altPathOnly",
    [
      ModConfigMenuOptionType.BOOLEAN,
      "1",
      "Play on alt path only",
      "Play on alternate path only instead of the mix of regular and alternate floors",
    ],
  ],
];

function getEffectiveGreedModeStage(): number {
  const level = Game().GetLevel();
  const stage = level.GetStage();
  const stageType = level.GetStageType();

  if (stageType === 4 || stageType === 5) {
    return stage + 1;
  }

  return stage;
}
