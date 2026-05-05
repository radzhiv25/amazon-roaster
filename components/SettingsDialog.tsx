"use client";

import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface UserSettings {
  ollamaModel: string;
  ollamaBaseUrl: string;
  roastMode: "standard" | "harder" | "reRoast";
  roastLanguage: "english" | "hindi" | "hinglish";
  narratorPersona: "brenda" | "brandon";
  elevenLabsApiKey: string;
  elevenLabsVoiceIdFemale: string;
  elevenLabsVoiceIdMale: string;
  noizApiKey: string;
  noizVoiceIdFemale: string;
  noizVoiceIdMale: string;
  noizVoiceId: string;
  clearKeysAfterUse: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  ollamaModel: "gemma4:e2b",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  roastMode: "standard",
  roastLanguage: "english",
  narratorPersona: "brenda",
  elevenLabsApiKey: "",
  elevenLabsVoiceIdFemale: "",
  elevenLabsVoiceIdMale: "",
  noizApiKey: "",
  noizVoiceIdFemale: "",
  noizVoiceIdMale: "",
  noizVoiceId: "",
  clearKeysAfterUse: false,
};

const STORAGE_KEY = "amazon-roaster-settings";
const THEME_KEY = "amazon-roaster-theme";

export type ThemePreference = "system" | "light" | "dark";

export function getStoredSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UserSettings>;
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      const isLocalBaseUrl =
        merged.ollamaBaseUrl.includes("127.0.0.1") ||
        merged.ollamaBaseUrl.includes("localhost");

      // Migrate legacy cloud-tagged model defaults when pointing to local Ollama.
      if (isLocalBaseUrl && merged.ollamaModel.endsWith(":cloud")) {
        merged.ollamaModel = DEFAULT_SETTINGS.ollamaModel;
      }

      return merged;
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

export function clearSensitiveSettings(): void {
  if (typeof window === "undefined") return;
  const current = getStoredSettings();
  saveSettings({
    ...current,
    elevenLabsApiKey: "",
    noizApiKey: "",
  });
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function applyThemePreference(theme: ThemePreference): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", resolvedDark);
}

export function saveThemePreference(theme: ThemePreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyThemePreference(theme);
}

export function validateUserSettings(settings: UserSettings): string[] {
  void settings;
  return [];
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredThemePreference());

  const handleSave = () => {
    const errors = validateUserSettings(settings);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    saveSettings(settings);
    saveThemePreference(theme);
    toast.success("Settings saved");
    setOpen(false);
  };

  const handleClear = () => {
    if (confirm("Clear all saved settings?")) {
      localStorage.removeItem(STORAGE_KEY);
      setSettings(DEFAULT_SETTINGS);
      toast.success("Saved settings cleared");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute right-4 top-4">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure your API keys here. Only keys and voice IDs saved in this dialog are used.
            Keys are stored locally in your browser and never sent to any server.
          </p>

          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Appearance</h3>
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-muted-foreground">Theme</Label>
              <Tabs value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
                <TabsList className="bg-muted/40 border border-border">
                  <TabsTrigger value="system">System</TabsTrigger>
                  <TabsTrigger value="light">Light</TabsTrigger>
                  <TabsTrigger value="dark">Dark</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </section>

          {/* Ollama Settings */}
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Ollama (LLM)</h3>
            <div className="grid gap-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                <Input
                  value={settings.ollamaModel}
                  onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                  placeholder="gemma4:e2b"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use any local model tag available in your Ollama (for example: <code>gemma4:e2b</code>,{" "}
                  <code>llama3.1:8b</code>, <code>qwen2.5:7b</code>).
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Base URL</Label>
                <Input
                  value={settings.ollamaBaseUrl}
                  onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                  placeholder="http://127.0.0.1:11434"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Roast Persona (LLM)</h3>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Narrator</Label>
              <RadioGroup
                value={settings.narratorPersona}
                onValueChange={(v) =>
                  setSettings({ ...settings, narratorPersona: v as UserSettings["narratorPersona"] })
                }
              >
                <Label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <RadioGroupItem value="brenda" />
                  Brenda
                </Label>
                <Label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <RadioGroupItem value="brandon" />
                  Brandon
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-2 flex flex-col">
              <Label className="text-sm font-medium text-muted-foreground">Roast mode</Label>
              <Tabs
                value={settings.roastMode}
                onValueChange={(v) =>
                  setSettings({ ...settings, roastMode: v as UserSettings["roastMode"] })
                }
              >
                <TabsList className="bg-muted/40 border border-border">
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="harder">Harder</TabsTrigger>
                  <TabsTrigger value="reRoast">Re-roast</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2 flex flex-col">
              <Label className="text-sm font-medium text-muted-foreground">Roast language</Label>
              <Tabs
                value={settings.roastLanguage}
                onValueChange={(v) =>
                  setSettings({ ...settings, roastLanguage: v as UserSettings["roastLanguage"] })
                }
              >
                <TabsList className="bg-muted/40 border border-border">
                  <TabsTrigger value="english">English</TabsTrigger>
                  <TabsTrigger value="hindi">Hindi</TabsTrigger>
                  <TabsTrigger value="hinglish">Hinglish</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </section>

          {/* Primary TTS Settings */}
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Primary TTS Provider (Optional)</h3>
            <div className="grid gap-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">API Key</Label>
                <Input
                  type="password"
                  value={settings.elevenLabsApiKey}
                  onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Voice ID (Female)</Label>
                  <Input
                    value={settings.elevenLabsVoiceIdFemale}
                    onChange={(e) => setSettings({ ...settings, elevenLabsVoiceIdFemale: e.target.value })}
                    placeholder="voice_id"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Voice ID (Male)</Label>
                  <Input
                    value={settings.elevenLabsVoiceIdMale}
                    onChange={(e) => setSettings({ ...settings, elevenLabsVoiceIdMale: e.target.value })}
                    placeholder="voice_id"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Fallback TTS Settings */}
          <section className="space-y-3">
            <h3 className="font-semibold text-foreground">Fallback TTS Provider (Optional)</h3>
            <div className="grid gap-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">API Key</Label>
                <Input
                  type="password"
                  value={settings.noizApiKey}
                  onChange={(e) => setSettings({ ...settings, noizApiKey: e.target.value })}
                  placeholder="noiz_api_key"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Voice ID (Female)</Label>
                  <Input
                    value={settings.noizVoiceIdFemale}
                    onChange={(e) => setSettings({ ...settings, noizVoiceIdFemale: e.target.value })}
                    placeholder="voice_id"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Voice ID (Male)</Label>
                  <Input
                    value={settings.noizVoiceIdMale}
                    onChange={(e) => setSettings({ ...settings, noizVoiceIdMale: e.target.value })}
                    placeholder="voice_id"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Legacy Voice ID (Optional)</Label>
                <Input
                  value={settings.noizVoiceId}
                  onChange={(e) => setSettings({ ...settings, noizVoiceId: e.target.value })}
                  placeholder="fallback voice_id"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used only when gender-specific Noiz voice IDs are not set.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="inline-flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={settings.clearKeysAfterUse}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, clearKeysAfterUse: checked === true })
                }
              />
              Clear API keys from local storage after a successful roast
            </Label>
            <p className="text-xs text-muted-foreground">
              This only clears local browser keys after request success.
            </p>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1">
              Save Settings
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
