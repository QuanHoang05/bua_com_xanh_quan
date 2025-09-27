import { SunMedium, MoonStar } from "lucide-react";

export default function ThemeSwitcher({ theme, setTheme }) {
  const next = () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={next}
      className="inline-flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-slate-100 text-sm"
      title={`Theme: ${label}`}
    >
      <SunMedium className="h-5 w-5 hidden dark:inline" />
      <MoonStar className="h-5 w-5 dark:hidden" />
      <span className="hidden sm:inline text-xs text-slate-700">{label}</span>
    </button>
  );
}
