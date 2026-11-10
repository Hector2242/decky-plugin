/**
 * @fileoverview Achievement Creation: a full-screen page where the toast's
 * parts are placed on a snapping grid by touch (drag to move, pinch to resize)
 * or with sliders, plus its trophy labels, trophy image, sound and the user's
 * own presets.
 */

import {
  FileSelectionType,
  addEventListener,
  callable,
  openFilePicker,
  removeEventListener,
  toaster,
} from '@decky/api';
import {
  ConfirmModal,
  DialogButton,
  DropdownItem,
  Focusable,
  SliderField,
  TextField,
  ToggleField,
  showModal,
} from '@decky/ui';
import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {loadAsset} from './assets';
import {SAMPLE_IMAGE} from './panel';
import {
  type LayoutPart,
  type PartLayout,
  type ThemeSettings,
  type ToastLayout,
  type TrophyTier,
  type TrophyLabels,
  CARD_BORDER,
  CARD_WIDTH,
  DEFAULT_LAYOUT,
  HEIGHT_RANGE,
  LAYOUT_PARTS,
  MAX_LABEL,
  MAX_PRESET_NAME,
  MAX_USER_PRESETS,
  SETTINGS_CHANGED,
  SIZE_RANGE,
  TROPHY_TIERS,
  addUserPreset,
  assetLabel,
  changeSettings,
  deleteUserPreset,
  getCurrentSettings,
  maxPosition,
  partBox,
  presetName,
  presetOptions,
  renameUserPreset,
  sanitizeLayout,
  sanitizeSettings,
  setCurrentSettings,
} from './settings';
import {closeEditor, fireTestAchievement} from './steam';
import {type ToastAchievement, AchievementToast, UNLOCK_LABEL} from './toast';

const saveSettings = callable<[settings: ThemeSettings], boolean>(
  'save_settings',
);
const getHome = callable<[], string>('get_home');
const importAsset = callable<[kind: AssetKind, path: string], string>(
  'import_asset',
);

// Dragging snaps to this many card px; sliders move in 2px steps.
const GRID = 4;
// Saved after a pause, so a slider drag does not write every step.
const SAVE_DELAY_MS = 400;
const SELECTED = '#1a9fff';
const PAGE_BACKGROUND = '#171a21';

type Selection = LayoutPart | 'card';
type AssetKind = 'trophy' | 'sound';
type Tier = keyof TrophyLabels;

const SELECTIONS: Selection[] = [
  'card',
  'icon',
  'badge',
  'label',
  'title',
  'desc',
];
const SELECTION_NAMES: Record<Selection, string> = {
  card: 'Card',
  icon: 'Icon',
  badge: 'Badge',
  label: 'Label',
  title: 'Title',
  desc: 'Description',
};
const TIERS: Tier[] = ['none', 'bronze', 'silver', 'gold', 'platinum'];
const TIER_NAMES: Record<Tier, string> = {
  none: 'Unlocked (no tier)',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

interface AssetInfo {
  title: string;
  description: string;
  /** What the file picker lists, as extensions without the dot. */
  extensions: string[];
  restore: string;
}

const ASSETS: Record<AssetKind, AssetInfo> = {
  trophy: {
    title: 'Trophy image',
    description:
      "Replaces this tier's trophy, the one the icon turns into (Trophy Reveal must be on). PNG, JPG, WebP or GIF up to 1 MB.",
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    restore: 'Use default trophy',
  },
  sound: {
    title: 'Achievement sound',
    description:
      "Plays instead of Steam's achievement sound, for as long as the toast shows. MP3, OGG or WAV up to 2 MB.",
    extensions: ['mp3', 'ogg', 'wav'],
    restore: "Use Steam's sound",
  },
};

const SAMPLE: ToastAchievement = {
  appId: 0,
  id: 'creation_sample',
  name: 'Achievement title',
  description: 'Achievement description, which can take up two lines of text',
  image: SAMPLE_IMAGE,
  achieved: true,
  globalPercent: 62.5,
};

interface Point {
  x: number;
  y: number;
}

// One touch on the canvas: a finger moves the part, two resize it.
interface Gesture {
  part: Selection;
  /** The layout and pointer positions when the current finger count began. */
  start: ToastLayout;
  from: Map<number, Point>;
  at: Map<number, Point>;
}

function withPart(
  layout: ToastLayout,
  part: LayoutPart,
  change: Partial<PartLayout>,
): ToastLayout {
  const next = {...layout};
  next[part] = {...layout[part], ...change};
  return next;
}

// The icon and badge grow around their centre; text keeps its top left.
function withSize(
  layout: ToastLayout,
  part: LayoutPart,
  size: number,
): ToastLayout {
  const value = layout[part];
  if (part !== 'icon' && part !== 'badge')
    return withPart(layout, part, {size});
  const [min, max] = SIZE_RANGE[part];
  const clamped = Math.min(max, Math.max(min, size));
  const shift = (clamped - value.size) / 2;
  return withPart(layout, part, {
    size: clamped,
    x: value.x - shift,
    y: value.y - shift,
  });
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function spread(points: Point[]): number {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function mapTiers(text: (tier: Tier) => string): TrophyLabels {
  return {
    none: text('none'),
    bronze: text('bronze'),
    silver: text('silver'),
    gold: text('gold'),
    platinum: text('platinum'),
  };
}

// Lines every grid step and brighter ones every four, from the card's inside.
function gridStyle(scale: number): CSSProperties {
  const cell = GRID * scale;
  const line = (color: string, to: string) =>
    `linear-gradient(to ${to}, ${color} 1px, transparent 1px)`;
  const minor = 'rgb(255 255 255 / 0.1)';
  const major = 'rgb(255 255 255 / 0.22)';
  return {
    backgroundImage: [
      line(major, 'right'),
      line(major, 'bottom'),
      line(minor, 'right'),
      line(minor, 'bottom'),
    ].join(', '),
    backgroundSize: [cell * 4, cell * 4, cell, cell]
      .map((size) => `${size}px ${size}px`)
      .join(', '),
    backgroundPosition: `${CARD_BORDER * scale}px ${CARD_BORDER * scale}px`,
  };
}

interface ModalProps {
  /** Set by showModal. */
  closeModal?: () => void;
}

interface LabelsModalProps extends ModalProps {
  labels: TrophyLabels;
  onSave: (labels: TrophyLabels) => void;
}

function LabelsModal({labels, onSave, closeModal}: LabelsModalProps) {
  // The boxes start with the text shown now; built-in text is stored as ''.
  const [draft, setDraft] = useState(() =>
    mapTiers((tier) => labels[tier] || UNLOCK_LABEL[tier]),
  );
  return (
    <ConfirmModal
      strTitle="Trophy labels"
      strDescription="The line above the title. Clear a box to use the built-in text."
      strOKButtonText="Save"
      onOK={() => {
        onSave(
          mapTiers((tier) => {
            const text = draft[tier].trim();
            return text === UNLOCK_LABEL[tier] ? '' : text;
          }),
        );
      }}
      closeModal={closeModal}
    >
      {TIERS.map((tier) => (
        <TextField
          key={tier}
          label={TIER_NAMES[tier]}
          value={draft[tier]}
          onChange={(event) => {
            const next = {...draft};
            next[tier] = event.target.value.slice(0, MAX_LABEL);
            setDraft(next);
          }}
        />
      ))}
    </ConfirmModal>
  );
}

interface NameModalProps extends ModalProps {
  title: string;
  description: string;
  action: string;
  initial: string;
  onDone: (name: string) => void;
}

function NameModal({
  title,
  description,
  action,
  initial,
  onDone,
  closeModal,
}: NameModalProps) {
  const [name, setName] = useState(initial.slice(0, MAX_PRESET_NAME));
  return (
    <ConfirmModal
      strTitle={title}
      strDescription={description}
      strOKButtonText={action}
      onOK={() => {
        onDone(name);
      }}
      closeModal={closeModal}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value.slice(0, MAX_PRESET_NAME));
        }}
      />
    </ConfirmModal>
  );
}

interface CanvasProps {
  settings: ThemeSettings;
  scale: number;
  selected: Selection;
  onSelect: (part: Selection) => void;
  onCommit: (layout: ToastLayout) => void;
}

// The enlarged toast under its touch overlay. Positions while fingers are down
// live here, so a drag re-renders the canvas only, not the whole page.
function Canvas({settings, scale, selected, onSelect, onCommit}: CanvasProps) {
  // Positions while fingers are down; saved when the last one lifts.
  const [draft, setDraft] = useState<ToastLayout | null>(null);
  const draftRef = useRef<ToastLayout | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const layout = draft ?? settings.layout;

  const showDraft = (next: ToastLayout) => {
    const clean = sanitizeLayout(next);
    draftRef.current = clean;
    setDraft(clean);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // A primary pointer starts a new touch: drop a gesture whose end was lost.
    if (event.isPrimary) gesture.current = null;
    let current = gesture.current;
    if (!current) {
      const hit = (event.target as Element)
        .closest('[data-part]')
        ?.getAttribute('data-part');
      const part = (hit ?? 'card') as Selection;
      onSelect(part);
      current = {part, start: layout, from: new Map(), at: new Map()};
      gesture.current = current;
    }
    // A third finger is ignored.
    if (current.at.size >= 2) return;
    current.at.set(event.pointerId, {x: event.clientX, y: event.clientY});
    current.start = draftRef.current ?? layout;
    current.from = new Map(current.at);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current?.at.has(event.pointerId)) return;
    current.at.set(event.pointerId, {x: event.clientX, y: event.clientY});
    const now = [...current.at.values()];
    const then = [...current.from.values()];
    const {part, start} = current;
    if (now.length === 2) {
      const ratio = spread(now) / Math.max(1, spread(then));
      showDraft(
        part === 'card'
          ? {...start, height: start.height * ratio}
          : withSize(start, part, start[part].size * ratio),
      );
    } else if (part !== 'card') {
      const {x, y} = start[part];
      showDraft(
        withPart(start, part, {
          x: snap(x + (now[0].x - then[0].x) / scale),
          y: snap(y + (now[0].y - then[0].y) / scale),
        }),
      );
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current?.at.delete(event.pointerId)) return;
    if (current.at.size > 0) {
      // Down to one finger: it moves the part on from here.
      current.start = draftRef.current ?? current.start;
      current.from = new Map(current.at);
      return;
    }
    gesture.current = null;
    const done = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (done) onCommit(done);
  };

  // The canvas shows the parts at rest: no entrance, no reveal.
  const preview: ThemeSettings = {
    ...settings,
    layout: {...layout, custom: true},
    popupAnimation: false,
    trophyReveal: 'off',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: CARD_WIDTH * scale,
        margin: '0 auto',
      }}
    >
      <AchievementToast
        achievement={SAMPLE}
        settings={preview}
        mode="preview"
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CARD_WIDTH * scale,
          height: layout.height * scale,
          touchAction: 'none',
          outline: selected === 'card' ? `2px solid ${SELECTED}` : 'none',
          ...gridStyle(scale),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {LAYOUT_PARTS.filter((name) => layout[name].show).map((name) => {
          const box = partBox(layout, name);
          return (
            <div
              key={name}
              data-part={name}
              style={{
                position: 'absolute',
                left: (CARD_BORDER + box.left) * scale,
                top: (CARD_BORDER + box.top) * scale,
                width: box.width * scale,
                height: box.height * scale,
                boxSizing: 'border-box',
                border:
                  name === selected
                    ? `2px solid ${SELECTED}`
                    : '1px dashed rgb(255 255 255 / 0.4)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** The Achievement Creation page, opened from the Quick Access panel. */
export function Editor() {
  const [settings, setSettings] = useState(getCurrentSettings);
  const [selected, setSelected] = useState<Selection>('title');
  const [scale, setScale] = useState(2.5);
  const pageRef = useRef<HTMLDivElement>(null);
  const unsaved = useRef<ThemeSettings | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSaved = useRef('');

  // The card at up to 3x, in half steps, to fit the page.
  useLayoutEffect(() => {
    const width = pageRef.current?.clientWidth ?? 0;
    if (width <= 0) return;
    const fit = Math.floor(((width - 48) / CARD_WIDTH) * 2) / 2;
    setScale(Math.max(1.5, Math.min(3, fit)));
  }, []);

  const flush = (): Promise<unknown> => {
    window.clearTimeout(saveTimer.current);
    const next = unsaved.current;
    unsaved.current = null;
    if (!next) return Promise.resolve();
    lastSaved.current = JSON.stringify(next);
    return saveSettings(next).catch((error: unknown) => {
      console.error('[AchievementCustomizer] Failed to save settings', error);
    });
  };

  // Shows at once (the toast hooks read the current settings) and saves after
  // a pause.
  const commit = (next: ThemeSettings) => {
    setSettings(next);
    setCurrentSettings(next);
    unsaved.current = next;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void flush();
    }, SAVE_DELAY_MS);
  };

  // Merged into the latest settings in case Quick Access changed something
  // meanwhile. Built-in presets never change: see changeSettings.
  const apply = (partial: Partial<ThemeSettings>) => {
    commit(changeSettings(getCurrentSettings(), partial));
  };

  useEffect(() => {
    // Changes made in Quick Access while this page is open.
    const onChanged = (stored: Partial<ThemeSettings>) => {
      const fresh = sanitizeSettings(stored);
      if (JSON.stringify(fresh) !== lastSaved.current) setSettings(fresh);
    };
    addEventListener<[settings: Partial<ThemeSettings>]>(
      SETTINGS_CHANGED,
      onChanged,
    );
    return () => {
      removeEventListener(SETTINGS_CHANGED, onChanged);
      void flush();
    };
  }, []);

  const {layout} = settings;
  const setLayout = (next: ToastLayout) => {
    apply({layout: {...next, custom: true}});
  };

  // A trophy image for one tier, or the sound.
  const chooseAsset = (kind: AssetKind, tier: TrophyTier = 'bronze') => {
    const info = ASSETS[kind];
    const current =
      kind === 'trophy' ? settings.trophyImages[tier] : settings.customSound;
    const store = (name: string) => {
      apply(
        kind === 'trophy'
          ? {
              trophyImages: {
                ...getCurrentSettings().trophyImages,
                [tier]: name,
              },
            }
          : {customSound: name},
      );
    };
    const pick = async () => {
      try {
        const home = await getHome();
        const {path} = await openFilePicker(
          FileSelectionType.FILE,
          home,
          true,
          true,
          undefined,
          info.extensions,
        );
        const name = await importAsset(kind, path);
        if (!name) {
          toaster.toast({
            title: "That file can't be used",
            body: info.description,
          });
          return;
        }
        store(name);
        const url = await loadAsset(name);
        if (kind === 'sound' && url) await new Audio(url).play();
      } catch (error: unknown) {
        // Closing the file picker also lands here.
        console.warn('[AchievementCustomizer]', info.title, error);
      }
    };
    showModal(
      <ConfirmModal
        strTitle={kind === 'trophy' ? `${TIER_NAMES[tier]} trophy` : info.title}
        strDescription={info.description}
        strOKButtonText="Choose file…"
        strMiddleButtonText={current ? info.restore : undefined}
        onMiddleButton={() => {
          store('');
        }}
        onOK={() => {
          void pick();
        }}
      />,
    );
  };

  const part = selected === 'card' ? null : selected;
  const userPreset = settings.userPresets.find(
    (user) => user.id === settings.preset,
  );
  let presetNote =
    'Built in, so it never changes: edits turn into Custom until you save them as a new preset.';
  if (userPreset) presetNote = 'Yours: every change saves into it.';
  if (settings.preset === 'custom') {
    presetNote = 'Not saved: save it as a new preset to keep it.';
  }
  const max = part ? maxPosition(layout, part) : null;
  const button = (active: boolean): CSSProperties => ({
    width: 'auto',
    minWidth: 0,
    padding: '6px 14px',
    background: active ? SELECTED : undefined,
  });

  return (
    <div
      ref={pageRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        // Clear of Steam's top bar and button bar.
        padding: '44px 24px 40px',
        background: PAGE_BACKGROUND,
        color: '#fff',
      }}
    >
      {/* The canvas stays put; only the controls below it scroll. */}
      <div style={{flex: '0 0 auto', paddingBottom: 12}}>
        <div style={{fontSize: 20, fontWeight: 600}}>Achievement Creation</div>
        <div style={{fontSize: 12, opacity: 0.7, margin: '2px 0 10px'}}>
          Tap a part to select it, drag to move it along the grid, pinch to
          resize it. The sliders set exact values.
        </div>
        <Canvas
          settings={settings}
          scale={scale}
          selected={selected}
          onSelect={setSelected}
          onCommit={setLayout}
        />
      </div>

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          paddingBottom: 12,
        }}
      >
        <Focusable style={{flex: '1 1 auto', minWidth: 0}}>
          <Focusable
            flow-children="horizontal"
            style={{display: 'flex', flexWrap: 'wrap', gap: 6}}
          >
            {SELECTIONS.map((name) => (
              <DialogButton
                key={name}
                style={button(name === selected)}
                onClick={() => {
                  setSelected(name);
                }}
              >
                {SELECTION_NAMES[name]}
              </DialogButton>
            ))}
          </Focusable>
          {part && max ? (
            <>
              <SliderField
                label={
                  part === 'icon' || part === 'badge' ? 'Size' : 'Text size'
                }
                value={layout[part].size}
                min={SIZE_RANGE[part][0]}
                max={SIZE_RANGE[part][1]}
                step={part === 'icon' || part === 'badge' ? 2 : 1}
                showValue
                editableValue
                valueSuffix="px"
                onChange={(size) => {
                  setLayout(withSize(layout, part, size));
                }}
              />
              <SliderField
                label="Left"
                value={layout[part].x}
                min={0}
                max={max.x}
                step={2}
                showValue
                editableValue
                valueSuffix="px"
                onChange={(x) => {
                  setLayout(withPart(layout, part, {x}));
                }}
              />
              <SliderField
                label="Top"
                value={layout[part].y}
                min={0}
                max={max.y}
                step={2}
                showValue
                editableValue
                valueSuffix="px"
                onChange={(y) => {
                  setLayout(withPart(layout, part, {y}));
                }}
              />
              {part === 'badge' || part === 'label' || part === 'desc' ? (
                <ToggleField
                  label="Show"
                  checked={layout[part].show}
                  onChange={(show) => {
                    setLayout(withPart(layout, part, {show}));
                  }}
                />
              ) : null}
            </>
          ) : (
            <SliderField
              label="Height"
              value={layout.height}
              min={HEIGHT_RANGE[0]}
              max={HEIGHT_RANGE[1]}
              step={2}
              showValue
              editableValue
              valueSuffix="px"
              onChange={(height) => {
                setLayout({...layout, height});
              }}
            />
          )}
        </Focusable>

        <Focusable
          style={{
            flex: '0 0 260px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <DropdownItem
            layout="below"
            label="Preset"
            description={presetNote}
            rgOptions={presetOptions(settings)}
            selectedOption={settings.preset}
            onChange={(option) => {
              apply({preset: option.data});
            }}
          />
          <DialogButton
            disabled={settings.userPresets.length >= MAX_USER_PRESETS}
            onClick={() => {
              showModal(
                <NameModal
                  title="Save as new preset"
                  description="Saves this look with its layout, labels, trophy and sound as a preset of your own. Built-in presets never change."
                  action="Save"
                  initial={
                    settings.preset === 'custom'
                      ? 'My preset'
                      : `${presetName(settings)} copy`
                  }
                  onDone={(name) => {
                    commit(addUserPreset(getCurrentSettings(), name));
                  }}
                />,
              );
            }}
          >
            Save as new preset…
          </DialogButton>
          {userPreset ? (
            <>
              <DialogButton
                onClick={() => {
                  showModal(
                    <NameModal
                      title="Rename preset"
                      description="A new name for your preset."
                      action="Rename"
                      initial={userPreset.name}
                      onDone={(name) => {
                        commit(
                          renameUserPreset(
                            getCurrentSettings(),
                            userPreset.id,
                            name,
                          ),
                        );
                      }}
                    />,
                  );
                }}
              >
                Rename preset…
              </DialogButton>
              <DialogButton
                onClick={() => {
                  showModal(
                    <ConfirmModal
                      strTitle={`Delete “${userPreset.name}”?`}
                      strDescription="The toast keeps this look as Custom until you pick another preset."
                      strOKButtonText="Delete"
                      onOK={() => {
                        commit(
                          deleteUserPreset(getCurrentSettings(), userPreset.id),
                        );
                      }}
                    />,
                  );
                }}
              >
                Delete preset
              </DialogButton>
            </>
          ) : null}
          <DialogButton
            onClick={() => {
              showModal(
                <LabelsModal
                  labels={settings.labels}
                  onSave={(labels) => {
                    apply({labels});
                  }}
                />,
              );
            }}
          >
            Trophy labels…
          </DialogButton>
          {TROPHY_TIERS.map((tier) => (
            <DialogButton
              key={tier}
              onClick={() => {
                chooseAsset('trophy', tier);
              }}
            >
              {`${TIER_NAMES[tier]} trophy: ${assetLabel(settings.trophyImages[tier]) || 'default'}`}
            </DialogButton>
          ))}
          <DialogButton
            onClick={() => {
              chooseAsset('sound');
            }}
          >
            {`Sound: ${assetLabel(settings.customSound) || "Steam's"}`}
          </DialogButton>
          <DialogButton
            onClick={() => {
              void flush();
              fireTestAchievement(SAMPLE);
            }}
          >
            Test toast
          </DialogButton>
          <DialogButton
            onClick={() => {
              apply({layout: DEFAULT_LAYOUT});
            }}
          >
            Reset layout
          </DialogButton>
          <DialogButton onClick={closeEditor}>Done</DialogButton>
        </Focusable>
      </div>
    </div>
  );
}
