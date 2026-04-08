#!/usr/bin/env python3
"""
android_keystore_gen.py
Guia interativo para geração e validação de keystore Android.
"""

import subprocess
import sys
import os
from pathlib import Path


def generate_keystore(app_name: str, package_name: str, output_dir: str = ".") -> None:
    alias = f"{app_name.lower()}-key"
    filename = f"{app_name.lower()}-release.jks"
    output_path = Path(output_dir) / filename

    print(f"\n🔑 Gerando keystore para: {app_name}")
    print(f"   Arquivo: {output_path}")
    print(f"   Alias: {alias}\n")

    store_pass = input("Senha da keystore (store password): ").strip()
    key_pass = input("Senha da chave (key password): ").strip()
    org = input("Organização (ex: Scheffelt AI): ").strip() or "Scheffelt AI"
    country = input("País (ex: BR): ").strip() or "BR"

    cmd = [
        "keytool", "-genkey", "-v",
        "-keystore", str(output_path),
        "-alias", alias,
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "10000",
        "-storepass", store_pass,
        "-keypass", key_pass,
        "-dname", f"CN={app_name}, OU=Mobile, O={org}, L=Brasil, ST={country}, C={country}",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"\n✅ Keystore gerada: {output_path}")
            print("\n⚠️  IMPORTANTE — Guarde em local seguro:")
            print(f"   Arquivo: {output_path}")
            print(f"   Alias: {alias}")
            print(f"   Store password: [a que você digitou]")
            print(f"   Key password: [a que você digitou]")
            print("\n🔒 Adicione ao .gitignore:")
            print(f"   *.jks")
            print(f"   *.keystore")
            print("\n📋 Para GitHub Actions (secrets necessários):")
            print(f"   ANDROID_KEYSTORE_BASE64 = base64 de {filename}")
            print(f"   ANDROID_KEY_ALIAS = {alias}")
            print(f"   ANDROID_STORE_PASSWORD = [store password]")
            print(f"   ANDROID_KEY_PASSWORD = [key password]")

            # Gerar base64
            try:
                b64 = subprocess.run(
                    ["base64", "-w", "0", str(output_path)],
                    capture_output=True, text=True
                )
                if b64.returncode == 0:
                    b64_file = output_path.with_suffix(".jks.b64")
                    b64_file.write_text(b64.stdout)
                    print(f"\n   Base64 salvo em: {b64_file}")
            except FileNotFoundError:
                print("\n   Para gerar base64 manualmente:")
                print(f"   base64 -w 0 {filename} > {filename}.b64")
        else:
            print(f"\n❌ Erro ao gerar keystore:")
            print(result.stderr)
            sys.exit(1)
    except FileNotFoundError:
        print("\n❌ keytool não encontrado. Instale o JDK:")
        print("   https://adoptium.net/")
        sys.exit(1)


def validate_keystore(keystore_path: str, alias: str) -> None:
    print(f"\n🔍 Validando keystore: {keystore_path}\n")
    store_pass = input("Senha da keystore: ").strip()

    cmd = [
        "keytool", "-list", "-v",
        "-keystore", keystore_path,
        "-alias", alias,
        "-storepass", store_pass,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Keystore válida!\n")
            print(result.stdout)
        else:
            print("❌ Keystore inválida ou senha incorreta:")
            print(result.stderr)
    except FileNotFoundError:
        print("❌ keytool não encontrado.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso:")
        print("  python android_keystore_gen.py generate <app_name> <package_name>")
        print("  python android_keystore_gen.py validate <keystore_path> <alias>")
        sys.exit(1)

    action = sys.argv[1]
    if action == "generate":
        app = sys.argv[2] if len(sys.argv) > 2 else "Shaikron"
        pkg = sys.argv[3] if len(sys.argv) > 3 else "com.scheffelt.shaikron"
        generate_keystore(app, pkg)
    elif action == "validate":
        path = sys.argv[2] if len(sys.argv) > 2 else "shaikron-release.jks"
        alias = sys.argv[3] if len(sys.argv) > 3 else "shaikron-key"
        validate_keystore(path, alias)
