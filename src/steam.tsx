/**
 * @fileoverview The only file that touches Valve and Decky internals. Every
 * access is optional and failures fall back to stock Steam behavior.
 */

import {type ToastData, toaster} from '@decky/api';
import {
  ErrorBoundary,
  Navigation,
  afterPatch,
  callOriginal,
  findClassModule,
  replacePatch,
} from '@decky/ui';
import {createElement} from 'react';

import {ensureMainWindowCss, mainDocument} from './main_window';
import {getCurrentSettings} from './settings';
import {type ToastAchievement, type ToastEdge, AchievementToast} from './toast';

// EClientNotificationType.Achievement
const ACHIEVEMENT_TYPE = 5;
// Toast render locations: 1 = Gamepad UI popup, 3 = Quick Access notifications
// tray.
const POPUP_LOCATION = 1;
// Steam's notification sound ids; Decky's default is ToastMisc (6).
const SOUND_ACHIEVEMENT = 5;
// ProcessNotification's update kind: 0 = New, 1 = Update, 2 = Remove.
const NEW_NOTIFICATION = 0;
// ENotificationSource: 1 = client, 2 = server.
const CLIENT_SOURCE = 1;
const FIRST_TEST_NOTIFICATION_ID = 10000;
const CSS_CLASS_PATTERN = /^[A-Za-z0-9_-]+$/;

interface NotificationTarget {
  proto?: {fromObject?: (fields: Record<string, unknown>) => unknown};
  [key: string]: unknown;
}

interface NotificationStore {
  GetNotificationTargets?: () => Record<number, NotificationTarget | undefined>;
  ProcessNotification?: (
    target: NotificationTarget,
    toast: Record<string, unknown>,
    updateKind: number,
  ) => void;
  PopNextToastNotification?: (appId: number) => unknown;
  m_nNextTestNotificationID?: number;
}

interface ToastNotification {
  notificationID?: number;
  data?: unknown;
}

interface ToastGroup {
  eType?: number;
  decky?: boolean;
  notifications?: ToastNotification[];
}

interface ToastRenderProps {
  location?: number;
  group?: ToastGroup;
  onDismiss?: () => void;
}

interface PoppedToast {
  eType?: number;
  decky?: boolean;
  nToastDurationMS?: number;
}

/** A deserialized protobuf message: each field is a getter method. */
interface ProtoMessage {
  [field: string]: (() => unknown) | undefined;
}

// Decky and Steam install these on the shared context's global object.
const steamGlobals = globalThis as typeof globalThis & {
  __TOASTER_INSTANCE?: {toastPatch?: {object?: {component?: unknown}}};
  NotificationStore?: NotificationStore;
};

/** Calls a protobuf getter; a missing or throwing getter reads as undefined. */
function readField(message: ProtoMessage, field: string): unknown {
  try {
    return message[field]?.();
  } catch {
    return undefined;
  }
}

function stringField(message: ProtoMessage, field: string): string {
  const value = readField(message, field);
  return typeof value === 'string' ? value : '';
}

function numberField(message: ProtoMessage, field: string): number {
  const value = readField(message, field);
  return typeof value === 'number' ? value : 0;
}

function booleanField(message: ProtoMessage, field: string): boolean {
  const value = readField(message, field);
  return typeof value === 'boolean' ? value : true;
}

// The popup notification's `data` is the deserialized
// CClientNotificationAchievement protobuf.
function readAchievement(data: unknown): ToastAchievement | null {
  if (!data || typeof data !== 'object') return null;
  // Protobuf messages expose each field as a getter method.
  const message = data as ProtoMessage;
  const name = stringField(message, 'name');
  if (!name) return null;
  return {
    appId: numberField(message, 'appid'),
    id: stringField(message, 'achievement_id'),
    name,
    description: stringField(message, 'description'),
    image: stringField(message, 'image_url'),
    achieved: booleanField(message, 'achieved'),
    globalPercent: numberField(message, 'global_achieved_pct'),
    progress: {
      min: numberField(message, 'min_progress'),
      current: numberField(message, 'current_progress'),
      max: numberField(message, 'max_progress'),
    },
  };
}

// Marker carried by the fallback Decky toast so the render patch can pick it
// up.
interface MarkedToastData extends ToastData {
  achievementToast?: ToastAchievement;
}

function achievementFromProps(
  props: ToastRenderProps,
): ToastAchievement | null {
  const group = props.group;
  const first = group?.notifications?.[0];
  if (!group || !first) return null;
  if (group.decky) {
    // Decky toasts carry the ToastData they were created with.
    const data = first.data as MarkedToastData | undefined;
    return data?.achievementToast ?? null;
  }
  return group.eType === ACHIEVEMENT_TYPE ? readAchievement(first.data) : null;
}

function openAchievements(appId: number): void {
  if (appId > 0) Navigation.Navigate(`/library/app/${appId}/achievements`);
}

/**
 * Renders achievement popups with AchievementToast and hands every other toast
 * back to Steam. Returns the uninstaller.
 *
 * Decky trampolines Valve's toast renderer and swaps its `component`; stacking
 * a patch on that same object lets this run first.
 */
export function installToastRenderPatch(): () => void {
  const host = steamGlobals.__TOASTER_INSTANCE?.toastPatch?.object;
  if (!host || typeof host.component !== 'function') {
    console.warn(
      '[AchievementCustomizer] Decky toast renderer not found; native toasts stay stock',
    );
    return () => {};
  }
  const patch = replacePatch(host, 'component', (args: unknown[]) => {
    // Valve's renderer receives its props as the only argument.
    const props = args[0] as ToastRenderProps | undefined;
    if (!props || props.location !== POPUP_LOCATION) return callOriginal;
    const achievement = achievementFromProps(props);
    if (!achievement) return callOriginal;
    ensureMainWindowCss();
    // Keyed per notification so a follow-up toast remounts and replays its
    // entrance.
    return createElement(
      ErrorBoundary,
      {key: props.group?.notifications?.[0]?.notificationID ?? achievement.id},
      createElement(AchievementToast, {
        achievement,
        settings: getCurrentSettings(),
        mode: 'live',
        edgeOf: readToastEdge,
        onActivate: () => {
          openAchievements(achievement.appId);
          props.onDismiss?.();
        },
      }),
    );
  });
  return () => {
    patch.unpatch();
  };
}

/**
 * Applies the user's display duration to achievement toasts. Returns the
 * uninstaller.
 *
 * The toast host takes the next toast from PopNextToastNotification right
 * before rendering it and reads nToastDurationMS from that object.
 * (ProcessNotification is a bound, non-writable MobX action.)
 */
export function installDurationPatch(): () => void {
  const store = steamGlobals.NotificationStore;
  if (!store || typeof store.PopNextToastNotification !== 'function') {
    return () => {};
  }
  // The handler gets the call's arguments, then its return value.
  const patch = afterPatch(
    store,
    'PopNextToastNotification',
    (...[, popped]: [unknown[], unknown]) => {
      // The store's queue holds toast objects (or nothing).
      const toast = popped as PoppedToast | undefined;
      if (toast && toast.eType === ACHIEVEMENT_TYPE && !toast.decky) {
        toast.nToastDurationMS = getCurrentSettings().duration;
      }
      return popped;
    },
  );
  return () => {
    patch.unpatch();
  };
}

/**
 * Sends a real achievement notification through Steam's own pipeline (same
 * sound, renderer and duration as an unlock) without adding it to the tray.
 * Falls back to a Decky toast that the render patch also handles.
 */
export function fireTestAchievement(achievement: ToastAchievement): void {
  const store = steamGlobals.NotificationStore;
  const target = store?.GetNotificationTargets?.()[ACHIEVEMENT_TYPE];
  const fromObject = target?.proto?.fromObject;
  if (store?.ProcessNotification && target && fromObject) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      const data = fromObject.call(target.proto, {
        achievement_id: achievement.id,
        appid: achievement.appId,
        name: achievement.name,
        description: achievement.description,
        image_url: achievement.image,
        achieved: achievement.achieved,
        rtime_unlocked: achievement.achieved ? nowSeconds : 0,
        min_progress: achievement.progress?.min ?? 0,
        current_progress: achievement.progress?.current ?? 0,
        max_progress: achievement.progress?.max ?? 0,
        global_achieved_pct: achievement.globalPercent,
      });
      const id = store.m_nNextTestNotificationID ?? FIRST_TEST_NOTIFICATION_ID;
      store.m_nNextTestNotificationID = id + 1;
      store.ProcessNotification(
        {...target, fnTray: null},
        {
          notificationID: id,
          rtCreated: nowSeconds,
          eType: ACHIEVEMENT_TYPE,
          nToastDurationMS: 0,
          eSource: CLIENT_SOURCE,
          data,
          bNewIndicator: true,
        },
        NEW_NOTIFICATION,
      );
      return;
    } catch (error: unknown) {
      console.warn(
        '[AchievementCustomizer] native test toast failed, using Decky toast',
        error,
      );
    }
  }

  const toast: MarkedToastData = {
    title: achievement.name,
    body: achievement.description,
    logo: createElement('img', {
      src: achievement.image,
      style: {width: 40, height: 40, objectFit: 'cover'},
    }),
    sound: SOUND_ACHIEVEMENT,
    duration: getCurrentSettings().duration,
    achievementToast: achievement,
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

// Undefined until the first lookup; null when the module is unavailable.
let cachedWindowClasses: ToastWindowClasses | null | undefined;

function resolveToastWindowClasses(): ToastWindowClasses | null {
  if (cachedWindowClasses !== undefined) return cachedWindowClasses;
  cachedWindowClasses = null;
  try {
    const classModule =
      findClassModule(
        (candidate) =>
          candidate.GamepadToastPlaceholder && candidate.GamepadToastPopup,
      ) ?? {};
    const pick = (key: string): string =>
      CSS_CLASS_PATTERN.test(classModule[key] ?? '') ? classModule[key] : '';
    const resolved = {
      placeholder: pick('GamepadToastPlaceholder'),
      inGame: pick('InGame'),
      positionTop: pick('PositionTop'),
      positionLeft: pick('PositionLeft'),
    };
    if (
      resolved.placeholder &&
      resolved.inGame &&
      resolved.positionTop &&
      resolved.positionLeft
    ) {
      cachedWindowClasses = resolved;
    }
  } catch (error: unknown) {
    console.warn(
      '[AchievementCustomizer] toast placeholder classes unavailable:',
      error,
    );
  }
  return cachedWindowClasses;
}

/**
 * Returns the CSS that grows Steam's toast window to 320x128, or an empty
 * string when its classes cannot be resolved.
 *
 * Steam sizes the notification window from this placeholder (stock: 300x40
 * plus 20px padding on top/bottom/left, anchored 30px from the bottom; 50px
 * from the top; 10px closer to the edge in game). Growing the padding and
 * moving the anchors by the same amount keeps every stock toast at its exact
 * screen position while the window becomes 320x128 (320x152 in game, where the
 * card sits so close to the edge that ours has to be bottom-anchored instead).
 */
export function buildToastWindowCss(): string {
  const classes = resolveToastWindowClasses();
  if (!classes) return '';
  const placeholder = `.${classes.placeholder}`;
  const inGame = `.${classes.inGame}`;
  const top = `.${classes.positionTop}`;
  const left = `.${classes.positionLeft}`;
  return `
    ${placeholder} {
      height: 40px !important;
      padding: 44px 0 44px 20px !important;
      bottom: 6px !important;
    }
    ${placeholder}${left} { padding: 44px 20px 44px 0 !important; }
    ${placeholder}${inGame} {
      bottom: -46px !important;
      padding: 68px 0 44px 20px !important;
    }
    ${placeholder}${inGame}${left} { padding: 68px 20px 44px 0 !important; }
    ${placeholder}${top} { top: 26px !important; bottom: unset !important; }
    ${placeholder}${top}${inGame} { top: -26px !important; }
  `;
}

// The popup element carries the same position classes as the placeholder; the
// in-game flag only exists on the placeholder in the main window.
function readToastEdge(root: HTMLElement): ToastEdge {
  const classes = resolveToastWindowClasses();
  if (!classes) return {top: false, left: false, inGame: false};
  const popupClasses = root.parentElement?.classList;
  const placeholder = mainDocument()?.querySelector(`.${classes.placeholder}`);
  return {
    top: popupClasses?.contains(classes.positionTop) ?? false,
    left: popupClasses?.contains(classes.positionLeft) ?? false,
    inGame: placeholder?.classList.contains(classes.inGame) ?? false,
  };
}
