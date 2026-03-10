export function Legend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 10,
        color: "#556",
        fontSize: 11,
        lineHeight: 1.9,
        userSelect: "none",
        background: "rgba(13,13,26,0.7)",
        borderRadius: 6,
        padding: "4px 10px",
      }}
    >
      <div>R = Road · S = Select · D = Delete · X = Crossing · B = Bus Stop · P = Parking · A = Add node · Esc = Cancel</div>
      <div>Ctrl+Z = Undo · Ctrl+Y = Redo</div>
      <div>Scroll = Zoom · +/- = Zoom in/out · Shift+drag / Middle-drag = Pan</div>
      <div>
        Road size = global slider · Right-click road for per-segment size
      </div>
      <div>
        Right-click a road to edit · Hover a node to add connections
      </div>
    </div>
  );
}
