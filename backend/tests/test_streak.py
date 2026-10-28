from datetime import date

from app.utils.streak import compute_next_streak


def test_primera_vez_empieza_en_uno():
    assert compute_next_streak(0, None, date(2026, 9, 30)) == 1


def test_mismo_dia_no_cambia():
    assert compute_next_streak(5, "2026-09-30", date(2026, 9, 30)) == 5


def test_dia_consecutivo_suma_uno():
    assert compute_next_streak(5, "2026-09-29", date(2026, 9, 30)) == 6


def test_se_salto_un_dia_reinicia_a_uno():
    assert compute_next_streak(5, "2026-09-27", date(2026, 9, 30)) == 1


def test_mismo_dia_con_racha_en_cero_no_queda_en_cero():
    """Caso raro: si por alguna razón la racha guardada es 0 pero ya hay
    fecha de hoy, debe mostrar al menos 1 (no tiene sentido una racha en 0
    el mismo día que sí entró)."""
    assert compute_next_streak(0, "2026-09-30", date(2026, 9, 30)) == 1
