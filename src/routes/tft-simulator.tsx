import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HIRES } from "@/lib/tft-hires";

export const Route = createFileRoute("/tft-simulator")({
  head: () => ({
    meta: [
      { title: "TFT Simulator — Mind Buddy Device UI" },
      { name: "description", content: "Interactive 280x320 TFT simulator for the MindBuddy device: home conditions, modes, mood, exercises, settings and calls." },
      { property: "og:title", content: "TFT Simulator — Mind Buddy Device UI" },
      { property: "og:description", content: "Preview every MindBuddy TFT screen, condition and touch region in-browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TftSimulator,
});

/* ------------------------------------------------------------------ */
/* Design grid: artwork is 1120x1280, i.e. exactly 4x the 280x320 grid  */
/* the firmware renders (Lanczos downscale on the Pi / ESP32 build).    */
/* ------------------------------------------------------------------ */
const SCREEN_W = 280;
const SCREEN_H = 320;
const SCALE = 2;

const img = (k: string) => HIRES[k] ?? "";

type Page =
  | "splash" | "home" | "chat" | "music" | "keypad" | "calling" | "incoming"
  | "connected" | "mode" | "mood" | "exercise" | "settings" | "pipeline"
  | "dnd" | "voice" | "wifi" | "deviceconfig";

type Region = { id: string; x: number; y: number; w: number; h: number; label: string; action: () => void };

const MODES = ["ANXIETY", "DEPRESSION", "ADHD", "PTSD", "BIPOLAR", "SCHIZOPHRENIA"] as const;
const MODE_ASSET: Record<string, string> = {
  ANXIETY: "mode_selection_anxiety.png",
  DEPRESSION: "mode_selection_depression.png",
  ADHD: "mode_selection_adhd.png",
  PTSD: "mode_selection_ptsd.png",
  BIPOLAR: "mode_selection_bipolar.png",
  SCHIZOPHRENIA: "mode_selection_schizo.png",
};
const MOOD_ASSET: Record<string, string> = {
  GREAT: "mood_great.png", GOOD: "mood_good.png", OKAY: "mood_okay.png",
  LOW: "mood_low.png", SAD: "mood_sad.png", ANGRY: "mood_angry.png",
};
const EXERCISE_ASSET: Record<string, string> = {
  BREATHING: "exercise_breathing_exercises.png",
  MINDFULNESS: "exercise_mindfulness_meditation.png",
  STRESS: "exercise_stress_anxiety_relief.png",
  POSITIVE: "exercise_positive_thinking_emotional_wellness.png",
  SLEEP: "exercise_sleep_recovery.png",
  RANDOM: "exercise_random_exercise.png",
};
const VOICE_ASSET: Record<string, string> = {
  Default: "settings_page_voice_setting_default_voice.png",
  Nicole: "settings_page_voice_setting_nicole_voice.png",
  Sarah: "settings_page_voice_setting_sarah_voice.png",
  Sky: "settings_page_voice_setting_sky_voice.png",
  Bella: "settings_page_voice_setting_bella_voice.png",
  Adam: "settings_page_voice_setting_adam_voice.png",
  Michael: "settings_page_voice_setting_michael_voice.png",
  Emma: "settings_page_voice_setting_emma_voice.png",
};
const PIPELINE_ASSET: Record<string, string> = {
  local: "settings_page_local_pipeline.png",
  cloud: "settings_page_cloud_pipeline.png",
  auto: "settings_page_hybrid_pipeline.png",
};

/** 58 shipped home conditions → wifi × mobile × pipeline × battery bars. */
function batBucket(pct: number): string {
  if (pct <= 10) return "batempty";
  if (pct <= 30) return "bat1";
  if (pct <= 55) return "bat2";
  if (pct <= 80) return "bat3";
  return "bat4";
}
function homeAsset(wifi: boolean, mobile: boolean, pipeline: string, battery: number) {
  const w = wifi ? "wifi" : "nowifi";
  const m = mobile ? "mobile" : "nomobile";
  const order = ["batempty", "bat1", "bat2", "bat3", "bat4"];
  const want = batBucket(battery);
  const tries = [want, ...order.filter((b) => b !== want)];
  for (const b of tries) {
    const k = `home_page_${w}_${m}_${pipeline}_${b}.png`;
    if (HIRES[k]) return { key: k, exact: b === want };
  }
  // last resort — auto variant of the same radio state
  for (const b of tries) {
    const k = `home_page_${w}_${m}_auto_${b}.png`;
    if (HIRES[k]) return { key: k, exact: false };
  }
  return { key: "home_page_wifi_mobile_auto_bat4.png", exact: false };
}

type Med = { time: string; label: string };
type Contact = { name: string; number: string };
type ModalKind =
  | null
  | { kind: "slider"; title: string; value: number; onSet: (v: number) => void }
  | { kind: "meds"; meds: Med[]; onSave: (m: Med[]) => void }
  | { kind: "save"; number: string; onSave: (name: string) => void }
  | { kind: "info"; title: string; body: string };

const STORE_KEY = "mb.tft.sim.v2";
type Persisted = {
  mode: string; mood: string; exercise: string; voice: string;
  pipeline: string; dnd: boolean; volume: number; contacts: Contact[]; meds: Med[];
};
const DEFAULTS: Persisted = {
  mode: "ANXIETY", mood: "GOOD", exercise: "RANDOM", voice: "Default",
  pipeline: "auto", dnd: false, volume: 70,
  contacts: [{ name: "Caregiver", number: "+2348012345678" }],
  meds: [{ time: "08:00", label: "Morning dose" }],
};

function TftSimulator() {
  const [page, setPage] = useState<Page>("splash");
  const [history, setHistory] = useState<Page[]>([]);
  const [log, setLog] = useState<{ t: number; msg: string }[]>([]);
  const [showRegions, setShowRegions] = useState(true);
  const [dialed, setDialed] = useState("");
  const [playing, setPlaying] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  // Persisted user selections (device NVS equivalent).
  const [st, setSt] = useState<Persisted>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setSt({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch { /* ignore */ }
  }, [st, loaded]);
  const patch = useCallback((p: Partial<Persisted>) => setSt((s) => ({ ...s, ...p })), []);

  // Live radio / power state
  const [wifi, setWifi] = useState(true);
  const [mobile, setMobile] = useState(true);
  const [battery, setBattery] = useState(82);
  const [charging, setCharging] = useState(false);

  const pushLog = useCallback(
    (msg: string) => setLog((l) => [{ t: Date.now(), msg }, ...l].slice(0, 100)),
    []
  );
  const goto = (p: Page, msg?: string) => {
    setHistory((h) => [...h, page]);
    setPage(p);
    if (msg) pushLog(msg);
  };
  const back = () => setHistory((h) => {
    if (h.length === 0) { setPage("home"); return h; }
    setPage(h[h.length - 1]);
    return h.slice(0, -1);
  });
  const home = (msg?: string) => { setHistory([]); setPage("home"); if (msg) pushLog(msg); };

  // Splash video → home
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (page !== "splash") return;
    pushLog("Boot: splash playing…");
    const t = setTimeout(() => setPage((p) => (p === "splash" ? "home" : p)), 6000);
    return () => clearTimeout(t);
  }, [page, pushLog]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  const timeStr = useMemo(() => {
    let h = now.getHours();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(now.getMinutes()).padStart(2, "0")}${ap}`;
  }, [now]);

  const nextMed = useMemo(() => {
    if (st.meds.length === 0) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const parsed = st.meds
      .map((m) => { const [h, mm] = m.time.split(":").map(Number); return { ...m, mins: (h || 0) * 60 + (mm || 0) }; })
      .sort((a, b) => a.mins - b.mins);
    return parsed.find((p) => p.mins >= nowMin) || parsed[0];
  }, [st.meds, now]);

  const homePick = homeAsset(wifi, mobile, st.pipeline, battery);

  /* ---------------------------- touch regions ---------------------------- */
  const regions: Region[] = useMemo(() => {
    const backAnchor = (x: number, y: number, w: number, h: number, to?: Page): Region => ({
      id: "back", x, y, w, h, label: "← Back",
      action: () => { if (to) { setPage(to); pushLog(`← ${to}`); } else back(); },
    });

    switch (page) {
      case "splash":
        return [{ id: "skip", x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, label: "skip", action: () => { setPage("home"); pushLog("Splash skipped → Home"); } }];

      case "home":
        return [
          { id: "chat", x: 22, y: 64, w: 76, h: 76, label: "MB Chat", action: () => goto("chat", "Home → MB Response") },
          { id: "med", x: 104, y: 64, w: 76, h: 76, label: "Meds", action: () => setModal({ kind: "meds", meds: st.meds, onSave: (m) => { patch({ meds: m }); pushLog(`Meds updated (${m.length})`); } }) },
          { id: "music", x: 181, y: 63, w: 77, h: 77, label: "Music", action: () => goto("music", "Home → Music") },
          { id: "mood", x: 23, y: 146, w: 75, h: 75, label: "Mood", action: () => goto("mood", "Home → Mood") },
          { id: "settings", x: 104, y: 146, w: 76, h: 76, label: "Settings", action: () => goto("settings", "Home → Settings") },
          { id: "exercise", x: 181, y: 146, w: 77, h: 77, label: "Exercise", action: () => goto("exercise", "Home → Exercise") },
          { id: "phone", x: 99, y: 233, w: 82, h: 82, label: "Keypad", action: () => goto("keypad", "Home → Keypad") },
          { id: "mode", x: 4, y: 34, w: 96, h: 26, label: "Mode", action: () => goto("mode", "Home → Mode selection") },
        ];

      case "mode":
        return [
          backAnchor(12, 105, 80, 80, "home"),
          { id: "bipolar", x: 112, y: 35, w: 71, h: 71, label: "BIPOLAR", action: () => { patch({ mode: "BIPOLAR" }); pushLog("Mode → BIPOLAR"); } },
          { id: "schizo", x: 193, y: 42, w: 71, h: 73, label: "SCHIZO", action: () => { patch({ mode: "SCHIZOPHRENIA" }); pushLog("Mode → SCHIZOPHRENIA"); } },
          { id: "ptsd", x: 112, y: 120, w: 71, h: 71, label: "PTSD", action: () => { patch({ mode: "PTSD" }); pushLog("Mode → PTSD"); } },
          { id: "adhd", x: 193, y: 129, w: 71, h: 71, label: "ADHD", action: () => { patch({ mode: "ADHD" }); pushLog("Mode → ADHD"); } },
          { id: "depression", x: 112, y: 205, w: 71, h: 71, label: "DEPRESSION", action: () => { patch({ mode: "DEPRESSION" }); pushLog("Mode → DEPRESSION"); } },
          { id: "anxiety", x: 193, y: 212, w: 71, h: 73, label: "ANXIETY", action: () => { patch({ mode: "ANXIETY" }); pushLog("Mode → ANXIETY"); } },
        ];

      case "mood":
        return [
          backAnchor(12, 105, 80, 80, "home"),
          { id: "great", x: 112, y: 35, w: 71, h: 71, label: "GREAT", action: () => { patch({ mood: "GREAT" }); pushLog("Mood → GREAT"); } },
          { id: "good", x: 193, y: 43, w: 71, h: 72, label: "GOOD", action: () => { patch({ mood: "GOOD" }); pushLog("Mood → GOOD"); } },
          { id: "okay", x: 112, y: 120, w: 71, h: 71, label: "OKAY", action: () => { patch({ mood: "OKAY" }); pushLog("Mood → OKAY"); } },
          { id: "low", x: 193, y: 129, w: 71, h: 71, label: "LOW", action: () => { patch({ mood: "LOW" }); pushLog("Mood → LOW"); } },
          { id: "sad", x: 112, y: 205, w: 71, h: 71, label: "SAD", action: () => { patch({ mood: "SAD" }); pushLog("Mood → SAD"); } },
          { id: "angry", x: 193, y: 214, w: 71, h: 71, label: "ANGRY", action: () => { patch({ mood: "ANGRY" }); pushLog("Mood → ANGRY"); } },
        ];

      case "exercise": {
        const pick = (k: string) => { patch({ exercise: k }); pushLog(`Exercise → ${k}`); };
        return [
          backAnchor(18, 110, 68, 68, "home"),
          { id: "breathing", x: 104, y: 26, w: 172, h: 34, label: "Breathing", action: () => pick("BREATHING") },
          { id: "mindfulness", x: 98, y: 70, w: 178, h: 34, label: "Mindfulness", action: () => pick("MINDFULNESS") },
          { id: "stress", x: 104, y: 114, w: 172, h: 34, label: "Stress relief", action: () => pick("STRESS") },
          { id: "positive", x: 100, y: 162, w: 176, h: 48, label: "Positive thinking", action: () => pick("POSITIVE") },
          { id: "sleep", x: 98, y: 226, w: 178, h: 34, label: "Sleep & recovery", action: () => pick("SLEEP") },
          { id: "random", x: 104, y: 266, w: 168, h: 28, label: "Random", action: () => pick("RANDOM") },
        ];
      }

      case "settings":
        return [
          backAnchor(16, 108, 84, 84, "home"),
          { id: "pipeline", x: 112, y: 35, w: 71, h: 71, label: "Pipeline", action: () => goto("pipeline", "Settings → Pipeline") },
          { id: "voice", x: 193, y: 44, w: 71, h: 71, label: "Voice", action: () => goto("voice", "Settings → Voice") },
          { id: "volume", x: 112, y: 120, w: 71, h: 71, label: "Volume", action: () => setModal({ kind: "slider", title: "Volume", value: st.volume, onSet: (v) => { patch({ volume: v }); pushLog(`Volume → ${v}%`); } }) },
          { id: "config", x: 193, y: 129, w: 71, h: 71, label: "Device config", action: () => goto("deviceconfig", "Settings → Device config") },
          { id: "wifi", x: 112, y: 205, w: 71, h: 71, label: "Wi-Fi", action: () => goto("wifi", "Settings → Wi-Fi") },
          { id: "dnd", x: 193, y: 214, w: 71, h: 71, label: "DND", action: () => goto("dnd", "Settings → DND") },
        ];

      case "pipeline":
        return [
          backAnchor(20, 70, 84, 84, "settings"),
          { id: "local", x: 153, y: 39, w: 71, h: 71, label: "Local", action: () => { patch({ pipeline: "local" }); pushLog("Pipeline → LOCAL"); } },
          { id: "cloud", x: 153, y: 124, w: 71, h: 72, label: "Cloud", action: () => { patch({ pipeline: "cloud" }); pushLog("Pipeline → CLOUD"); } },
          { id: "hybrid", x: 153, y: 210, w: 71, h: 71, label: "Hybrid / Auto", action: () => { patch({ pipeline: "auto" }); pushLog("Pipeline → AUTO (hybrid)"); } },
        ];

      case "dnd":
        return [
          backAnchor(18, 110, 78, 78, "settings"),
          { id: "activate", x: 126, y: 86, w: 78, h: 72, label: "Activate", action: () => { patch({ dnd: true }); pushLog("DND activated — calls disallowed"); } },
          { id: "deactivate", x: 126, y: 165, w: 72, h: 70, label: "deActivate", action: () => { patch({ dnd: false }); pushLog("DND deactivated"); } },
        ];

      case "voice": {
        const cells: [string, number, number][] = [
          ["Default", 118, 12], ["Nicole", 118, 87], ["Sarah", 118, 162], ["Sky", 118, 237],
          ["Bella", 198, 28], ["Adam", 198, 103], ["Michael", 198, 178], ["Emma", 198, 253],
        ];
        return [
          backAnchor(18, 110, 78, 78, "settings"),
          ...cells.map(([name, x, y]) => ({
            id: `v_${name}`, x, y, w: 64, h: 64, label: name,
            action: () => { patch({ voice: name }); pushLog(`Voice → ${name}`); },
          })),
        ];
      }

      case "wifi":
        return [backAnchor(16, 108, 84, 84, "settings")];
      case "deviceconfig":
        return [backAnchor(16, 108, 84, 84, "settings")];

      case "chat":
        return [backAnchor(8, 6, 66, 46)];

      case "music":
        return [
          backAnchor(8, 6, 66, 46),
          { id: "playpause", x: 40, y: 90, w: 200, h: 150, label: playing ? "Pause" : "Play", action: () => setPlaying((p) => { pushLog(p ? "⏸ pause" : "▶ play"); return !p; }) },
        ];

      case "keypad": {
        const cols = [29, 85, 141];
        const rows = [74, 126, 177, 228];
        const digits = [["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]];
        const keys: Region[] = [];
        digits.forEach((row, r) => row.forEach((k, c) => keys.push({
          id: `k${k}`, x: cols[c], y: rows[r], w: 54, h: 50, label: k,
          action: () => { setDialed((d) => (d + k).slice(0, 15)); pushLog(`keypad: ${k}`); },
        })));
        return [
          ...keys,
          { id: "clear", x: cols[0], y: rows[3], w: 54, h: 50, label: "✕", action: () => { setDialed(""); pushLog("keypad: clear"); } },
          { id: "k0", x: cols[1], y: rows[3], w: 54, h: 50, label: "0", action: () => { setDialed((d) => (d + "0").slice(0, 15)); pushLog("keypad: 0"); } },
          { id: "bksp", x: cols[2], y: rows[3], w: 54, h: 50, label: "⌫", action: () => { setDialed((d) => d.slice(0, -1)); pushLog("keypad: backspace"); } },
          { id: "back", x: 204, y: 94, w: 62, h: 44, label: "←", action: () => { setPage("home"); pushLog("Keypad → Home"); } },
          {
            id: "call", x: 207, y: 154, w: 58, h: 58, label: "Call",
            action: () => {
              if (st.dnd) { pushLog("Call blocked — DND active"); setModal({ kind: "info", title: "Do Not Disturb", body: "Calls are disallowed while DND is active.\nDisable it in Settings → DND." }); return; }
              if (!dialed) { pushLog("Call ignored — no number"); return; }
              goto("calling", `Dialing ${dialed}…`);
            },
          },
          {
            id: "save", x: 200, y: 226, w: 66, h: 44, label: "SAVE",
            action: () => {
              const num = dialed.trim();
              if (!num) { pushLog("SAVE ignored — no number"); return; }
              setModal({
                kind: "save", number: num,
                onSave: (name) => {
                  setSt((s) => s.contacts.length >= 10 || s.contacts.some((c) => c.number === num)
                    ? s
                    : { ...s, contacts: [...s.contacts, { name: name || `Contact ${s.contacts.length + 1}`, number: num }] });
                  pushLog(`Contact saved: ${name || "unnamed"} ${num}`);
                  setDialed("");
                },
              });
            },
          },
        ];
      }

      case "calling":
        return [{ id: "hangup", x: 106, y: 222, w: 68, h: 68, label: "Hang up", action: () => { home("☎ call ended"); setDialed(""); } }];
      case "incoming":
        return [{ id: "answer", x: 106, y: 222, w: 68, h: 68, label: "Answer", action: () => { setPage("connected"); pushLog("☎ call answered"); } }];
      case "connected":
        return [{ id: "end", x: 106, y: 222, w: 68, h: 68, label: "End call", action: () => { home("☎ call ended"); setDialed(""); } }];

      default:
        return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dialed, playing, st, pushLog, patch]);

  /* ------------------------------ artwork ------------------------------- */
  const still: Record<Page, string> = {
    splash: "",
    home: homePick.key,
    chat: "other_pages_ai_response_animation.png",
    music: "",
    keypad: "other_pages_keypad.png",
    calling: "other_pages_calling.png",
    incoming: "other_pages_call_receive_page.png",
    connected: "other_pages_call_connected_end_call_page.png",
    mode: MODE_ASSET[st.mode] ?? "mode_selection_mode.png",
    mood: MOOD_ASSET[st.mood] ?? "mood_mood.png",
    exercise: EXERCISE_ASSET[st.exercise] ?? "exercise_random_exercise.png",
    settings: "settings_page_settings.png",
    pipeline: PIPELINE_ASSET[st.pipeline] ?? "settings_page_hybrid_pipeline.png",
    dnd: st.dnd ? "settings_page_dnd_activated.png" : "settings_page_dnd_deactivated.png",
    voice: VOICE_ASSET[st.voice] ?? "settings_page_voice_setting_default_voice.png",
    wifi: "settings_page_wifi_page.png",
    deviceconfig: "settings_page_device_config.png",
  };

  const PAGES: Page[] = ["splash", "home", "chat", "music", "keypad", "calling", "incoming", "connected", "mode", "mood", "exercise", "settings", "pipeline", "dnd", "voice", "wifi", "deviceconfig"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">← Mind Buddy</Link>
            <h1 className="truncate text-lg font-semibold">TFT Simulator</h1>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">280×320</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
              touch regions
            </label>
            <button onClick={() => { setPage("splash"); setHistory([]); setDialed(""); pushLog("↻ Restart"); }}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              ↻ Restart
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative rounded-[28px] bg-neutral-900 p-3 shadow-2xl ring-1 ring-black/60"
            style={{ width: SCREEN_W * SCALE + 24, height: SCREEN_H * SCALE + 24 }}>
            <div className="relative overflow-hidden rounded-[16px] bg-black"
              style={{ width: SCREEN_W * SCALE, height: SCREEN_H * SCALE }}>

              {page === "splash" && (
                <video ref={videoRef} key="splash" src={img("home_page_splash.mp4")}
                  autoPlay muted playsInline onEnded={() => setPage("home")}
                  className="absolute inset-0 h-full w-full object-cover" />
              )}

              {page === "music" && (
                <video key={playing ? "mplay" : "mpause"}
                  src={img(playing ? "other_pages_music_is_playing.mp4" : "other_pages_music_is_paused.mp4")}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 h-full w-full object-cover" />
              )}

              {page === "chat" && (
                <video key="ai" src={img("other_pages_ai_response_animation.mp4")}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 h-full w-full object-cover" />
              )}

              {still[page] && page !== "music" && page !== "chat" && (
                <img key={still[page]} src={img(still[page])} alt={`${page} screen`}
                  className="absolute inset-0 h-full w-full select-none" draggable={false} />
              )}

              {/* Runtime text drawn over the Home artwork (see Home page model). */}
              {page === "home" && (
                <>
                  {charging && (
                    <span className="pointer-events-none absolute font-bold text-emerald-400"
                      style={{ left: 148 * SCALE, top: 8 * SCALE, fontSize: 9 * SCALE }}>
                      charging
                    </span>
                  )}
                  <span className="pointer-events-none absolute font-bold text-white"
                    style={{ left: 186 * SCALE, top: 38 * SCALE, fontSize: 11 * SCALE }}>
                    {timeStr}
                  </span>
                  {nextMed && (
                    <span className="pointer-events-none absolute rounded bg-black/50 px-1 font-mono text-white/90"
                      style={{ left: 108 * SCALE, top: 6 * SCALE, fontSize: 8 * SCALE }}>
                      💊 {nextMed.time}
                    </span>
                  )}
                </>
              )}

              {page === "keypad" && (
                <div className="absolute flex items-center justify-center font-mono text-black"
                  style={{ left: 42 * SCALE, top: 24 * SCALE, width: 136 * SCALE, height: 35 * SCALE, fontSize: 15 * SCALE }}>
                  {dialed || "\u00A0"}
                </div>
              )}

              {(page === "calling" || page === "incoming" || page === "connected") && (
                <div className="absolute text-center font-mono text-white"
                  style={{ left: 0, right: 0, top: 118 * SCALE, fontSize: 12 * SCALE }}>
                  {dialed || st.contacts[0]?.number || "Unknown"}
                </div>
              )}

              {regions.map((r) => (
                <button key={r.id} onClick={r.action} title={r.label}
                  className={"absolute transition " + (showRegions
                    ? "border-2 border-emerald-400/70 bg-emerald-400/10 hover:bg-emerald-400/25"
                    : "bg-transparent hover:bg-white/5")}
                  style={{ left: r.x * SCALE, top: r.y * SCALE, width: r.w * SCALE, height: r.h * SCALE }}>
                  {showRegions && (
                    <span className="pointer-events-none absolute left-1 top-0 text-[10px] font-semibold text-emerald-200 drop-shadow">
                      {r.label}
                    </span>
                  )}
                </button>
              ))}

              {modal && <ModalOverlay modal={modal} onClose={() => setModal(null)} />}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            page <b>{page}</b> · asset <code className="text-[10px]">{page === "splash" ? "home_page_splash.mp4" : still[page] || "(video)"}</code>
            {page === "home" && !homePick.exact && <span className="text-amber-500"> · nearest condition</span>}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">Persisted selections</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>Mode: <b>{st.mode}</b></div>
              <div>Mood: <b>{st.mood}</b></div>
              <div>Exercise: <b>{st.exercise}</b></div>
              <div>Voice: <b>{st.voice}</b></div>
              <div>Pipeline: <b>{st.pipeline.toUpperCase()}</b></div>
              <div>DND: <b>{st.dnd ? "ON (calls blocked)" : "off"}</b></div>
              <div>Volume: <b>{st.volume}%</b></div>
              <div>Next med: <b>{nextMed ? nextMed.time : "—"}</b></div>
              <div className="col-span-2">Contacts: <span>{st.contacts.map((c) => `${c.name} ${c.number}`).join(" · ") || "—"}</span></div>
            </div>
            <button onClick={() => { setSt(DEFAULTS); pushLog("Selections reset to defaults"); }}
              className="mt-3 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              reset selections
            </button>
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">Live conditions (drives the Home screen)</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={wifi} onChange={(e) => setWifi(e.target.checked)} /> Wi-Fi</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /> Mobile data</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={charging} onChange={(e) => setCharging(e.target.checked)} /> charging</label>
              <label className="flex items-center gap-2">
                Battery
                <input type="range" min={0} max={100} value={battery} onChange={(e) => setBattery(Number(e.target.value))} className="w-32" />
                <b>{battery}%</b> <span className="text-muted-foreground">({batBucket(battery)})</span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Resolves to one of the 58 shipped home conditions: wifi/noWiFi × mobile/noMobile × auto/local/cloud × 5 battery buckets.
            </p>
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">Jump to page</h2>
            <div className="flex flex-wrap gap-2">
              {PAGES.map((p) => (
                <button key={p} onClick={() => { setPage(p); pushLog(`Jump → ${p}`); }}
                  className={"rounded-md border px-2.5 py-1 text-xs " + (page === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")}>
                  {p}
                </button>
              ))}
              <button onClick={back} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">← back</button>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Event log</h2>
              <button onClick={() => setLog([])} className="text-xs text-muted-foreground hover:text-foreground">clear</button>
            </div>
            <ul className="max-h-[280px] space-y-1 overflow-y-auto font-mono text-xs">
              {log.length === 0 && <li className="text-muted-foreground">No events yet — tap the screen.</li>}
              {log.map((e, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className="text-emerald-400">{new Date(e.t).toLocaleTimeString()}</span> {e.msg}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------- modals -------------------------------- */
function ModalOverlay({ modal, onClose }: { modal: Exclude<ModalKind, null>; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm">
      <div className="w-full rounded-lg border border-emerald-400/40 bg-neutral-900 p-3 text-white shadow-2xl" style={{ maxHeight: "94%", overflowY: "auto" }}>
        {modal.kind === "info" && (
          <>
            <h3 className="mb-2 text-sm font-bold text-emerald-300">{modal.title}</h3>
            <p className="mb-3 whitespace-pre-line text-xs">{modal.body}</p>
            <button onClick={onClose} className="w-full rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">OK</button>
          </>
        )}
        {modal.kind === "slider" && <SliderModal modal={modal} onClose={onClose} />}
        {modal.kind === "meds" && <MedsModal modal={modal} onClose={onClose} />}
        {modal.kind === "save" && <SaveContactModal modal={modal} onClose={onClose} />}
      </div>
    </div>
  );
}

function SliderModal({ modal, onClose }: { modal: Extract<ModalKind, { kind: "slider" }>; onClose: () => void }) {
  const [v, setV] = useState(modal.value);
  return (
    <>
      <h3 className="mb-2 text-sm font-bold text-emerald-300">{modal.title}</h3>
      <div className="mb-2 text-center text-2xl font-bold">{v}%</div>
      <input type="range" min={0} max={100} value={v} onChange={(e) => setV(Number(e.target.value))} className="mb-3 w-full accent-emerald-400" />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button onClick={() => { modal.onSet(v); onClose(); }} className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">Save</button>
      </div>
    </>
  );
}

function MedsModal({ modal, onClose }: { modal: Extract<ModalKind, { kind: "meds" }>; onClose: () => void }) {
  const [entries, setEntries] = useState<Med[]>(modal.meds.slice(0, 5));
  const update = (i: number, p: Partial<Med>) => setEntries(entries.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <>
      <h3 className="mb-2 text-sm font-bold text-emerald-300">Medications (up to 5)</h3>
      <div className="mb-2 flex flex-col gap-1.5">
        {entries.length === 0 && <div className="text-xs text-white/60">No medications set.</div>}
        {entries.map((m, i) => (
          <div key={i} className="flex items-center gap-1 rounded border border-white/10 bg-white/5 p-1.5">
            <input type="time" value={m.time} onChange={(e) => update(i, { time: e.target.value })} className="rounded bg-black/40 px-1 py-0.5 text-xs" />
            <input value={m.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="label" className="min-w-0 flex-1 rounded bg-black/40 px-1 py-0.5 text-xs" />
            <button onClick={() => setEntries(entries.filter((_, idx) => idx !== i))} className="rounded bg-red-500/70 px-1.5 text-xs">×</button>
          </div>
        ))}
      </div>
      {entries.length < 5 && (
        <button onClick={() => setEntries([...entries, { time: "12:00", label: `Dose ${entries.length + 1}` }])}
          className="mb-2 w-full rounded border border-dashed border-white/20 py-1 text-xs text-white/70">+ Add medication</button>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button onClick={() => { modal.onSave(entries); onClose(); }} className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">Save</button>
      </div>
    </>
  );
}

function SaveContactModal({ modal, onClose }: { modal: Extract<ModalKind, { kind: "save" }>; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <>
      <h3 className="mb-1 text-sm font-bold text-emerald-300">Save contact</h3>
      <p className="mb-2 font-mono text-[11px] text-white/60">{modal.number}</p>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Contact name" autoFocus
        className="mb-3 w-full rounded border border-white/10 bg-black/50 p-1.5 text-xs" />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button onClick={() => { modal.onSave(name.trim()); onClose(); }} className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">Save</button>
      </div>
    </>
  );
}
