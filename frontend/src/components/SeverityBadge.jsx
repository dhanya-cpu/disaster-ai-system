export default function SeverityBadge({ level }) {
  return (
    <span className={`severity-pill severity-${level}`}>
      {level === 'High' ? '🔴' : level === 'Medium' ? '🟡' : '🟢'} {level} Severity
    </span>
  );
}