export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "#556",
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
