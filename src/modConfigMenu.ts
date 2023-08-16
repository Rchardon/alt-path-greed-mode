import type { TupleWithMaxLength } from "isaacscript-common";
import { Config } from "./classes/Config";
import { mod } from "./mod";

/** From Racing+. */
type ConfigDescription = readonly [
  keyof Config | "",
  readonly [ModConfigMenuOptionType, string, string, string],
];

/** From Racing+. */
type ConfigDescriptions = TupleWithMaxLength<
  ConfigDescription,
  typeof MAX_CONFIG_PAGE_LENGTH
>;

/** From Racing+. */
const MAX_CONFIG_PAGE_LENGTH = 10;

const CATEGORY_NAME = "Alt Path Greed Mode";

const SETTINGS = [
  [
    "altPathOnly",
    [
      ModConfigMenuOptionType.BOOLEAN,
      "1",
      "Play on alt path only",
      "Play on alternate path only instead of the mix of regular and alternate floors",
    ],
  ],
] as const satisfies ConfigDescriptions;

const v = {
  persistent: {
    config: new Config(),
  },
};

export const { config } = v.persistent;

export function initModConfigMenu(): void {
  mod.saveDataManager("modConfigMenu", v);
  registerSubMenuConfig("Settings", SETTINGS);
}

/** From Racing+. */
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
        mod.saveDataManagerSave();
      },
      Info: [longDescription],
    });
  }
}

/** From Racing+. */
function getDisplayTextBoolean(
  configName: keyof Config,
  code: string,
  shortDescription: string,
): string {
  if (code === "") {
    return `${shortDescription}: n/a`;
  }

  const currentValue = config[configName];
  return `${code} - ${shortDescription}: ${onOff(currentValue)}`;
}

/** From Racing+. */
function onOff(setting: boolean): string {
  return setting ? "ON" : "OFF";
}
