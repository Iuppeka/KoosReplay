import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import "./styles.css";

type Clip = {
  id: number;
  game: string;
  title: string;
  duration: string;
  ago: string;
};

const initialClips: Clip[] = [
  {
    id: 1,
    game: "Minecraft",
    title: "Insane clutch",
    duration: "00:42",
    ago: "2 min ago",
  },
  {
    id: 2,
    game: "Vortex",
    title: "Clean play",
    duration: "00:31",
    ago: "18 min ago",
  },
  {
    id: 3,
    game: "Roblox",
    title: "That was close",
    duration: "00:57",
    ago: "1 hr ago",
  },
];

export default function App() {
  const [capturing, setCapturing] = useState(false);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [status, setStatus] = useState("Ready");
  const [replayLength, setReplayLength] = useState(30);

  /*
   * Start capture.
   */
  async function startCapture() {
    try {
      setStatus("Starting capture...");

      const outputDir =
        "%USERPROFILE%\\Videos\\KoosReplay";

      await invoke<string>("start_capture", {
        outputDir,
      });

      setCapturing(true);
      setStatus("Capturing");
    } catch (error) {
      console.error(
        "Failed to start capture:",
        error
      );

      setCapturing(false);
      setStatus("Capture unavailable");

      alert(
        `KoosReplay could not start capture.\n\n${String(
          error
        )}`
      );
    }
  }

  /*
   * Stop capture.
   */
  async function stopCapture() {
    try {
      await invoke("stop_capture");

      setCapturing(false);
      setStatus("Ready");
    } catch (error) {
      console.error(
        "Failed to stop capture:",
        error
      );

      alert(
        `KoosReplay could not stop capture.\n\n${String(
          error
        )}`
      );
    }
  }

  /*
   * Save the replay.
   *
   * The Rust save_replay command will become the
   * actual FFmpeg replay-buffer implementation.
   */
  async function saveReplay() {
    if (!capturing) {
      await startCapture();
      return;
    }

    try {
      setStatus("Saving replay...");

      const result = await invoke<string>(
        "save_replay",
        {
          seconds: replayLength,
        }
      );

      console.log(
        "Replay saved:",
        result
      );

      const newClip: Clip = {
        id: Date.now(),
        game: "Current Game",
        title: "New replay",
        duration: `00:${String(
          replayLength
        ).padStart(2, "0")}`,
        ago: "Just now",
      };

      setClips((current) => [
        newClip,
        ...current,
      ]);

      setStatus("Replay saved");
    } catch (error) {
      console.error(
        "Failed to save replay:",
        error
      );

      setStatus("Capturing");

      alert(
        `Replay could not be saved yet.\n\n${String(
          error
        )}`
      );
    }
  }

  /*
   * Register global F9.
   *
   * Unlike a normal browser keyboard listener,
   * this works while another application is focused.
   */
  useEffect(() => {
    let active = true;

    async function setupGlobalHotkey() {
      try {
        await register(
          "F9",
          (event) => {
            if (
              active &&
              event.state === "Pressed"
            ) {
              void saveReplay();
            }
          }
        );

        console.log(
          "KoosReplay: global F9 registered"
        );
      } catch (error) {
        console.error(
          "Could not register global F9:",
          error
        );
      }
    }

    void setupGlobalHotkey();

    return () => {
      active = false;

      void unregister("F9").catch(
        (error) => {
          console.error(
            "Could not unregister F9:",
            error
          );
        }
      );
    };
  }, [capturing, replayLength]);

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
          <button className="nav-button active">
            <span>⌂</span>
            Home
          </button>

          <button className="nav-button">
            <span>▶</span>
            My Clips
          </button>

          <button className="nav-button">
            <span>⚙</span>
            Settings
          </button>
        </nav>

        <div className="capture-status">
          <div
            className="status-dot"
            style={{
              background: capturing
                ? "#65d992"
                : "#777780",
              boxShadow: capturing
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
                ? "KoosReplay is continuously capturing your gameplay."
                : "KoosReplay is ready to capture your gameplay."}
            </p>
          </div>

          <button className="settings-button">
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
              🚀 High-end profile
            </h2>

            <p className="capture-description">
              1440p · 60 FPS · Hardware encoding
            </p>

            <div className="chips">
              <span>
                Hardware encoding
              </span>

              <span>
                Adaptive Capture ON
              </span>
            </div>
          </div>

          <div>
            <button
              className="replay-button"
              onClick={() =>
                void saveReplay()
              }
            >
              <strong>
                F9
              </strong>

              <span>
                {capturing
                  ? "Save Replay"
                  : "Start Capture"}
              </span>

              <small>
                Last {replayLength} seconds
              </small>
            </button>

            {capturing && (
              <button
                onClick={() =>
                  void stopCapture()
                }
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "8px",
                  borderRadius: "9px",
                  background: "#17171b",
                  color: "#9999a2",
                }}
              >
                Stop capture
              </button>
            )}
          </div>
        </section>

        {/* REPLAY LENGTH */}

        <section
          style={{
            marginTop: "22px",
            padding: "20px",
            border: "1px solid #1d1d21",
            borderRadius: "16px",
            background: "#0f0f12",
          }}
        >
          <div className="section-header">
            <h2>
              Replay length
            </h2>

            <strong>
              {replayLength}s
            </strong>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            {[30, 60, 120].map(
              (seconds) => (
                <button
                  key={seconds}
                  onClick={() =>
                    setReplayLength(
                      seconds
                    )
                  }
                  style={{
                    padding:
                      "9px 15px",
                    borderRadius: "9px",
                    background:
                      replayLength ===
                      seconds
                        ? "#f4f4f5"
                        : "#18181c",
                    color:
                      replayLength ===
                      seconds
                        ? "#09090b"
                        : "#9999a2",
                  }}
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

            <button>
              View all →
            </button>
          </div>

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
                    {clip.duration}
                  </small>
                </div>

                <div className="clip-info">
                  <strong>
                    {clip.title}
                  </strong>

                  <span>
                    {clip.game}
                  </span>

                  <small>
                    {clip.ago}
                  </small>
                </div>

                <button className="more-button">
                  •••
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* PERFORMANCE */}

        <section className="performance-card">
          <div>
            <p className="eyebrow">
              SYSTEM
            </p>

            <h2>
              Performance protected
            </h2>

            <p>
              Adaptive Capture will
              automatically reduce recording
              load if your game needs
              additional resources.
            </p>
          </div>

          <div className="performance-status">
            <strong>
              {capturing
                ? "ACTIVE"
                : "LOW"}
            </strong>

            <span>
              Recorder load
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
