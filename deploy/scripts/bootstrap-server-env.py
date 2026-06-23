#!/usr/bin/env python3
"""生成 /opt/nest-admin/.env（服务器执行，勿提交输出）。"""
import pathlib
import secrets
import subprocess

ENV_PATH = pathlib.Path("/opt/nest-admin/.env")
REGISTRY = "ghcr.io/hqh-dot-wj/o2o-mall-project"
HOST_IP = "8.136.218.38"


def rand(n: int = 32) -> str:
    return secrets.token_urlsafe(n)[:n]


def rsa_pair() -> tuple[str, str]:
    subprocess.run(["openssl", "genrsa", "-out", "/tmp/p.pem", "2048"], check=True)
    pub = subprocess.check_output(
        ["openssl", "rsa", "-in", "/tmp/p.pem", "-pubout"], text=True
    )
    pub_b64 = "".join(l for l in pub.splitlines() if not l.startswith("---"))
    priv = pathlib.Path("/tmp/p.pem").read_text().strip()
    pathlib.Path("/tmp/p.pem").unlink(missing_ok=True)
    return pub_b64, priv


def main() -> None:
    pub, priv = rsa_pair()
    content = f"""REGISTRY_NAMESPACE={REGISTRY}
IMAGE_TAG=latest
POSTGRES_USER=postgres
POSTGRES_PASSWORD={rand(40)}
POSTGRES_DB=nest-admin-soybean
REDIS_PASSWORD={rand(40)}
REDIS_DB=2
APP_PORT=8080
APP_PREFIX=/api
JWT_SECRET={rand(48)}
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
TENANT_ENABLED=true
TENANT_SUPER_ID=000000
TENANT_DEFAULT_ID=000000
CRYPTO_ENABLED=true
CRYPTO_RSA_PUBLIC_KEY={pub}
FILE_IS_LOCAL=true
FILE_UPLOAD_LOCATION=upload
FILE_DOMAIN=http://{HOST_IP}
FILE_SERVE_ROOT=/profile
MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY={rand(48)}
HTTP_PORT=80
COMPOSE_NETWORK_NAME=nest_admin_net
CRYPTO_RSA_PRIVATE_KEY="{priv}"
"""
    ENV_PATH.write_text(content)
    ENV_PATH.chmod(0o600)
    print("ENV_WRITTEN", ENV_PATH)


if __name__ == "__main__":
    main()
