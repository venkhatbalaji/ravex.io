#!/usr/bin/env python3
"""Create a new private secret directory; never overwrite existing credentials."""
import argparse
import os
from pathlib import Path
import secrets


def generate(directory):
    directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    # Compose file secrets retain host modes. PostgreSQL runs as a different UID;
    # read-only files are accessible there while the private parent protects them
    # from other host users. Mount only the files each service needs.
    def write(name, value):
        fd = os.open(directory / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o444)
        with os.fdopen(fd, "w") as stream:
            os.fchmod(stream.fileno(), 0o444)
            stream.write(value + "\n")
    for name in ("postgres_password", "jwt_signing_key", "internal_service_key", "admin_bootstrap_password"):
        write(name, secrets.token_urlsafe(48))
    for service in ("identity", "wallet", "market_catalog", "settlement", "branding"):
        password = secrets.token_urlsafe(48)
        write(service + "_password", password)
        if service == "settlement":
            connection = f"postgres://ravex_{service}:{password}@postgres:5432/ravex?sslmode=disable"
        else:
            connection = f"Host=postgres;Database=ravex;Username=ravex_{service};Password={password};Search Path={service}"
        write(service + "_connection", connection)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    generate(parser.parse_args().directory)
    print("Created private secret files. Back them up securely before starting the database.")
