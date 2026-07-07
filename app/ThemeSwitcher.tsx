'use client';

interface ThemeSwitcherProps {
  lightTheme: boolean;
  setLightTheme: (value: boolean) => void;
  style?: React.CSSProperties;
}

export const ThemeSwitcher = ({ lightTheme, setLightTheme, style }: ThemeSwitcherProps) => {
  return (
    <button
      onClick={() => setLightTheme(!lightTheme)}
      title={lightTheme ? "Mudar para tema escuro" : "Mudar para tema claro"}
      style={{
        background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
        border: lightTheme ? "1px solid rgba(0,0,0,0.16)" : "1px solid rgba(255,255,255,0.1)",
        color: lightTheme ? "#000000" : "rgba(245,240,232,0.4)",
        fontSize: "12px",
        padding: "0.5rem 0.6rem",
        cursor: "pointer",
        borderRadius: "2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
        ...style
      }}
    >
      {lightTheme ? "🌙" : "☀️"}
    </button>
  );
};
