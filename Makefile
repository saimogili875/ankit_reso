.PHONY: check test run-dev

check:
	backend/venv/bin/python scripts/check_connections.py

test:
	backend/venv/bin/python backend/manage.py test apps.core
