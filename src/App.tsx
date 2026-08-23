import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";

import "./styles.css";

type Page = "home" | "clips" | "settings";

type Clip = {
  id: number;
  title: string;
  duration: number;
  path: string;
  created: string;
};

const REPLAY_DIR = "Videos\\KoosReplay";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const [capturing, setCapturing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [replayLength, setReplayLength] =
    useState(30);

  const [hotkey, setHotkey] =
    useState("F9");

  const [quality, setQuality] =
    useState("Auto");

  const [status, setStatus] =
    useState("Ready");

  const [clips, setClips] =
    useState<Clip[]>([]);

  async function startCapture() {
    try {
      setStatus("Starting capture...");

      await invoke(
        "start_capture",
        {
          outputDir: REPLAY_DIR,
        }
      );

      setCapturing(true);
      setStatus("Capturing");
    } catch (error) {
      console.error(error);

      setStatus("Capture failed");

      alert(
        `Could not start KoosReplay.\n\n${String(error)}`
      );
    }
  }

  async function stopCapture() {
    try {
      await invoke("stop_capture");

      setCapturing(false);
      setStatus("Ready");
    } catch (error) {
      console.error(error);

      alert(
        `Could not stop capture.\n\n${String(error)}`
      );
    }
  }

  async function saveReplay() {
    if (!capturing) {
      await startCapture();
      return;
    }

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setStatus("Saving replay...");

      const path =
        await invoke<string>(
          "save_replay",
          {
            seconds: replayLength,
          }
        );

      const clip: Clip = {
        id: Date.now(),
        title: "New Replay",
        duration: replayLength,
        path,
        created: "Just now",
      };

      setClips((current) => [
        clip,
        ...current,
      ]);

      setStatus("Replay saved");
    } catch (error) {
      console.error(error);

      setStatus("Capturing");

      alert(
        `Could not save replay.\n\n${String(error)}`
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function setupHotkey() {
      try {
        await register(
          hotkey,
          (event) => {
            if (
              alive &&
              event.state === "Pressed"
            ) {
              void saveReplay();
            }
          }
        );
      } catch (error) {
        console.error(
          "Hotkey registration failed:",
          error
        );
      }
    }

    void setupHotkey();

    return () => {
      alive = false;

      void unregister(
        hotkey
      ).catch(() => {});
    };
  }, [
    hotkey,
    capturing,
    replayLength,
    saving,
  ]);

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            K
          </div>

          <span>
            KoosReplay
          </span>
        </div>

        <nav>

          <button
            className={`nav-button ${
              page === "home"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("home")
            }
          >
            <span>⌂</span>
            Home
          </button>

          <button
            className={`nav-button ${
              page === "clips"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("clips")
            }
          >
            <span>▶</span>
            My Clips
          </button>

          <button
            className={`nav-button ${
              page === "settings"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage("settings")
            }
          >
            <span>⚙</span>
            Settings
          </button>

        </nav>

        <div className="capture-status">

          <div
            className="status-dot"
            style={{
              background:
                capturing
                  ? "#65d992"
                  : "#777780",

              boxShadow:
                capturing
                  ? "0 0 12px #65d992"
                  : "none",
            }}
          />

          <div>
            <strong>
              Smart Capture
            </strong>

            <small>
              {status}
            </small>
          </div>

        </div>

      </aside>

      <main>

        {page === "home" && (
          <>
            <header>

              <div>
                <p className="eyebrow">
                  CAPTURE CENTER
                </p>

                <h1>
                  {capturing
                    ? "You're live."
                    : "Ready to clip."}
                </h1>

                <p className="subtitle">
                  {capturing
                    ? "KoosReplay is continuously capturing your desktop."
                    : "Start capture and save your last moments with F9."}
                </p>
              </div>

              <button
                className="settings-button"
                onClick={() =>
                  setPage("settings")
                }
              >
                ⚙
              </button>

            </header>

            <section className="capture-card">

              <div>

                <p className="eyebrow">
                  SMART CAPTURE
                </p>

                <h2>
                  🚀 {quality} profile
                </h2>

                <p className="capture-description">
                  60 FPS · Adaptive capture
                </p>

                <div className="chips">
                  <span>
                    Hardware encoding
                  </span>

                  <span>
                    Adaptive Capture
                  </span>
                </div>

              </div>

              <div>

                <button
                  className="replay-button"
                  onClick={() => {
                    if (capturing) {
                      void stopCapture();
                    } else {
                      void startCapture();
                    }
                  }}
                >
                  <strong>
                    {hotkey}
                  </strong>

                  <span>
                    {capturing
                      ? "Stop Capture"
                      : "Start Capture"}
                  </span>

                  <small>
                    Last {replayLength}s
                  </small>
                </button>

              </div>

            </section>

            <section className="settings-preview">

              <div className="section-header">
                <h2>
                  Replay length
                </h2>

                <strong>
                  {replayLength}s
                </strong>
              </div>

              <div className="option-row">

                {[30, 60, 120].map(
                  (seconds) => (
                    <button
                      key={seconds}
                      className={
                        replayLength ===
                        seconds
                          ? "option active-option"
                          : "option"
                      }
                      onClick={() =>
                        setReplayLength(
                          seconds
                        )
                      }
                    >
                      {seconds}s
                    </button>
                  )
                )}

              </div>

            </section>

            <section className="clips-section">

              <div className="section-header">

                <h2>
                  Recent clips
                </h2>

                <button
                  onClick={() =>
                    setPage("clips")
                  }
                >
                  View all →
                </button>

              </div>

              {clips.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    ▶
                  </div>

                  <h2>
                    No clips yet
                  </h2>

                  <p>
                    Start capturing and
                    press {hotkey} to save
                    your first replay.
                  </p>
                </div>
              ) : (
                <div className="clips">

                  {clips.map((clip) => (
                    <article
                      className="clip"
                      key={clip.id}
                    >
                      <div className="thumbnail">
                        <span>
                          ▶
                        </span>

                        <small>
                          {clip.duration}s
                        </small>
                      </div>

                      <div className="clip-info">
                        <strong>
                          {clip.title}
                        </strong>

                        <span>
                          Desktop Capture
                        </span>

                        <small>
                          {clip.created}
                        </small>
                      </div>

                    </article>
                  ))}

                </div>
              )}

            </section>
          </>
        )}

        {page === "clips" && (
          <>
            <header>
              <div>
                <p className="eyebrow">
                  LIBRARY
                </p>

                <h1>
                  My Clips
                </h1>

                <p className="subtitle">
                  Your saved KoosReplay
                  moments.
                </p>
              </div>
            </header>

            {clips.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ▶
                </div>

                <h2>
                  No clips yet
                </h2>

                <p>
                  Saved replays will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="clips">

                {clips.map((clip) => (
                  <article
                    className="clip"
                    key={clip.id}
                  >
                    <div className="thumbnail">
                      <span>
                        ▶
                      </span>

                      <small>
                        {clip.duration}s
                      </small>
                    </div>

                    <div className="clip-info">
                      <strong>
                        {clip.title}
                      </strong>

                      <span>
                        {clip.path}
                      </span>

                      <small>
                        {clip.created}
                      </small>
                    </div>
                  </article>
                ))}

              </div>
            )}
          </>
        )}

        {page === "settings" && (
          <>
            <header>
              <div>
                <p className="eyebrow">
                  CONFIGURATION
                </p>

                <h1>
                  Settings
                </h1>

                <p className="subtitle">
                  Configure KoosReplay.
                </p>
              </div>
            </header>

            <div className="settings-panel">

              <div className="setting">

                <div>
                  <strong>
                    Replay length
                  </strong>

                  <p>
                    How much footage is
                    saved when you clip.
                  </p>
                </div>

                <select
                  value={replayLength}
                  onChange={(event) =>
                    setReplayLength(
                      Number(
                        event.target.value
                      )
                    )
                  }
                >
                  <option value="30">
                    30 seconds
                  </option>

                  <option value="60">
                    60 seconds
                  </option>

                  <option value="120">
                    120 seconds
                  </option>
                </select>

              </div>

              <div className="setting">

                <div>
                  <strong>
                    Clip hotkey
                  </strong>

                  <p>
                    Keyboard shortcut used
                    to save a replay.
                  </p>
                </div>

                <input
                  value={hotkey}
                  onChange={(event) =>
                    setHotkey(
                      event.target.value
                    )
                  }
                />

              </div>

              <div className="setting">

                <div>
                  <strong>
                    Performance profile
                  </strong>

                  <p>
                    Choose how aggressively
                    KoosReplay uses your PC.
                  </p>
                </div>

                <select
                  value={quality}
                  onChange={(event) =>
                    setQuality(
                      event.target.value
                    )
                  }
                >
                  <option>
                    Auto
                  </option>

                  <option>
                    Potato
                  </option>

                  <option>
                    Medium
                  </option>

                  <option>
                    High
                  </option>

                  <option>
                    Ultra
                  </option>
                </select>

              </div>

              <div className="setting">

                <div>
                  <strong>
                    Save location
                  </strong>

                  <p>
                    Default:
                    Videos\KoosReplay
                  </p>
                </div>

                <button className="option">
                  Change
                </button>

              </div>

            </div>
          </>
        )}

      </main>

    </div>
  );
}
