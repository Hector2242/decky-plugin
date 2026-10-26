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
import {type ToastPosition, getCurrentSettings} from './settings';
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
  decky?: boolean;
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
  // Steam's float fields can carry NaN or Infinity.
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
  const globalPercent = numberField(message, 'global_achieved_pct');
  return {
    appId: numberField(message, 'appid'),
    id: stringField(message, 'achievement_id'),
    name,
    description: stringField(message, 'description'),
    image: stringField(message, 'image_url'),
    achieved: booleanField(message, 'achieved'),
    // Above 100% is bad data: treat it as unknown.
    globalPercent: globalPercent <= 100 ? globalPercent : 0,
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
  // Steam wraps popups in its own group, so Decky's flag sits on the
  // notification there.
  if (group.decky || first.decky) {
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
    ensureMainWindowCss(getCurrentSettings());
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
  positionLeft: string;
}

// Cached once found; a failed lookup is retried on the next call.
let cachedWindowClasses: ToastWindowClasses | undefined;

function resolveToastWindowClasses(): ToastWindowClasses | null {
  if (cachedWindowClasses) return cachedWindowClasses;
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
      positionLeft: pick('PositionLeft'),
    };
    if (resolved.placeholder && resolved.inGame && resolved.positionLeft) {
      cachedWindowClasses = resolved;
    }
  } catch (error: unknown) {
    console.warn(
      '[AchievementCustomizer] toast placeholder classes unavailable:',
      error,
    );
  }
  return cachedWindowClasses ?? null;
}

/**
 * Returns the CSS that grows Steam's toast window to 320x128 and moves it to
 * the chosen position, or an empty string when its classes cannot be resolved.
 *
 * Steam sizes and places the notification window from this placeholder
 * (stock: 300x40 plus 20px padding on top/bottom/left, 30px from the bottom or
 * 50px from the top; 10px closer to the edge in game). Growing the padding and
 * moving the anchors by the same amount keeps a stock toast at Steam's own spot
 * while the window becomes 320x128 (320x152 in game, where the card sits so
 * close to the edge that ours has to be anchored to it instead). One window
 * serves every toast, so they all move; `!important` also beats the position a
 * game sets through Steamworks.
 */
export function buildToastWindowCss(position: ToastPosition): string {
  const classes = resolveToastWindowClasses();
  if (!classes) return '';
  const placeholder = `.${classes.placeholder}`;
  const top = position.startsWith('top');
  let horizontal = 'left: unset !important; right: 0 !important;';
  if (position.endsWith('left')) {
    horizontal = 'left: 0 !important; right: unset !important;';
  } else if (position.endsWith('center')) {
    horizontal = 'left: calc(50% - 160px) !important; right: unset !important;';
  }
  return `
    ${placeholder} {
      height: 40px !important;
      padding: 44px 0 44px 20px !important;
      ${top ? 'top: 26px !important; bottom: unset !important;' : 'top: unset !important; bottom: 6px !important;'}
      ${horizontal}
    }
    ${placeholder}.${classes.inGame} {
      padding-top: 68px !important;
      ${top ? 'top: -26px !important;' : 'bottom: -46px !important;'}
    }
  `;
}

// The popup carries Steam's own left-side class; the in-game flag only exists
// on the placeholder in the main window.
function readToastEdge(root: HTMLElement): ToastEdge | null {
  const classes = resolveToastWindowClasses();
  if (!classes) return null;
  const placeholder = mainDocument()?.querySelector(`.${classes.placeholder}`);
  return {
    inGame: placeholder?.classList.contains(classes.inGame) ?? false,
    mirrored:
      root.parentElement?.classList.contains(classes.positionLeft) ?? false,
  };
}
