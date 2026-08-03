import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import splashAsset from "@/assets/tft/splash.png.asset.json";
import home1Asset from "@/assets/tft/home1.png.asset.json";
import home2Asset from "@/assets/tft/home2.png.asset.json";
import aiAsset from "@/assets/tft/ai.png.asset.json";
import keypadAsset from "@/assets/tft/keypad.png.asset.json";
import musicAsset from "@/assets/tft/music.png.asset.json";
import callingAsset from "@/assets/tft/calling.png.asset.json";
import backIcon from "@/assets/tft/icons/back.png";
import bat100Icon from "@/assets/tft/icons/bat100.png";
import bat75Icon from "@/assets/tft/icons/bat75.png";
import bat50Icon from "@/assets/tft/icons/bat50.png";
import bat25Icon from "@/assets/tft/icons/bat25.png";
import batLowIcon from "@/assets/tft/icons/batlow.png";
import batChgIcon from "@/assets/tft/icons/batchg.png";
import netIcon from "@/assets/tft/icons/net.png";
import noNetIcon from "@/assets/tft/icons/nonet.png";
import playIcon from "@/assets/tft/icons/play.png";
import pauseIcon from "@/assets/tft/icons/pause.png";

export const Route = createFileRoute("/tft-simulator")({
  head: () => ({
    meta: [
      { title: "TFT Simulator — Mind Buddy Debug" },
      { name: "description", content: "Interactive TFT screen simulator for MindBuddy device UI flow debugging." },
      { property: "og:title", content: "TFT Simulator — Mind Buddy Debug" },
      { property: "og:description", content: "Preview the MindBuddy TFT pages, icons, and touch regions in-browser." },
    ],
  }),
  component: TftSimulator,
});

// ---------- Asset URLs (Lovable CDN) ----------
const A = {
  splash: splashAsset.url,
  home1: home1Asset.url,
  home2: home2Asset.url,
  ai: aiAsset.url,
  keypad: keypadAsset.url,
  music: musicAsset.url,
  calling: callingAsset.url,
  back: backIcon,
  bat100: bat100Icon,
  bat75: bat75Icon,
  bat50: bat50Icon,
  bat25: bat25Icon,
  batlow: batLowIcon,
  batchg: batChgIcon,
  net: netIcon,
  nonet: noNetIcon,
  play: playIcon,
  pause: pauseIcon,
} as const;

/** Same rule the firmware uses (see firmware/shared/mb_ui.inc). */
function batteryIcon(pct: number, charging: boolean): string {
  if (charging) return A.batchg;
  if (pct >= 88) return A.bat100;
  if (pct >= 63) return A.bat75;
  if (pct >= 38) return A.bat50;
  if (pct >= 25) return A.bat25;
  return A.batlow;
}


type Page = "splash" | "home1" | "home2" | "ai" | "keypad" | "music" | "calling" | "sms";

type Region = {
  id: string;
  x: number; y: number; w: number; h: number;
  label: string;
  action: () => void;
};

const SCREEN_W = 280;
const SCREEN_H = 320;
const SCALE = 2;

const MODES = ["ANXIETY", "DEPRESSION", "ADHD", "PTSD", "BIPOLAR", "SCHIZOPHRENIA", "MOOD", "CHAT", "PIPELINE"] as const;
const TTS_ENGINES = ["Kokoro TTS", "Piper TTS"] as const;
const VOICES = ["Female", "Male"] as const;
const PIPELINES = ["Auto", "Local", "Server"] as const;
const MOODS = ["😄 Great", "🙂 Good", "😐 Okay", "😔 Low", "😢 Sad", "😡 Angry", "😰 Anxious"] as const;

type Med = { time: string; label: string };

type ModalKind =
  | null
  | { kind: "info"; title: string; body: string }
  | { kind: "choice"; title: string; options: readonly string[]; onPick: (v: string) => void }
  | { kind: "slider"; title: string; value: number; onSet: (v: number) => void }
  | { kind: "meds"; meds: Med[]; onSave: (m: Med[]) => void }
  | { kind: "sms-compose"; contact: Contact; onSend: (body: string) => void }
  | { kind: "sms-save"; number: string; onSave: (name: string) => void };

type Contact = { name: string; number: string };

function TftSimulator() {
  const [page, setPage] = useState<Page>("splash");
  const [history, setHistory] = useState<Page[]>([]);
  const [log, setLog] = useState<{ t: number; msg: string }[]>([]);
  const [showRegions, setShowRegions] = useState(true);
  const [dialed, setDialed] = useState("");
  const [playing, setPlaying] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  // Device state
  const [mode, setMode] = useState<string>("ANXIETY");
  const [tts, setTts] = useState<string>("Kokoro TTS");
  const [voice, setVoice] = useState<string>("Female");
  const [volume, setVolume] = useState<number>(70);
  const [pipeline, setPipeline] = useState<string>("Auto");
  const [meds, setMeds] = useState<Med[]>([
    { time: "08:00", label: "Morning dose" },
  ]);
  const [moodLog, setMoodLog] = useState<{ mood: string; t: number }[]>([]);
  const [battery, setBattery] = useState<number>(82);
  const [charging, setCharging] = useState<boolean>(false);
  const [online, setOnline] = useState<boolean>(true);

  // ESP32 RAM-style saved contacts (persist for the session, cap 10).
  const [contacts, setContacts] = useState<Contact[]>([
    { name: "Caregiver", number: "+2348012345678" },
    { name: "Emergency", number: "112" },
  ]);
  const [sentSms, setSentSms] = useState<{ to: string; body: string; t: number }[]>([]);
  // Simulated inbox — messages the device "received" over the modem.
  const [inbox, setInbox] = useState<{ from: string; name?: string; body: string; t: number; read: boolean }[]>([
    { from: "+2348012345678", name: "Caregiver", body: "Hey, how are you feeling today?", t: Date.now() - 1000 * 60 * 12, read: false },
    { from: "112", name: "Emergency", body: "Test message from emergency line.", t: Date.now() - 1000 * 60 * 60 * 2, read: true },
  ]);
  // Bump this to force a GIF <img> to restart (query param cache-buster).
  const [gifNonce, setGifNonce] = useState(0);

  const goto = (p: Page, msg?: string) => {
    setHistory((h) => [...h, page]);
    setPage(p);
    setGifNonce((n) => n + 1);
    if (msg) pushLog(msg);
  };
  const back = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setPage(prev);
      setGifNonce((n) => n + 1);
      return h.slice(0, -1);
    });
  };
  const pushLog = (msg: string) => setLog((l) => [{ t: Date.now(), msg }, ...l].slice(0, 80));

  const restart = () => {
    setPage("splash");
    setHistory([]);
    setDialed("");
    setPlaying(true);
    setModal(null);
    setGifNonce((n) => n + 1);
    pushLog("↻ Restarted — booting splash");
  };

  const [bootProgress, setBootProgress] = useState(0);
  useEffect(() => {
    if (page !== "splash") {
      setBootProgress(0);
      return;
    }
    pushLog("Boot: splash animation playing…");
    const started = Date.now();
    const DURATION = 4600;
    const id = setInterval(() => {
      setBootProgress(Math.min(100, ((Date.now() - started) / DURATION) * 100));
    }, 60);
    // Splash GIF is ~4.3s and does not loop; advance right after it ends.
    const t = setTimeout(() => {
      setPage((p) => (p === "splash" ? "home1" : p));
      setGifNonce((n) => n + 1);
      pushLog("Splash → Home Page 1");
    }, DURATION);
    return () => { clearTimeout(t); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, gifNonce]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);
  const timeStr = useMemo(
    () => `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    [now]
  );

  // Next medication time (earliest upcoming today, else earliest)
  const nextMed = useMemo(() => {
    if (meds.length === 0) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const parsed = meds
      .map((m) => {
        const [h, mm] = m.time.split(":").map(Number);
        return { ...m, mins: (h || 0) * 60 + (mm || 0) };
      })
      .sort((a, b) => a.mins - b.mins);
    const upcoming = parsed.find((p) => p.mins >= nowMin);
    return upcoming || parsed[0];
  }, [meds, now]);

  const openMode = () => setModal({
    kind: "info",
    title: "Current Support Mode",
    body: `Active mode: ${mode}\n\nUse Home Page 2 to switch modes.`,
  });

  const openTts = () => setModal({
    kind: "choice", title: "Select TTS Engine", options: TTS_ENGINES,
    onPick: (v) => { setTts(v); pushLog(`TTS engine → ${v}`); },
  });
  const openVoice = () => setModal({
    kind: "choice", title: "Select Voice", options: VOICES,
    onPick: (v) => { setVoice(v); pushLog(`Voice → ${v}`); },
  });
  const openVolume = () => setModal({
    kind: "slider", title: "Volume", value: volume,
    onSet: (v) => { setVolume(v); pushLog(`Volume → ${v}%`); },
  });
  const openPipeline = () => setModal({
    kind: "choice", title: "Pipeline", options: PIPELINES,
    onPick: (v) => { setPipeline(v); pushLog(`Pipeline → ${v}`); },
  });
  const openMood = () => setModal({
    kind: "choice", title: "Log your mood", options: MOODS,
    onPick: (v) => { setMoodLog((l) => [{ mood: v, t: Date.now() }, ...l].slice(0, 20)); pushLog(`Mood logged: ${v}`); },
  });
  const openMeds = () => setModal({
    kind: "meds", meds,
    onSave: (m) => { setMeds(m); pushLog(`Medications updated (${m.length} entries)`); },
  });
  const pickMode = (m: string) => { setMode(m); pushLog(`Mode → ${m}`); };

  const regions: Region[] = useMemo(() => {
    switch (page) {
      case "home1":
        return [
          { id: "message", x: 18, y: 62, w: 78, h: 78, label: "MESSAGE", action: () => goto("sms", "Tap MESSAGE → SMS") },
          { id: "med", x: 101, y: 62, w: 78, h: 78, label: "MED", action: openMeds },
          { id: "music", x: 184, y: 62, w: 78, h: 78, label: "MUSIC", action: () => goto("music", "Tap MUSIC → Music page") },
          { id: "vol", x: 18, y: 148, w: 78, h: 78, label: "VOL", action: openVolume },
          { id: "tts", x: 101, y: 148, w: 78, h: 78, label: "TTS ENGINE", action: openTts },
          { id: "voice", x: 184, y: 148, w: 78, h: 78, label: "VOICE", action: openVoice },
          { id: "sos", x: 18, y: 244, w: 74, h: 62, label: "SOS", action: () => goto("keypad", "🚨 SOS → Keypad") },
          { id: "next", x: 175, y: 250, w: 92, h: 55, label: "→ Home 2", action: () => goto("home2", "Home 1 → Home 2 (modes)") },
        ];
      case "home2":
        return [
          { id: "back", x: 10, y: 8, w: 58, h: 42, label: "← Back", action: () => goto("home1", "Home 2 → Home 1") },
          { id: "pipeline", x: 15, y: 60, w: 78, h: 78, label: "PIPELINE", action: openPipeline },
          { id: "mood", x: 101, y: 60, w: 78, h: 78, label: "MOOD", action: openMood },
          { id: "chat", x: 187, y: 60, w: 78, h: 78, label: "CHAT", action: () => goto("ai", "Chat → AI Response") },
          { id: "schizo", x: 15, y: 143, w: 78, h: 78, label: "SCHIZO.", action: () => pickMode("SCHIZOPHRENIA") },
          { id: "adhd", x: 101, y: 143, w: 78, h: 78, label: "ADHD", action: () => pickMode("ADHD") },
          { id: "anxiety", x: 187, y: 143, w: 78, h: 78, label: "ANXIETY", action: () => pickMode("ANXIETY") },
          { id: "bipolar", x: 15, y: 226, w: 78, h: 78, label: "BIPOLAR", action: () => pickMode("BIPOLAR") },
          { id: "ptsd", x: 101, y: 226, w: 78, h: 78, label: "PTSD", action: () => pickMode("PTSD") },
          { id: "depre", x: 187, y: 226, w: 78, h: 78, label: "DEPRE.", action: () => pickMode("DEPRESSION") },
        ];
      case "ai":
        return [
          { id: "back", x: 8, y: 8, w: 60, h: 45, label: "← Back", action: () => { back(); pushLog("AI Response ← Back"); } },
        ];
      case "keypad":
        return buildKeypadRegions(
          setDialed,
          pushLog,
          () => goto("calling", `Dialing ${dialed || "(no number)"}...`),
          back,
          () => {
            const num = dialed.trim();
            if (!num) { pushLog("SAVE ignored — no number typed"); return; }
            setModal({
              kind: "sms-save",
              number: num,
              onSave: (name) => {
                setContacts((cs) => {
                  if (cs.length >= 10) { pushLog("Contacts full (10 max)"); return cs; }
                  if (cs.some((c) => c.number === num)) { pushLog("Contact already saved"); return cs; }
                  return [...cs, { name: name || `Contact ${cs.length + 1}`, number: num }];
                });
                pushLog(`Contact saved: ${name || "unnamed"} ${num}`);
                setDialed("");
              },
            });
          },
        );
      case "music":
        return [
          { id: "back", x: 8, y: 8, w: 60, h: 45, label: "← Back", action: () => { back(); pushLog("Music ← Back"); } },
          { id: "prev", x: 22, y: 240, w: 62, h: 58, label: "Prev", action: () => pushLog("⏮ prev") },
          { id: "play", x: 110, y: 240, w: 62, h: 58, label: "Play/Pause", action: () => { setPlaying((p) => { pushLog(p ? "⏸ pause" : "▶ play"); return !p; }); } },
          { id: "next", x: 198, y: 240, w: 62, h: 58, label: "Next", action: () => pushLog("⏭ next") },
        ];
      case "calling":
        return [
          { id: "hangup", x: 100, y: 218, w: 82, h: 82, label: "Hang up", action: () => { goto("home1", "☎ Hang up → Home 1"); setDialed(""); } },
        ];
      case "sms":
        return [
          // Matches the Back button PNG drawn at (6,6) 40x40 — 4px of slop
          // on every side so a fingertip on the 240x320 panel still lands.
          { id: "back", x: 4, y: 4, w: 44, h: 44, label: "Back", action: () => { back(); pushLog("SMS ← Back"); } },
        ];

      case "splash":
      default:
        return [
          { id: "skip", x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, label: "Tap to skip", action: () => { setPage("home1"); setGifNonce((n) => n + 1); pushLog("Splash skipped → Home 1"); } },
        ];
    }
  }, [page, dialed, contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageImage: Record<Page, string | null> = {
    splash: A.splash,
    home1: A.home1,
    home2: A.home2,
    ai: A.ai,
    keypad: A.keypad,
    music: A.music,
    calling: A.calling,
    sms: null,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Mind Buddy</Link>
            <h1 className="text-lg font-semibold">TFT Simulator</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">debug</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
              show touch regions
            </label>
            <button
              onClick={restart}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              ↻ Restart
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative rounded-[28px] bg-neutral-900 p-3 shadow-2xl ring-1 ring-black/60"
            style={{ width: SCREEN_W * SCALE + 24, height: SCREEN_H * SCALE + 24 }}
          >
            <div
              className="relative overflow-hidden rounded-[16px] bg-black"
              style={{ width: SCREEN_W * SCALE, height: SCREEN_H * SCALE }}
            >
              {pageImage[page] && (
                <img
                  // Query nonce forces the GIF to restart from frame 1 on
                  // (re)entry; the gifs are non-looping so they hold their
                  // last frame after playing once.
                  key={`${page}-${gifNonce}`}
                  src={`${pageImage[page]!}?n=${gifNonce}`}
                  alt={`${page} page`}
                  className="absolute inset-0 h-full w-full select-none"
                  draggable={false}
                />
              )}

              {page === "splash" && (
                <div
                  className="absolute flex flex-col items-center gap-1"
                  style={{ left: 40 * SCALE, top: 272 * SCALE, width: (SCREEN_W - 80) * SCALE }}
                >
                  <div
                    className="w-full overflow-hidden rounded-full bg-white/25"
                    style={{ height: 6 * SCALE }}
                  >
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                      style={{ width: `${bootProgress}%` }}
                    />
                  </div>
                  <span className="text-white/80" style={{ fontSize: 9 * SCALE }}>
                    Loading… {Math.round(bootProgress)}%
                  </span>
                </div>
              )}

              {page === "home1" && (
                <StatusBar
                  timeStr={timeStr}
                  nextMed={nextMed?.time ?? null}
                  mode={mode}
                  pipeline={pipeline}
                  tts={tts}
                  voice={voice}
                  volume={volume}
                  battery={battery}
                  charging={charging}
                  online={online}

                />
              )}

              {page === "keypad" && (
                <div
                  className="absolute flex items-center justify-center rounded-full bg-white font-mono text-black"
                  style={{
                    left: 22 * SCALE, top: 32 * SCALE,
                    width: 200 * SCALE, height: 32 * SCALE,
                    fontSize: 14 * SCALE,
                    letterSpacing: "1px",
                  }}
                >
                  {dialed || "\u00A0"}
                </div>
              )}

              {page === "calling" && (
                <div
                  className="absolute text-center font-mono text-white"
                  style={{
                    left: 0, right: 0,
                    top: 108 * SCALE,
                    fontSize: 13 * SCALE,
                    letterSpacing: "1px",
                  }}
                >
                  {dialed || "Unknown"}
                </div>
              )}

              {page === "music" && (
                <img
                  src={playing ? A.pause : A.play}
                  alt=""
                  className="absolute"
                  style={{
                    left: 114 * SCALE, top: 237 * SCALE,
                    width: 51 * SCALE, height: 51 * SCALE,
                  }}
                />
              )}

              {page === "sms" && (
                <SmsScreen
                  contacts={contacts}
                  sent={sentSms}
                  inbox={inbox}
                  onMarkRead={(idx) =>
                    setInbox((ib) => ib.map((m, i) => (i === idx ? { ...m, read: true } : m)))
                  }
                  onSimulateIncoming={() => {
                    const pool = contacts.length > 0 ? contacts : [{ name: "Unknown", number: "+2340000000" }];
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    const bodies = [
                      "Just checking in on you 💚",
                      "Don't forget your medication.",
                      "How was your therapy session?",
                      "I'm proud of you today.",
                      "Call me when you're free.",
                    ];
                    const body = bodies[Math.floor(Math.random() * bodies.length)];
                    setInbox((ib) => [{ from: pick.number, name: pick.name, body, t: Date.now(), read: false }, ...ib].slice(0, 20));
                    pushLog(`SMS ← ${pick.name} (${pick.number})`);
                  }}
                  onCompose={(c) => setModal({
                    kind: "sms-compose",
                    contact: c,
                    onSend: (body) => {
                      setSentSms((l) => [{ to: c.number, body, t: Date.now() }, ...l].slice(0, 20));
                      pushLog(`SMS → ${c.name} (${c.number}): "${body.slice(0, 40)}"`);
                    },
                  })}
                  onDelete={(idx) => {
                    setContacts((cs) => cs.filter((_, i) => i !== idx));
                    pushLog("SMS: contact removed");
                  }}
                />
              )}

              {/* SMS is the only page with no background GIF, so it draws the
                  real Back button PNG itself. z-10 keeps it above the list;
                  the touch region below is rendered last and stays on top. */}
              {page === "sms" && (
                <img
                  src={A.back}
                  alt=""
                  className="pointer-events-none absolute z-10"
                  style={{ left: 6 * SCALE, top: 6 * SCALE, width: 40 * SCALE, height: 40 * SCALE }}
                />
              )}


              {regions.map((r) => (
                <button
                  key={r.id}
                  onClick={r.action}
                  title={r.label}
                  className={
                    "absolute transition " +
                    (showRegions
                      ? "border-2 border-emerald-400/70 bg-emerald-400/10 hover:bg-emerald-400/25"
                      : "bg-transparent hover:bg-white/5")
                  }
                  style={{
                    left: r.x * SCALE, top: r.y * SCALE,
                    width: r.w * SCALE, height: r.h * SCALE,
                  }}
                >
                  {showRegions && (
                    <span className="pointer-events-none absolute left-1 top-0 text-[10px] font-semibold text-emerald-200 drop-shadow">
                      {r.label}
                    </span>
                  )}
                </button>
              ))}

              {modal && (
                <ModalOverlay modal={modal} onClose={() => setModal(null)} />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Native {SCREEN_W}×{SCREEN_H} · @ {SCALE}× · page: <b>{page}</b>
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">Device state</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>Mode: <b className="text-foreground">{mode}</b></div>
              <div>Pipeline: <b className="text-foreground">{pipeline}</b></div>
              <div>TTS: <b className="text-foreground">{tts}</b></div>
              <div>Voice: <b className="text-foreground">{voice}</b></div>
              <div>Volume: <b className="text-foreground">{volume}%</b></div>
              <div>Next med: <b className="text-foreground">{nextMed ? `${nextMed.time} (${nextMed.label})` : "—"}</b></div>
              <div className="col-span-2">Meds: <span className="text-foreground">{meds.map((m) => m.time).join(", ") || "—"}</span></div>
              <div className="col-span-2">Last mood: <span className="text-foreground">{moodLog[0]?.mood ?? "—"}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
              <label className="flex items-center gap-2">
                Battery
                <input
                  type="range" min={0} max={100} value={battery}
                  onChange={(e) => setBattery(Number(e.target.value))}
                  className="w-28"
                />
                <b className="text-foreground">{battery}%</b>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={charging} onChange={(e) => setCharging(e.target.checked)} />
                charging
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
                network
              </label>
              <img src={batteryIcon(battery, charging)} alt="" className="h-6 w-6" />
              <img src={online ? A.net : A.nonet} alt="" className="h-6 w-6" />
            </div>
          </section>


          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold">Jump to page</h2>
            <div className="flex flex-wrap gap-2">
              {(["splash","home1","home2","ai","keypad","music","calling","sms"] as Page[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); setGifNonce((n) => n + 1); pushLog(`Jump → ${p}`); }}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs " +
                    (page === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
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
            <ul className="max-h-[320px] space-y-1 overflow-y-auto font-mono text-xs">
              {log.length === 0 && <li className="text-muted-foreground">No events yet — tap on the screen.</li>}
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

function StatusBar({
  timeStr,
  nextMed,
  mode,
  pipeline,
  tts,
  voice,
  volume,
  battery,
  charging,
  online,
}: {
  timeStr: string;
  nextMed: string | null;
  mode: string;
  pipeline: string;
  tts: string;
  voice: string;
  volume: number;
  battery: number;
  charging: boolean;
  online: boolean;
}) {
  return (
    <>
      {/* Top status icons sit close to the top edge. */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex items-center justify-between font-mono text-white drop-shadow"
        style={{
          top: 6 * SCALE,
          paddingLeft: 20 * SCALE,
          paddingRight: 20 * SCALE,
          fontSize: 11 * SCALE / 1.4,
        }}
      >
        <img src={online ? A.net : A.nonet} alt="" style={{ width: 18 * SCALE, height: 18 * SCALE }} />
        <span>{timeStr}</span>
        {nextMed && <span className="rounded bg-black/50 px-1">💊 {nextMed}</span>}
        <img src={batteryIcon(battery, charging)} alt="" style={{ width: 18 * SCALE, height: 18 * SCALE }} />
      </div>

      {/* Device state row — fills the gap between the top icons and CHECK/MED/MUSIC. */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex flex-col items-center gap-[2px] font-mono text-white/90"
        style={{
          top: 30 * SCALE,
          paddingLeft: 14 * SCALE,
          paddingRight: 14 * SCALE,
          fontSize: 9 * SCALE / 1.4,
          lineHeight: 1.1,
        }}
      >
        <div className="flex w-full items-center justify-between">
          <span className="rounded bg-emerald-500/30 px-1">MODE {mode}</span>
          <span className="rounded bg-sky-500/30 px-1">{pipeline}</span>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="rounded bg-white/10 px-1">{tts} · {voice}</span>
          <span className="rounded bg-white/10 px-1">VOL {volume}%</span>
        </div>
      </div>
    </>
  );
}

function SmsScreen({
  contacts,
  sent,
  inbox,
  onMarkRead,
  onSimulateIncoming,
  onCompose,
  onDelete,
}: {
  contacts: Contact[];
  sent: { to: string; body: string; t: number }[];
  inbox: { from: string; name?: string; body: string; t: number; read: boolean }[];
  onMarkRead: (idx: number) => void;
  onSimulateIncoming: () => void;
  onCompose: (c: Contact) => void;
  onDelete: (idx: number) => void;
}) {
  const unread = inbox.filter((m) => !m.read).length;
  return (
    <div
      className="absolute inset-0 flex flex-col bg-neutral-950 text-white"
      // Header band is 52px tall in native TFT units (Back button is 40px at
      // y=6), so the scrollable body starts below it and never slides under
      // the Back button.
      style={{ paddingTop: 52 * SCALE }}
    >
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-emerald-500/30 bg-black/70 font-mono"
        style={{
          height: 52 * SCALE,
          // Clears the 40px Back button PNG drawn at x=6 (+6px gutter).
          paddingLeft: 52 * SCALE,
          paddingRight: 8 * SCALE,
          fontSize: 12 * SCALE / 1.4,
        }}
      >
        <span className="truncate text-emerald-300">
          SMS {unread > 0 && <span className="ml-1 rounded bg-red-500 px-1 text-[10px] text-white">{unread}</span>}
        </span>
        <span className="shrink-0 pl-2 text-white/60">{contacts.length}/10 saved</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">

        <div className="mb-1 mt-1 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Inbox
          </div>
          <button
            onClick={onSimulateIncoming}
            className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
            title="Simulate incoming SMS"
          >
            + incoming
          </button>
        </div>
        {inbox.length === 0 && (
          <div className="mb-2 rounded border border-dashed border-white/15 p-2 text-center text-[11px] text-white/50">
            Inbox is empty.
          </div>
        )}
        <ul className="mb-2 flex flex-col gap-1">
          {inbox.map((m, i) => (
            <li
              key={`${m.t}-${i}`}
              onClick={() => onMarkRead(i)}
              className={
                "cursor-pointer rounded border p-1.5 text-[11px] " +
                (m.read
                  ? "border-white/10 bg-white/5"
                  : "border-emerald-400/50 bg-emerald-500/10")
              }
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold text-emerald-200">
                  {m.name ?? m.from}
                  {!m.read && <span className="ml-1 rounded-full bg-red-500 px-1 text-[9px] text-white">NEW</span>}
                </span>
                <span className="ml-1 shrink-0 font-mono text-[9px] text-white/50">
                  {new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="truncate text-white/80">{m.body}</div>
            </li>
          ))}
        </ul>

        <div className="mb-1 mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          Saved numbers — tap to text
        </div>
        {contacts.length === 0 && (
          <div className="rounded border border-dashed border-white/15 p-3 text-center text-xs text-white/50">
            No saved contacts yet.
            <br />
            Dial a number on the Keypad and tap SAVE.
          </div>
        )}
        <ul className="flex flex-col gap-1.5">
          {contacts.map((c, i) => (
            <li
              key={`${c.number}-${i}`}
              className="flex items-center gap-1 rounded border border-white/10 bg-white/5 p-1.5"
            >
              <button
                onClick={() => onCompose(c)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-xs font-semibold text-emerald-200">{c.name}</div>
                <div className="truncate font-mono text-[11px] text-white/70">{c.number}</div>
              </button>
              <button
                onClick={() => onCompose(c)}
                className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-black"
              >
                Text
              </button>
              <button
                onClick={() => onDelete(i)}
                title="Remove from RAM"
                className="rounded bg-red-500/70 px-1.5 py-1 text-[11px]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {sent.length > 0 && (
          <>
            <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-white/50">
              Recently sent
            </div>
            <ul className="flex flex-col gap-1">
              {sent.slice(0, 4).map((s, i) => (
                <li key={i} className="rounded border border-white/5 bg-black/40 p-1.5 text-[10px]">
                  <div className="font-mono text-emerald-300">→ {s.to}</div>
                  <div className="text-white/70">{s.body}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SmsComposeModal({
  modal,
  onClose,
}: {
  modal: Extract<ModalKind, { kind: "sms-compose" }>;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  return (
    <>
      <h3 className="mb-1 text-sm font-bold text-emerald-300">Text {modal.contact.name}</h3>
      <p className="mb-2 font-mono text-[11px] text-white/60">{modal.contact.number}</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 160))}
        rows={4}
        placeholder="Type your message…"
        className="mb-1 w-full rounded border border-white/10 bg-black/50 p-1.5 text-xs"
      />
      <div className="mb-2 text-right text-[10px] text-white/40">{body.length}/160</div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button
          onClick={() => { if (body.trim()) { modal.onSend(body.trim()); onClose(); } }}
          disabled={!body.trim()}
          className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </>
  );
}

function SmsSaveContactModal({
  modal,
  onClose,
}: {
  modal: Extract<ModalKind, { kind: "sms-save" }>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <h3 className="mb-1 text-sm font-bold text-emerald-300">Save contact</h3>
      <p className="mb-2 font-mono text-[11px] text-white/60">{modal.number}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 20))}
        placeholder="Contact name"
        autoFocus
        className="mb-3 w-full rounded border border-white/10 bg-black/50 p-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button
          onClick={() => { modal.onSave(name.trim()); onClose(); }}
          className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black"
        >
          Save
        </button>
      </div>
    </>
  );
}

function buildKeypadRegions(
  setDialed: React.Dispatch<React.SetStateAction<string>>,
  log: (m: string) => void,
  call: () => void,
  back: () => void,
  save: () => void,
): Region[] {
  // Keypad asset is 280x320. Digit grid is a 3x4 block on the left; right
  // column holds back-arrow, SAVE and CALL. Traced from Keypad Page.png.
  const gridX = 22;
  const gridY = 78;
  const cellW = 54;
  const cellH = 48;
  const gapX = 6;
  const gapY = 6;

  const digits: { k: string; col: number; row: number }[] = [
    { k: "7", col: 0, row: 0 }, { k: "8", col: 1, row: 0 }, { k: "9", col: 2, row: 0 },
    { k: "4", col: 0, row: 1 }, { k: "5", col: 1, row: 1 }, { k: "6", col: 2, row: 1 },
    { k: "1", col: 0, row: 2 }, { k: "2", col: 1, row: 2 }, { k: "3", col: 2, row: 2 },
  ];
  const digitRegions: Region[] = digits.map(({ k, col, row }) => ({
    id: `k${k}`,
    x: gridX + col * (cellW + gapX),
    y: gridY + row * (cellH + gapY),
    w: cellW, h: cellH,
    label: k,
    action: () => { setDialed((d) => (d + k).slice(0, 15)); log(`keypad: ${k}`); },
  }));

  const row4Y = gridY + 3 * (cellH + gapY);
  const rightX = 214;

  return [
    ...digitRegions,
    { id: "cancel", x: gridX + 0 * (cellW + gapX), y: row4Y, w: cellW, h: cellH, label: "X", action: () => { setDialed(""); log("keypad: clear"); } },
    { id: "k0",     x: gridX + 1 * (cellW + gapX), y: row4Y, w: cellW, h: cellH, label: "0", action: () => { setDialed((d) => (d + "0").slice(0, 15)); log("keypad: 0"); } },
    { id: "bksp",   x: gridX + 2 * (cellW + gapX), y: row4Y, w: cellW, h: cellH, label: "⌫", action: () => { setDialed((d) => d.slice(0, -1)); log("keypad: backspace"); } },
    // Right column icons: back arrow, SAVE, Call
    { id: "back", x: rightX, y: 90,  w: 54, h: 48, label: "←",    action: () => { back(); log("keypad ← back"); } },
    { id: "save", x: rightX, y: 158, w: 54, h: 44, label: "SAVE", action: save },
    { id: "call", x: rightX, y: 214, w: 54, h: 58, label: "Call", action: call },
  ];
}

// ---------- Modal overlay rendered inside the device screen ----------
function ModalOverlay({ modal, onClose }: { modal: Exclude<ModalKind, null>; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2">
      <div className="w-full rounded-lg border border-emerald-400/40 bg-neutral-900 p-3 text-white shadow-2xl" style={{ maxHeight: "94%", overflowY: "auto" }}>
        {modal.kind === "info" && <InfoModal modal={modal} onClose={onClose} />}
        {modal.kind === "choice" && <ChoiceModal modal={modal} onClose={onClose} />}
        {modal.kind === "slider" && <SliderModal modal={modal} onClose={onClose} />}
        {modal.kind === "meds" && <MedsModal modal={modal} onClose={onClose} />}
        {modal.kind === "sms-compose" && <SmsComposeModal modal={modal} onClose={onClose} />}
        {modal.kind === "sms-save" && <SmsSaveContactModal modal={modal} onClose={onClose} />}
      </div>
    </div>
  );
}

function InfoModal({ modal, onClose }: { modal: Extract<ModalKind, { kind: "info" }>; onClose: () => void }) {
  return (
    <>
      <h3 className="mb-2 text-sm font-bold text-emerald-300">{modal.title}</h3>
      <p className="mb-3 whitespace-pre-line text-xs">{modal.body}</p>
      <button onClick={onClose} className="w-full rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">OK</button>
    </>
  );
}
function ChoiceModal({ modal, onClose }: { modal: Extract<ModalKind, { kind: "choice" }>; onClose: () => void }) {
  return (
    <>
      <h3 className="mb-2 text-sm font-bold text-emerald-300">{modal.title}</h3>
      <div className="mb-2 flex flex-col gap-1.5">
        {modal.options.map((o) => (
          <button key={o} onClick={() => { modal.onPick(o); onClose(); }} className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-left text-xs hover:bg-emerald-500/20">
            {o}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="w-full rounded bg-white/10 py-1 text-xs">Cancel</button>
    </>
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
  const add = () => entries.length < 5 && setEntries([...entries, { time: "12:00", label: `Dose ${entries.length + 1}` }]);
  const remove = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<Med>) => setEntries(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  return (
    <>
      <h3 className="mb-2 text-sm font-bold text-emerald-300">Medications (up to 5)</h3>
      <div className="mb-2 flex flex-col gap-1.5">
        {entries.length === 0 && <div className="text-xs text-white/60">No medications set.</div>}
        {entries.map((m, i) => (
          <div key={i} className="flex items-center gap-1 rounded border border-white/10 bg-white/5 p-1.5">
            <input type="time" value={m.time} onChange={(e) => update(i, { time: e.target.value })} className="rounded bg-black/40 px-1 py-0.5 text-xs" />
            <input value={m.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="label" className="min-w-0 flex-1 rounded bg-black/40 px-1 py-0.5 text-xs" />
            <button onClick={() => remove(i)} className="rounded bg-red-500/70 px-1.5 text-xs">×</button>
          </div>
        ))}
      </div>
      {entries.length < 5 && (
        <button onClick={add} className="mb-2 w-full rounded border border-dashed border-white/20 py-1 text-xs text-white/70">+ Add medication</button>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded bg-white/10 py-1.5 text-xs">Cancel</button>
        <button onClick={() => { modal.onSave(entries); onClose(); }} className="flex-1 rounded bg-emerald-500 py-1.5 text-xs font-semibold text-black">Save</button>
      </div>
    </>
  );
}
