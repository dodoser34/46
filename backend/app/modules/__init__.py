"""Модули барбершопа. Реестр нужен перед созданием таблиц SQLAlchemy."""
from importlib import import_module


def register_models() -> None:
    for name in ('accounts', 'catalog', 'booking', 'shop'):
        import_module(f'{__name__}.{name}.models')
