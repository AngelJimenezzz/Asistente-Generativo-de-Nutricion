from datetime import date


def compute_next_streak(current_streak: int, last_active_iso: str | None, today: date) -> int:
    """Calcula la nueva racha de días consecutivos de uso.

    - Mismo día que la última vez: no cambia (evita que abrir la app varias
      veces el mismo día infle la racha).
    - Exactamente un día después: +1 (consecutivo).
    - Cualquier otro caso (primera vez, o se saltó uno o más días): vuelve a 1.
    """
    if last_active_iso == today.isoformat():
        return current_streak or 1

    if last_active_iso:
        gap_days = (today - date.fromisoformat(last_active_iso)).days
        if gap_days == 1:
            return current_streak + 1

    return 1
