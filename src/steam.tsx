import { ErrorBoundary, Navigation, afterPatch, callOriginal, findClassModule, replacePatch } from "@decky/ui";
import { ToastData, toaster } from "@decky/api";
import { createElement } from "react";
import { getCurrentSettings } from "./settings";
import { ensureMainWindowCSS, mainDocument } from "./mainWindow";
import { AchievementToast, ToastAchievement, ToastEdge } from "./toast";

// EClientNotificationType.Achievement
const ACHIEVEMENT_TYPE = 5;
// Toast render locations: 1 = Gamepad UI popup, 3 = Quick Access notifications tray.
const POPUP_LOCATION = 1;
// Steam's notification sound ids; Decky's default is ToastMisc (6).
const SOUND_ACHIEVEMENT = 5;
const CSS_CLASS_RE = /^[A-Za-z0-9_-]+$/;

const win = globalThis as typeof globalThis & {
  __TOASTER_INSTANCE?: { toastPatch?: { object?: { component?: unknown } } };
  NotificationStore?: NotificationStore;
};

interface NotificationTarget {
  proto?: { fromObject?: (fields: Record<string, unknown>) => unknown };
  [key: string]: unknown;
}

interface NotificationStore {
  GetNotificationTargets?: () => Record<number, NotificationTarget | undefined>;
  ProcessNotification?: (info: NotificationTarget, toast: Record<string, unknown>, type: number) => void;
  PopNextToastNotification?: (appid: number) => unknown;
  m_nNextTestNotificationID?: number;
}

interface ToastGroup {
  eType?: number;
  decky?: boolean;
  notifications?: { notificationID?: number; data?: unknown }[];
}

interface ToastRenderProps {
  location?: number;
  group?: ToastGroup;
  onDismiss?: () => void;
}

type ProtoGetters = Record<string, (() => unknown) | undefined>;

function field<T>(data: ProtoGetters, key: string, kind: "string" | "number" | "boolean", fallback: T): T {
  try {
    const value = data[key]?.();
    return typeof value === kind ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

// The popup notification's `data` is the deserialized CClientNotificationAchievement protobuf.
function readAchievement(data: unknown): ToastAchievement | null {
  if (!data || typeof data !== "object") return null;
  const d = data as ProtoGetters;
  const name = field(d, "name", "string", "");
  if (!name) return null;
  return {
    appid: field(d, "appid", "number", 0),
    id: field(d, "achievement_id", "string", ""),
    name,
    description: field(d, "description", "string", ""),
    image: field(d, "image_url", "string", ""),
    achieved: field(d, "achieved", "boolean", true),
    globalPct: field(d, "global_achieved_pct", "number", 0),
    progress: {
      min: field(d, "min_progress", "number", 0),
      current: field(d, "current_progress", "number", 0),
      max: field(d, "max_progress", "number", 0),
    },
  };
}

// Marker carried by the fallback Decky toast so the render patch can pick it up.
interface MarkedToastData extends ToastData {
  achievementToast?: ToastAchievement;
}

function achievementFromProps(props: ToastRenderProps): ToastAchievement | null {
  const group = props.group;
  const first = group?.notifications?.[0];
  if (!group || !first) return null;
  if (group.decky) return (first.data as MarkedToastData | undefined)?.achievementToast ?? null;
  return group.eType === ACHIEVEMENT_TYPE ? readAchievement(first.data) : null;
}

function openAchievements(appid: number): void {
  if (appid > 0) Navigation.Navigate(`/library/app/${appid}/achievements`);
}

// Decky trampolines Valve's toast renderer and swaps its `component`; stacking a
// patch on that same object lets this run first and hand everything else back.
export function installToastRenderPatch(): () => void {
  const host = win.__TOASTER_INSTANCE?.toastPatch?.object;
  if (!host || typeof host.component !== "function") {
    console.warn("[AchievementCustomizer] Decky toast renderer not found; native toasts stay stock");
    return () => {};
  }
  const patch = replacePatch(host, "component", (args: unknown[]) => {
    const props = args[0] as ToastRenderProps | undefined;
    if (!props || props.location !== POPUP_LOCATION) return callOriginal;
    const achievement = achievementFromProps(props);
    if (!achievement) return callOriginal;
    ensureMainWindowCSS();
    // Keyed per notification so a follow-up toast remounts and replays its entrance.
    return createElement(
      ErrorBoundary,
      { key: props.group?.notifications?.[0]?.notificationID ?? achievement.id },
      createElement(AchievementToast, {
        achievement,
        settings: getCurrentSettings(),
        mode: "live",
        edgeOf: readToastEdge,
        onActivate: () => {
          openAchievements(achievement.appid);
          props.onDismiss?.();
        },
      }),
    );
  });
  return () => patch.unpatch();
}

// The toast host takes the next toast from this method right before rendering it
// and reads nToastDurationMS from that object, so this is where the user's
// duration goes. (ProcessNotification is a bound, non-writable MobX action.)
export function installDurationPatch(): () => void {
  const store = win.NotificationStore;
  if (!store || typeof store.PopNextToastNotification !== "function") return () => {};
  const patch = afterPatch(store, "PopNextToastNotification", (_args: unknown[], toast: unknown) => {
    const t = toast as { eType?: number; decky?: boolean; nToastDurationMS?: number } | undefined;
    if (t && t.eType === ACHIEVEMENT_TYPE && !t.decky) t.nToastDurationMS = getCurrentSettings().duration;
    return toast;
  });
  return () => patch.unpatch();
}

// Sends a real achievement notification through Steam's own pipeline (same sound,
// same renderer, same duration as an unlock) without adding it to the tray.
export function fireTestAchievement(a: ToastAchievement): void {
  const store = win.NotificationStore;
  const target = store?.GetNotificationTargets?.()[ACHIEVEMENT_TYPE];
  const fromObject = target?.proto?.fromObject;
  if (store?.ProcessNotification && target && fromObject) {
    try {
      const data = fromObject.call(target.proto, {
        achievement_id: a.id,
        appid: a.appid,
        name: a.name,
        description: a.description,
        image_url: a.image,
        achieved: a.achieved,
        rtime_unlocked: a.achieved ? Math.floor(Date.now() / 1000) : 0,
        min_progress: a.progress?.min ?? 0,
        current_progress: a.progress?.current ?? 0,
        max_progress: a.progress?.max ?? 0,
        global_achieved_pct: a.globalPct,
      });
      const id = store.m_nNextTestNotificationID ?? 10000;
      store.m_nNextTestNotificationID = id + 1;
      store.ProcessNotification(
        { ...target, fnTray: null },
        {
          notificationID: id,
          rtCreated: Math.floor(Date.now() / 1000),
          eType: ACHIEVEMENT_TYPE,
          nToastDurationMS: 0,
          eSource: 1,
          data,
          bNewIndicator: true,
        },
        0,
      );
      return;
    } catch (e) {
      console.warn("[AchievementCustomizer] native test toast failed, using Decky toast", e);
    }
  }

  const toast: MarkedToastData = {
    title: a.name,
    body: a.description,
    logo: createElement("img", { src: a.image, style: { width: 40, height: 40, objectFit: "cover" } }),
    sound: SOUND_ACHIEVEMENT,
    duration: getCurrentSettings().duration,
    achievementToast: a,
  };
  toaster.toast(toast);
}

// Class names of Steam's toast placeholder module, resolved by semantic key so
// re-hashed builds keep working. Missing keys mean the window stays stock size.
interface ToastWindowClasses {
  placeholder: string;
  inGame: string;
  positionTop: string;
  positionLeft: string;
}

let cachedWindowClasses: ToastWindowClasses | null | undefined;

function resolveToastWindowClasses(): ToastWindowClasses | null {
  if (cachedWindowClasses !== undefined) return cachedWindowClasses;
  cachedWindowClasses = null;
  try {
    const m = findClassModule((mod) => mod.GamepadToastPlaceholder && mod.GamepadToastPopup) ?? {};
    const pick = (key: string) => (CSS_CLASS_RE.test(m[key] ?? "") ? m[key] : "");
    const resolved = {
      placeholder: pick("GamepadToastPlaceholder"),
      inGame: pick("InGame"),
      positionTop: pick("PositionTop"),
      positionLeft: pick("PositionLeft"),
    };
    if (resolved.placeholder && resolved.inGame && resolved.positionTop && resolved.positionLeft) {
      cachedWindowClasses = resolved;
    }
  } catch (e) {
    console.warn("[AchievementCustomizer] toast placeholder classes unavailable:", e);
  }
  return cachedWindowClasses;
}

// Steam sizes the notification window from this placeholder (stock: 300x40 plus
// 20px padding on top/bottom/left, anchored 30px from the bottom; 50px from the
// top; 10px closer to the edge in game). Growing the padding and moving the
// anchors by the same amount keeps every stock toast at its exact screen
// position while the window becomes 320x128 (320x152 in game, where the card
// sits so close to the edge that ours has to be bottom-anchored instead).
export function buildToastWindowCSS(): string {
  const c = resolveToastWindowClasses();
  if (!c) return "";
  const ph = `.${c.placeholder}`;
  return `
    ${ph} { height: 40px !important; padding: 44px 0 44px 20px !important; bottom: 6px !important; }
    ${ph}.${c.positionLeft} { padding: 44px 20px 44px 0 !important; }
    ${ph}.${c.inGame} { bottom: -46px !important; padding: 68px 0 44px 20px !important; }
    ${ph}.${c.inGame}.${c.positionLeft} { padding: 68px 20px 44px 0 !important; }
    ${ph}.${c.positionTop} { top: 26px !important; bottom: unset !important; }
    ${ph}.${c.positionTop}.${c.inGame} { top: -26px !important; }
  `;
}

// The popup element carries the same position classes as the placeholder; the
// in-game flag only exists on the placeholder in the main window.
export function readToastEdge(root: HTMLElement): ToastEdge {
  const c = resolveToastWindowClasses();
  const classes = root.parentElement?.classList;
  const placeholder = c && mainDocument()?.querySelector(`.${c.placeholder}`);
  return {
    top: !!c && !!classes?.contains(c.positionTop),
    left: !!c && !!classes?.contains(c.positionLeft),
    inGame: !!c && !!placeholder?.classList.contains(c.inGame),
  };
}
