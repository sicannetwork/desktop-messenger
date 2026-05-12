import React, { useState } from "react";
import { useStore } from "../store/useStore";
import type { SettingsSchema } from "../../shared/ipc-types";

export const SettingsPanel: React.FC = () => {
  const { settings, patchSetting, setShowSettings, appVersion } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const update = async <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => {
    patchSetting(key, value);
    await window.electron.settings.set(key, value);
  };

  const handleClearCache = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    // Clear renderer-side and reload
    await window.electron.settings.reset();
    window.location.reload();
  };

  const handleLogout = async () => {
    if (!confirmLogout) { setConfirmLogout(true); return; }
    setConfirmLogout(false);
    await window.electron.session.clear();
    window.location.reload();
  };

  const handleRelaunch = () => window.electron.app.relaunch();

  return (
    <div style={styles.overlay} onClick={() => setShowSettings(false)}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>Settings</span>
          <button style={styles.closeBtn} onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div style={styles.body}>
          {/* ── General ─────────────────────────────────────────────────── */}
          <Section title="General">
            <Toggle
              label="Launch on Windows startup"
              checked={settings.launchOnStartup}
              onChange={(v) => update("launchOnStartup", v)}
            />
            <Toggle
              label="Minimize to system tray"
              checked={settings.minimizeToTray}
              onChange={(v) => update("minimizeToTray", v)}
            />
            <Toggle
              label="Close to system tray"
              checked={settings.closeToTray}
              onChange={(v) => update("closeToTray", v)}
            />
          </Section>

          {/* ── Appearance ───────────────────────────────────────────────── */}
          <Section title="Appearance">
            <SettingRow label="Theme">
              <Select
                value={settings.theme}
                options={[
                  { label: "System default", value: "system" },
                  { label: "Light",  value: "light" },
                  { label: "Dark",   value: "dark"  },
                ]}
                onChange={(v) => update("theme", v as SettingsSchema["theme"])}
              />
            </SettingRow>
            <SettingRow label={`Zoom level (${Math.round(settings.zoomLevel * 100)}%)`}>
              <input
                type="range"
                min={50}
                max={200}
                step={10}
                value={settings.zoomLevel * 100}
                onChange={(e) => update("zoomLevel", Number(e.target.value) / 100)}
                style={styles.range}
              />
            </SettingRow>
          </Section>

          {/* ── Notifications ────────────────────────────────────────────── */}
          <Section title="Notifications">
            <Toggle
              label="Show desktop notifications"
              checked={settings.showNotifications}
              onChange={(v) => update("showNotifications", v)}
            />
            <Toggle
              label="Notification sound"
              checked={settings.notificationSound}
              onChange={(v) => update("notificationSound", v)}
              disabled={!settings.showNotifications}
            />
          </Section>

          {/* ── Advanced ─────────────────────────────────────────────────── */}
          <Section title="Advanced">
            <Toggle
              label="Hardware acceleration (requires restart)"
              checked={settings.hardwareAcceleration}
              onChange={(v) => update("hardwareAcceleration", v)}
            />
            <Toggle
              label="Spell check"
              checked={settings.spellcheck}
              onChange={(v) => update("spellcheck", v)}
            />
            <SettingRow label="">
              <DangerButton
                label={confirmClear ? "Click again to confirm" : "Clear cache & reset settings"}
                onClick={handleClearCache}
                confirm={confirmClear}
              />
            </SettingRow>
          </Section>

          {/* ── Account ──────────────────────────────────────────────────── */}
          <Section title="Account">
            <SettingRow label="">
              <DangerButton
                label={confirmLogout ? "Click again to sign out" : "Sign out of Messenger"}
                onClick={handleLogout}
                confirm={confirmLogout}
              />
            </SettingRow>
          </Section>

          {/* ── About ────────────────────────────────────────────────────── */}
          {appVersion && (
            <Section title="About">
              <div style={styles.aboutGrid}>
                <AboutRow label="App version"    value={appVersion.version} />
                <AboutRow label="Electron"        value={appVersion.electronVersion} />
                <AboutRow label="Node.js"          value={appVersion.nodeVersion} />
              </div>
              <SettingRow label="">
                <button style={styles.secondaryBtn} onClick={handleRelaunch}>
                  Restart app
                </button>
              </SettingRow>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={styles.sectionTitle}>{title}</div>
    <div style={styles.sectionBody}>{children}</div>
  </div>
);

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.settingRow}>
    {label && <span style={styles.rowLabel}>{label}</span>}
    <div style={styles.rowControl}>{children}</div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <label
    style={{
      ...styles.toggleRow,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    <span style={styles.rowLabel}>{label}</span>
    <div
      style={{
        ...styles.toggleTrack,
        background: checked ? "linear-gradient(135deg,#0099ff,#a033ff)" : "#333",
      }}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div
        style={{
          ...styles.toggleThumb,
          transform: `translateX(${checked ? 16 : 0}px)`,
        }}
      />
    </div>
  </label>
);

const Select: React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={styles.select}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const DangerButton: React.FC<{
  label: string;
  onClick: () => void;
  confirm: boolean;
}> = ({ label, onClick, confirm }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.dangerBtn,
      background: confirm ? "#c42b1c" : "transparent",
      borderColor: confirm ? "#c42b1c" : "#555",
    }}
  >
    {label}
  </button>
);

const AboutRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.aboutRow}>
    <span style={styles.aboutLabel}>{label}</span>
    <span style={styles.aboutValue}>{value}</span>
  </div>
);

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position:        "fixed",
    inset:           0,
    background:      "rgba(0,0,0,0.6)",
    zIndex:          1000,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    backdropFilter:  "blur(4px)",
  },
  panel: {
    width:          420,
    maxHeight:      "80vh",
    background:     "#161616",
    borderRadius:   12,
    border:         "1px solid rgba(255,255,255,0.08)",
    boxShadow:      "0 24px 80px rgba(0,0,0,0.7)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
  },
  header: {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         "18px 20px",
    borderBottom:    "1px solid rgba(255,255,255,0.06)",
    flexShrink:      0,
  },
  headerTitle: {
    fontSize:    17,
    fontWeight:  700,
    color:       "#e4e6eb",
    fontFamily:  "'Segoe UI', system-ui, sans-serif",
  },
  closeBtn: {
    background:  "transparent",
    border:      "none",
    color:       "#888",
    fontSize:    16,
    cursor:      "pointer",
    padding:     "4px 8px",
    borderRadius: 6,
  },
  body: {
    overflowY:  "auto",
    padding:    "20px",
    flexGrow:   1,
  },
  sectionTitle: {
    fontSize:    11,
    fontWeight:  700,
    color:       "#888",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
    fontFamily:  "'Segoe UI', system-ui, sans-serif",
  },
  sectionBody: {
    display:        "flex",
    flexDirection:  "column",
    gap:            2,
  },
  settingRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "8px 0",
    gap:            16,
  },
  toggleRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "8px 0",
    gap:            16,
  },
  rowLabel: {
    fontSize:  13,
    color:     "#c8ccd0",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    flexGrow:  1,
  },
  rowControl: {
    flexShrink: 0,
  },
  toggleTrack: {
    width:        36,
    height:       20,
    borderRadius: 10,
    position:     "relative",
    cursor:       "pointer",
    transition:   "background 0.2s",
    flexShrink:   0,
  },
  toggleThumb: {
    position:     "absolute",
    top:          2,
    left:         2,
    width:        16,
    height:       16,
    background:   "#fff",
    borderRadius: "50%",
    transition:   "transform 0.2s",
  },
  select: {
    background:   "#252525",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "#e4e6eb",
    padding:      "5px 8px",
    borderRadius: 6,
    fontSize:     13,
    fontFamily:   "'Segoe UI', system-ui, sans-serif",
    cursor:       "pointer",
    outline:      "none",
  },
  range: {
    width:  120,
    cursor: "pointer",
    accentColor: "#0099ff",
  },
  dangerBtn: {
    fontSize:     12,
    fontWeight:   600,
    color:        "#ff6b6b",
    border:       "1px solid #555",
    background:   "transparent",
    padding:      "6px 12px",
    borderRadius: 6,
    cursor:       "pointer",
    transition:   "all 0.15s",
    fontFamily:   "'Segoe UI', system-ui, sans-serif",
  },
  secondaryBtn: {
    fontSize:     12,
    fontWeight:   500,
    color:        "#c8ccd0",
    border:       "1px solid rgba(255,255,255,0.15)",
    background:   "transparent",
    padding:      "6px 12px",
    borderRadius: 6,
    cursor:       "pointer",
    fontFamily:   "'Segoe UI', system-ui, sans-serif",
  },
  aboutGrid: {
    display:       "flex",
    flexDirection: "column",
    gap:           4,
    marginBottom:  12,
  },
  aboutRow: {
    display:        "flex",
    justifyContent: "space-between",
    padding:        "4px 0",
  },
  aboutLabel: { fontSize: 12, color: "#888", fontFamily: "'Segoe UI', system-ui, sans-serif" },
  aboutValue: { fontSize: 12, color: "#c8ccd0", fontFamily: "'Segoe UI', system-ui, sans-serif" },
};
