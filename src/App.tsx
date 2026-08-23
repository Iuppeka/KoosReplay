import "./styles.css";

const clips = [
  {
    game: "Minecraft",
    title: "Insane clutch",
    duration: "00:42",
    ago: "2 min ago",
  },
  {
    game: "Vortex",
    title: "Clean play",
    duration: "00:31",
    ago: "18 min ago",
  },
  {
    game: "Roblox",
    title: "That was close",
    duration: "00:57",
    ago: "1 hr ago",
  },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">K</div>
          <span>KoosReplay</span>
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
          <div className="status-dot" />

          <div>
            <strong>Smart Capture</strong>
            <small>Ready</small>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">CAPTURE CENTER</p>

            <h1>Ready to clip.</h1>

            <p className="subtitle">
              KoosReplay is ready to capture your gameplay.
            </p>
          </div>

          <button className="settings-button">⚙</button>
        </header>

        <section className="capture-card">
          <div>
            <p className="eyebrow">SMART CAPTURE</p>

            <h2>🚀 High-end profile</h2>

            <p className="capture-description">
              1440p · 60 FPS · Best available hardware encoder
            </p>

            <div className="chips">
              <span>Hardware encoding</span>
              <span>Adaptive Capture ON</span>
            </div>
          </div>

          <button className="replay-button">
            <strong>F9</strong>
            <span>Save Replay</span>
            <small>Last 30 seconds</small>
          </button>
        </section>

        <section className="clips-section">
          <div className="section-header">
            <h2>Recent clips</h2>

            <button>View all →</button>
          </div>

          <div className="clips">
            {clips.map((clip) => (
              <article className="clip" key={clip.title}>
                <div className="thumbnail">
                  <span>▶</span>
                  <small>{clip.duration}</small>
                </div>

                <div className="clip-info">
                  <strong>{clip.title}</strong>
                  <span>{clip.game}</span>
                  <small>{clip.ago}</small>
                </div>

                <button className="more-button">•••</button>
              </article>
            ))}
          </div>
        </section>

        <section className="performance-card">
          <div>
            <p className="eyebrow">SYSTEM</p>

            <h2>Performance protected</h2>

            <p>
              Adaptive Capture will automatically reduce recording load if
              your game needs additional resources.
            </p>
          </div>

          <div className="performance-status">
            <strong>LOW</strong>
            <span>Recorder load</span>
          </div>
        </section>
      </main>
    </div>
  );
}
