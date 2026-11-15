// Contract between the app core (shared/) and each system: visual kit (UI slots), navigation and labels.
import type { FC, ReactNode } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { t } from "./i18n";

export type FieldProps = { value: string; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; onSubmit?: () => void; label: string; multiline?: boolean };
export type UI = {
  Frame: FC<{ title?: string; wide?: boolean; children: ReactNode }>; // screen frame: Parchment (Avatar) / Infernal (D&D)
  Button: FC<{ label: string; onPress: () => void; disabled?: boolean; ghost?: boolean; small?: boolean }>;
  Chip: FC<{ label: string; on: boolean; onPress: () => void; color?: string; disabled?: boolean }>;
  Field: FC<FieldProps>;
  Spinner: FC; // sobre a moldura
  night: StyleProp<ViewStyle>; // full-screen background (login, loading)
  splash: string; // spinner color over the `night` background
  t: {
    p: StyleProp<TextStyle>; hint: StyleProp<TextStyle>; err: StyleProp<TextStyle>; label: StyleProp<TextStyle>; intro?: StyleProp<TextStyle>;
    row: StyleProp<ViewStyle>; chips: StyleProp<ViewStyle>; input: StyleProp<ViewStyle>; picker: StyleProp<TextStyle>;
    box: StyleProp<ViewStyle>; item: StyleProp<ViewStyle>; itemName: StyleProp<TextStyle>; itemSub: StyleProp<TextStyle>; hover: StyleProp<ViewStyle>;
  };
  c: { warn: string; danger: string; mundo: string; ok: string; border: string };
  Ornament: FC;
};

export type Nav = { home(): void; open(id: string): void; create(arg?: unknown): void; logout(): void; master(): void; rules(): void };

// Core labels, in the current language (call on every render: `t()` reads the current language). Each system can override keys.
const SRC: Record<string, string> = { "padrão": "default", mundo: "world", "sem regra": "none" }; // the old module sent the text in pt
export const srcLabel = (src: string) => t(`ruleSrc.${SRC[src] ?? src}`);
export const defaultLabels = () => ({
  welcome: (name: string) => t("welcome", { name }),
  yours: t("yours"),
  none: t("none"),
  create: t("create"),
  master: t("master"),
  rules: t("rules"),
  del: t("del"),
  delWhich: t("delWhich"),
  delHint: t("delHint"),
  delType: (name: string) => t("delType", { name }),
  delDo: t("delDo"),
  cancel: t("cancel"),
  pw: t("pw"),
  pwOld: t("pwOld"),
  pwNew: t("pwNew"),
  pwSave: t("pwSave"),
  logout: t("logout"),
  loginTitle: t("loginTitle"),
  loginIntro: t("loginIntro"),
  loginWho: t("loginWho"),
  loginPick: t("loginPick"),
  loginPw: t("loginPw"),
  enter: t("enter"),
  entering: t("entering"),
  errTitle: t("errTitle"),
  errHint: t("errHint"),
  back: t("back"),
  rulesBack: t("rulesBack"),
  rulesBackList: t("rulesBackList"),
  rulesPick: t("rulesPick"),
  rulesSearch: t("rulesSearch"),
  rulesOwn: t("rulesOwn"),
  rulesName: t("rulesName"),
  rulesText: t("rulesText"),
  rulesIn: t("rulesIn"),
  rulesAdd: t("rulesAdd"),
  rulesNew: t("rulesNew"),
  rulesRemove: t("rulesRemove"),
  rulesSave: t("rulesSave"),
  rulesReset: t("rulesReset"),
  rulesSaved: t("rulesSaved"),
  rulesResetDone: t("rulesResetDone"),
  rulesBadJson: t("rulesBadJson"),
  rulesRows: (n: number, src: string) => t("rulesRows", { n, src: srcLabel(src) }),
  rulesRules: (src: string) => t("rulesRules", { src: srcLabel(src) }),
  search: t("search")
});
export type Labels = ReturnType<typeof defaultLabels>;
