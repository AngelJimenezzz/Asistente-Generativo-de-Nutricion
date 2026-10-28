"""
Límite de uso por IP, aplicado solo a los endpoints que llaman al modelo de
lenguaje (Together.ai es de pago por uso). El demo público no tiene cuentas
ni autenticación, así que esta es la única barrera contra que alguien vacíe
el saldo prepagado del proyecto desde un script o un bot.

Vive en su propio módulo (y no en app/main.py) para evitar un import
circular: las rutas necesitan importar el mismo `limiter` que usa la app.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
