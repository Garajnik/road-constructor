export function Legend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 10,
        color: "var(--legend-text)",
        fontSize: 11,
        lineHeight: 1.9,
        userSelect: "none",
        background: "var(--legend-bg)",
        borderRadius: 6,
        padding: "4px 10px",
      }}
    >
      <div>R = Дорога · S = Выбрать · D = Удалить · Esc = Отмена</div>
      <div>Ctrl+Z = Отмена · Ctrl+Y = Повтор</div>
      <div>Scroll = Масштаб · +/- = Увеличить/уменьшить · Shift+перетаскивание / Средняя кнопка = Перемещение</div>
      <div>
        Размер дороги = глобальный ползунок · ПКМ по дороге для размера участка
      </div>
      <div>
        ПКМ по дороге для редактирования · Наведите на узел для добавления соединений
      </div>
    </div>
  );
}
