import { useEffect, useRef, useState } from "react";
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

const DEFAULT_REPLAY_LENGTH = 30;
const DEFAULT_HOTKEY = "F9";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const [capturing, setCapturing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [replayLength, setReplayLength] =
    useState(DEFAULT_REPLAY_LENGTH);

  const [hotkey, setHotkey] =
    useState(DEFAULT_HOTKEY);

  const [quality, setQuality] =
    useState("Auto");

  const [status, setStatus] =
    useState("Starting...");

  const [clips, setClips] =
    useState<Clip[]>([]);

  /*
   * Prevent the hotkey callback from using
   * stale React state.
   */
  const capturingRef =
    useRef(capturing);

  const savingRef =
    useRef(saving);

  const replayLengthRef =
    useRef(replayLength);

  useEffect(() => {
    capturingRef.current =
      capturing;
  }, [capturing]);

  useEffect(() => {
    savingRef.current =
      saving;
  }, [saving]);

  useEffect(() => {
    replayLengthRef.current =
      replayLength;
  }, [replayLength]);

  /*
   * Automatically start the rolling recorder
   * when KoosReplay launches.
   */
  useEffect(() => {
    let mounted = true;

    async function beginCapture() {
      try {
        await invoke(
          "start_capture",
          {
            outputDir:
              "Videos\\KoosReplay",
          }
        );

        if (mounted) {
          setCapturing(true);
          setStatus("Capturing");
        }
      } catch (error) {
        console.error(
          "Automatic capture failed:",
          error
        );

        if (mounted) {
          setCapturing(false);
          setStatus(
            "Capture unavailable"
          );
        }
      }
    }

    void beginCapture();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Start the recorder manually if needed.
   */
  async function startCapture() {
    try {
      setStatus(
        "Starting capture..."
      );

      await invoke(
        "start_capture",
        {
          outputDir:
            "Videos\\KoosReplay",
        }
      );

      setCapturing(true);
      setStatus("Capturing");
    } catch (error) {
      console.error(error);

      setStatus(
        "Capture failed"
      );

      alert(
        `Could not start KoosReplay.\n\n${String(
          error
        )}`
      );
    }
  }

  /*
   * Stop the rolling recorder.
   */
  async function stopCapture() {
    try {
      await invoke(
        "stop_capture"
      );

      setCapturing(false);
      setStatus("Stopped");
    } catch (error) {
      console.error(error);

      alert(
        `Could not stop capture.\n\n${String(
          error
        )}`
      );
    }
  }

  /*
   * Save the previous X seconds.
   *
   * IMPORTANT:
   * This does NOT stop the recorder.
   *
   * F9 -> save replay
   *       ↓
   * recorder continues
   */
  async function saveReplay() {
    if (!capturingRef.current) {
      /*
       * If capture somehow stopped,
       * restart it automatically.
       */
      await startCapture();
      return;
    }

    if (savingRef.current) {
      return;
    }

    try {
      setSaving(true);
      savingRef.current = true;

      setStatus(
        "Saving replay..."
      );

      const path =
        await invoke<string>(
          "save_replay",
          {
            seconds:
              replayLengthRef.current,
          }
        );

      const clip: Clip = {
        id: Date.now(),

        title:
          "KoosReplay " +
          new Date().toLocaleTimeString(),

        duration:
          replayLengthRef.current,

        path,

        created:
          "Just now",
      };

      setClips(
        (current) => [
          clip,
          ...current,
        ]
      );

      setStatus(
        "Replay saved"
      );

      /*
       * Return to capturing state
       * immediately after saving.
       */
      setTimeout(() => {
        if (
          capturingRef.current
        ) {
          setStatus(
            "Capturing"
          );
        }
      }, 1500);
    } catch (error) {
      console.error(
        "Replay save failed:",
        error
      );

      setStatus(
        "Capture error"
      );

      alert(
        `Could not save replay.\n\n${String(
          error
        )}`
      );
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  /*
   * Register F9.
   *
   * This effect is intentionally separate
   * from the automatic capture effect.
   */
  useEffect(() => {
    let active = true;

    async function setupHotkey() {
      try {
        /*
         * Remove an old registration first.
         */
        try {
          await unregister(
            hotkey
          );
        } catch {
          // Nothing to unregister.
        }

        await register(
          hotkey,
          (event) => {
            if (
              !active ||
              event.state !==
                "Pressed"
            ) {
              return;
            }

            void saveReplay();
          }
        );

        console.log(
          `KoosReplay hotkey registered: ${hotkey}`
        );
      } catch (error) {
        console.error(
          "Could not register hotkey:",
          error
        );

        if (active) {
          setStatus(
            "Hotkey unavailable"
          );
        }
      }
    }

    void setupHotkey();

    return () => {
      active = false;

      void unregister(
        hotkey
      ).catch(() => {});
    };
  }, [hotkey]);

  /*
   * UI
   */
  return (
    <div className="app">

      {/* SIDEBAR */}

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

      {/* MAIN */}

      <main>

        {/* HOME */}

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
                  setPage(
                    "settings"
                  )
                }
              >
                ⚙
              </button>

            </header>

            {/* CAPTURE CARD */}

            <section className="capture-card">

              <div>

                <p className="eyebrow">
                  SMART CAPTURE
                </p>

                <h2>
                  🚀 {quality} profile
                </h2>

                <p className="capture-description">
                  60 FPS · Rolling replay buffer
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
                    if (
                      capturing
                    ) {
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
                    Last{" "}
                    {replayLength}s
                  </small>

                </button>

              </div>

            </section>

            {/* REPLAY LENGTH */}

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

            {/* RECENT CLIPS */}

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

              {clips.length ===
              0 ? (
                <div className="empty-state">

                  <div className="empty-icon">
                    ▶
                  </div>

                  <h2>
                    No clips yet
                  </h2>

                  <p>
                    KoosReplay is
                    recording in the
                    background.
                    Press{" "}
                    {hotkey} when
                    something awesome
                    happens.
                  </p>

                </div>
              ) : (
                <div className="clips">

                  {clips.map(
                    (clip) => (
                      <article
                        className="clip"
                        key={clip.id}
                      >

                        <div className="thumbnail">

                          <span>
                            ▶
                          </span>

                          <small>
                            {
                              clip.duration
                            }
                            s
                          </small>

                        </div>

                        <div className="clip-info">

                          <strong>
                            {
                              clip.title
                            }
                          </strong>

                          <span>
                            Desktop Capture
                          </span>

                          <small>
                            {
                              clip.created
                            }
                          </small>

                        </div>

                      </article>
                    )
                  )}

                </div>
              )}

            </section>
          </>
        )}

        {/* CLIPS */}

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

            {clips.length ===
            0 ? (
              <div className="empty-state">

                <div className="empty-icon">
                  ▶
                </div>

                <h2>
                  No clips yet
                </h2>

                <p>
                  KoosReplay hasn't
                  saved a replay yet.
                </p>

              </div>
            ) : (
              <div className="clips">

                {clips.map(
                  (clip) => (
                    <article
                      className="clip"
                      key={clip.id}
                    >

                      <div className="thumbnail">

                        <span>
                          ▶
                        </span>

                        <small>
                          {
                            clip.duration
                          }
                          s
                        </small>

                      </div>

                      <div className="clip-info">

                        <strong>
                          {
                            clip.title
                          }
                        </strong>

                        <span>
                          {
                            clip.path
                          }
                        </span>

                        <small>
                          {
                            clip.created
                          }
                        </small>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}
          </>
        )}

        {/* SETTINGS */}

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

              {/* REPLAY LENGTH */}

              <div className="setting">

                <div>

                  <strong>
                    Replay length
                  </strong>

                  <p>
                    How much footage
                    is saved when
                    you press F9.
                  </p>

                </div>

                <select
                  value={replayLength}
                  onChange={(event) =>
                    setReplayLength(
                      Number(
                        event.target
                          .value
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

              {/* HOTKEY */}

              <div className="setting">

                <div>

                  <strong>
                    Clip hotkey
                  </strong>

                  <p>
                    Press this key
                    to save your
                    last replay.
                  </p>

                </div>

                <input
                  value={hotkey}
                  onChange={(event) =>
                    setHotkey(
                      event.target
                        .value
                        .toUpperCase()
                    )
                  }
                  placeholder="F9"
                />

              </div>

              {/* PERFORMANCE */}

              <div className="setting">

                <div>

                  <strong>
                    Performance profile
                  </strong>

                  <p>
                    Choose how
                    aggressively
                    KoosReplay uses
                    your PC.
                  </p>

                </div>

                <select
                  value={quality}
                  onChange={(event) =>
                    setQuality(
                      event.target
                        .value
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

              {/* SAVE LOCATION */}

              <div className="setting">

                <div>

                  <strong>
                    Save location
                  </strong>

                  <p>
                    Videos\KoosReplay
                  </p>

                </div>

                <button
                  className="option"
                  onClick={() => {
                    alert(
                      "Custom save locations will be added in the next version."
                    );
                  }}
                >
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
