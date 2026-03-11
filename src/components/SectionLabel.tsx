export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--text-faint)",
        fontSize: 11,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </div>
  );
}
