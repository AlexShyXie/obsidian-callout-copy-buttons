import classNames from "classnames";
import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";

type SourceModeSettings = {
  showCopyButtonOnlyOnLineHover: boolean;
};

type ReadingModeSettings = {
  showCopyMarkdownButton: boolean;
  showCopyPlainTextButton: boolean;
  showSelectCalloutButton: boolean;
};

type PluginSettings = {
  pluginVersion: "1.0.0"; // Useful to store now in case settings change and require migration in the future
  showCopyFormatIndicators: boolean;
  sourceModeSettings: SourceModeSettings;
  readingModeSettings: ReadingModeSettings;
};

type SettingKey = keyof PluginSettings;

/**
 * Deep-clones the given settings. There's currently only one nested object: `autoSelectionModes`.
 */
function deepCloneSettings(settings: PluginSettings): PluginSettings {
  const clone: PluginSettings = { ...settings };
  clone.sourceModeSettings = { ...settings.sourceModeSettings };
  clone.readingModeSettings = { ...settings.readingModeSettings };
  return clone;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  pluginVersion: "1.0.0",
  showCopyFormatIndicators: false,
  sourceModeSettings: {
    showCopyButtonOnlyOnLineHover: false,
  },
  readingModeSettings: {
    showCopyMarkdownButton: true,
    showCopyPlainTextButton: true,
    showSelectCalloutButton: true,
  },
};

export class PluginSettingsManager extends PluginSettingTab {
  private settings: PluginSettings = deepCloneSettings(DEFAULT_SETTINGS);

  constructor(private plugin: Plugin) {
    super(plugin.app, plugin);
  }

  public async setupSettingsTab(): Promise<void> {
    this.settings = await this.loadSettings();
    this.addSettingTab();
  }

  public getApp(): App {
    return this.plugin.app;
  }

  /**
   * Returns the class names for the copy buttons based on the plugin settings.
   */
  public getCopyButtonSettingsClassName(): string {
    return classNames(this.getCopyButtonSettingsClassNames());
  }

  private async loadSettings(): Promise<PluginSettings> {
    const loadedSettings = (await this.plugin.loadData()) as PluginSettings | null;
    if (loadedSettings !== null) {
      // Merge the reading mode settings with the defaults so that settings added in newer versions
      // have values for users upgrading from older versions of the plugin
      loadedSettings.readingModeSettings = {
        ...DEFAULT_SETTINGS.readingModeSettings,
        ...loadedSettings.readingModeSettings,
      };
      return loadedSettings;
    }
    return await this.initializeSettings();
  }

  private async initializeSettings(): Promise<PluginSettings> {
    const settings = deepCloneSettings(DEFAULT_SETTINGS);
    await this.plugin.saveData(settings);
    return settings;
  }

  private addSettingTab(): void {
    this.plugin.addSettingTab(this);
  }

  public getSetting<K extends SettingKey>(settingKey: K): PluginSettings[K] {
    return this.settings[settingKey];
  }

  private async setSetting<K extends SettingKey>(
    settingKey: K,
    value: PluginSettings[K]
  ): Promise<void> {
    this.settings[settingKey] = value;
    await this.saveSettings();
    this.refreshCalloutCopyButtonClassNames();
  }

  private refreshCalloutCopyButtonClassNames(): void {
    const newClassNames = this.getCopyButtonSettingsClassNames();
    const copyButtons = document.querySelectorAll(".callout-copy-button");
    for (const copyButton of copyButtons) {
      for (const [className, shouldAdd] of Object.entries(newClassNames)) {
        if (shouldAdd) {
          copyButton.addClass(className);
        } else {
          copyButton.removeClass(className);
        }
      }
    }
  }

  private getCopyButtonSettingsClassNames(): Record<string, boolean> {
    const showCopyFormatIndicators = this.getSetting("showCopyFormatIndicators");
    const { showCopyButtonOnlyOnLineHover } = this.getSetting("sourceModeSettings");
    const {
      showCopyMarkdownButton: showCopyMarkdownButton,
      showCopyPlainTextButton: showCopyPlainTextButton,
      showSelectCalloutButton: showSelectCalloutButton,
    } = this.getSetting("readingModeSettings");
    return {
      "show-copy-format-indicators": showCopyFormatIndicators,
      "show-source-mode-copy-button-only-on-line-hover": showCopyButtonOnlyOnLineHover,
      "show-reading-mode-copy-markdown-buttons": showCopyMarkdownButton,
      "show-reading-mode-copy-plain-text-buttons": showCopyPlainTextButton,
      "show-reading-mode-copy-select-buttons": showSelectCalloutButton,
    };
  }

  private async setSourceModeSetting<K extends keyof SourceModeSettings>(
    modeKey: K,
    value: SourceModeSettings[K]
  ): Promise<void> {
    const newSourceModeSettings = { ...this.settings.sourceModeSettings, [modeKey]: value };
    await this.setSetting("sourceModeSettings", newSourceModeSettings);
  }

  private async setReadingModeSetting<K extends keyof ReadingModeSettings>(
    modeKey: K,
    value: ReadingModeSettings[K]
  ): Promise<void> {
    const newReadingModeSettings = { ...this.settings.readingModeSettings, [modeKey]: value };
    await this.setSetting("readingModeSettings", newReadingModeSettings);
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    this.displayButtonAppearanceSettings();
    this.displaySourceModeSettings();
    this.displayReadingModeSettings();
  }

  private displayButtonAppearanceSettings(): void {
    new Setting(this.containerEl).setName("Appearance").setHeading();
    this.displayCopyFormatIndicatorsSetting();
  }

  private displayCopyFormatIndicatorsSetting(): void {
    new Setting(this.containerEl)
      .setName("Show copy format indicators on copy buttons")
      .setDesc(
        "Whether to add little 'P' (plain text) and 'M' (Markdown) indicators to the copy buttons that indicate what format the copied content will be in."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showCopyFormatIndicators)
          .onChange((value) => this.setSetting("showCopyFormatIndicators", value))
      );
  }

  private displaySourceModeSettings(): void {
    new Setting(this.containerEl).setName("Source mode").setHeading();
    this.displayShowCopyButtonOnlyOnLineHoverSetting();
  }

  private displayShowCopyButtonOnlyOnLineHoverSetting(): void {
    new Setting(this.containerEl)
      .setName("Show copy button only on line hover")
      .setDesc("If disabled, the copy buttons in Source Mode will always be visible.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.sourceModeSettings.showCopyButtonOnlyOnLineHover)
          .onChange((value) => this.setSourceModeSetting("showCopyButtonOnlyOnLineHover", value))
      );
  }

  private displayReadingModeSettings(): void {
    new Setting(this.containerEl).setName("Reading mode").setHeading();
    this.displayShowCopyMarkdownButtonSetting();
    this.displayShowCopyPlainTextButtonSetting();
    this.displayShowSelectCalloutButtonSetting();
  }

  private displayShowCopyMarkdownButtonSetting(): void {
    new Setting(this.containerEl)
      .setName("Show 'Copy (Markdown)' button")
      .setDesc("Whether to add 'Copy (Markdown)' buttons to callout blocks in Reading Mode.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.readingModeSettings.showCopyMarkdownButton)
          .onChange((value) => this.setReadingModeSetting("showCopyMarkdownButton", value))
      );
  }

  private displayShowCopyPlainTextButtonSetting(): void {
    new Setting(this.containerEl)
      .setName("Show 'Copy (plain text)' button")
      .setDesc("Whether to add 'Copy (plain text)' buttons to callout blocks in Reading Mode.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.readingModeSettings.showCopyPlainTextButton)
          .onChange((value) => this.setReadingModeSetting("showCopyPlainTextButton", value))
      );
  }

  private displayShowSelectCalloutButtonSetting(): void {
    new Setting(this.containerEl)
      .setName("Show 'Select (in editor)' button")
      .setDesc(
        "Whether to add 'Select (in editor)' buttons to callout blocks. Clicking one selects the whole callout block as plain text in the editor, switching from Reading Mode to the editor if needed."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.readingModeSettings.showSelectCalloutButton)
          .onChange((value) => this.setReadingModeSetting("showSelectCalloutButton", value))
      );
  }

  private async saveSettings(): Promise<void> {
    await this.plugin.saveData(this.settings);
  }
}
