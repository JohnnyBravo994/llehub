'use client';

interface ThemeSwitcherProps {
  lightTheme: boolean;
  setLightTheme: (value: boolean) => void;
  style?: React.CSSProperties;
}

export const ThemeSwitcher = ({ lightTheme, setLightTheme, style }: ThemeSwitcherProps) => {
  const bgColor = lightTheme ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)";
  const borderColor = lightTheme ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.1)";
  const textColor = lightTheme ? "rgba(0,0,0,0.6)" : "rgba(245,240,232,0.4)";
  
  return (
    <button
      onClick={() => setLightTheme(!lightTheme)}
      title={lightTheme ? "Mudar para tema escuro" : "Mudar para tema claro"}
      style={{
        background: bgColor,
        border: borderColor,
        color: textColor,
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
