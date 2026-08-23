import { useState } from "react";
import "./styles.css";

type Page = "home" | "clips" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [capturing, setCapturing] = useState(false);
  const [replayLength, setReplayLength] = useState(30);
  const [quality, setQuality] = useState("Auto");
  const [hotkey, setHotkey] = useState("F9");

  function toggleCapture() {
    setCapturing((value) => !value);
  }

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">K</div>
          <span>KoosReplay</span>
        </div>

        <nav>

          <button
            className={`nav-button ${
              page === "home" ? "active" : ""
            }`}
            onClick={() => setPage("home")}
          >
            <span>⌂</span>
            Home
          </button>

          <button
            className={`nav-button ${
              page === "clips" ? "active" : ""
            }`}
            onClick={() => setPage("clips")}
          >
            <span>▶</span>
            My Clips
          </button>

          <button
            className={`nav-button ${
              page === "settings" ? "active" : ""
            }`}
            onClick={() => setPage("settings")}
          >
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
              {capturing
                ? "Capturing"
                : "Ready"}
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
                    ? "KoosReplay is ready to save your latest moments."
                    : "KoosReplay is ready to capture your gameplay."}
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
                  Automatic performance optimization
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
                  onClick={toggleCapture}
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
                    Replay: {replayLength}s
                  </small>
                </button>

              </div>

            </section>

            <section className="settings-preview">

              <div className="section-header">
                <h2>Replay length</h2>

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
                        replayLength === seconds
                          ? "option active-option"
                          : "option"
                      }
                      onClick={() =>
                        setReplayLength(seconds)
                      }
                    >
                      {seconds}s
                    </button>
                  )
                )}

              </div>

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
                  Your saved KoosReplay moments.
                </p>
              </div>
            </header>

            <div className="empty-state">
              <div className="empty-icon">
                ▶
              </div>

              <h2>
                No clips yet
              </h2>

              <p>
                Your saved replays will appear here.
              </p>
            </div>
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
                    How much footage is saved
                    when you clip.
                  </p>
                </div>

                <select
                  value={replayLength}
                  onChange={(event) =>
                    setReplayLength(
                      Number(event.target.value)
                    )
                  }
                >
                  <option value={30}>
                    30 seconds
                  </option>

                  <option value={60}>
                    60 seconds
                  </option>

                  <option value={120}>
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
                    Keyboard shortcut used to
                    save a replay.
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
                    Automatically select the
                    best settings for your PC.
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
                    Start with Windows
                  </strong>

                  <p>
                    Launch KoosReplay automatically.
                  </p>
                </div>

                <input
                  type="checkbox"
                  defaultChecked
                />

              </div>

              <div className="setting">

                <div>
                  <strong>
                    Notifications
                  </strong>

                  <p>
                    Show a notification when a
                    replay is saved.
                  </p>
                </div>

                <input
                  type="checkbox"
                  defaultChecked
                />

              </div>

            </div>
          </>
        )}

      </main>

    </div>
  );
}
