import type { Reminder } from "./reminders";

function recipeText(text: string) {
  return text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;
    try {
      const url = new URL(part);
      return <a className="recipe-source" key={index} href={url.href} target="_blank" rel="noopener noreferrer">参考レシピ（{url.hostname}）</a>;
    } catch { return part; }
  });
}

export function TodaySteps({ title, steps }: { title: string; steps: string[] }) {
  if (steps.length === 0) return null;
  return <div className="today-steps"><h3>{title}</h3><ol>{steps.map((step, index) => <li key={`${index}:${step}`}>{recipeText(step)}</li>)}</ol></div>;
}

export function ReminderEditor({ title, description, value, onChange }: {
  title: string; description: string; value: Reminder; onChange: (value: Reminder) => void;
}) {
  return <section className="reminder-card">
    <label className="reminder-toggle"><input type="checkbox" checked={value.enabled}
      onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />
      <span><strong>{title}</strong><small>{description}</small></span></label>
    {value.enabled && <div className="reminder-fields">
      <label>曜日<select value={value.weekday} onChange={(event) => onChange({ ...value, weekday: Number(event.target.value) })}>
        {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => <option key={day} value={index}>{day}曜日</option>)}
      </select></label>
      <label>時刻<input type="time" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value })} /></label>
    </div>}
  </section>;
}

