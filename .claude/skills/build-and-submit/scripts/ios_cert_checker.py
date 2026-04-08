#!/usr/bin/env python3
"""
ios_cert_checker.py
Valida certificados e provisioning profiles iOS para build de produção.
"""

import subprocess
import sys
import json
from datetime import datetime
from pathlib import Path


def check_certificate(p12_path: str) -> None:
    print(f"\n🔍 Verificando certificado: {p12_path}\n")
    password = input("Senha do .p12: ").strip()

    cmd = [
        "openssl", "pkcs12",
        "-in", p12_path,
        "-nokeys",
        "-passin", f"pass:{password}",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Certificado válido!")
            # Extrair validade
            date_cmd = [
                "openssl", "pkcs12",
                "-in", p12_path,
                "-nokeys",
                "-passin", f"pass:{password}",
            ]
            date_result = subprocess.run(date_cmd, capture_output=True, text=True)
            if "Not After" in date_result.stdout:
                for line in date_result.stdout.split("\n"):
                    if "Not After" in line:
                        print(f"   Validade: {line.strip()}")
        else:
            print("❌ Certificado inválido ou senha incorreta")
            print(result.stderr)
    except FileNotFoundError:
        print("❌ openssl não encontrado. Instale via Homebrew: brew install openssl")


def check_keychain_certs() -> None:
    """Lista certificados de distribuição instalados no Keychain (Mac only)."""
    print("\n🔍 Certificados de distribuição no Keychain:\n")

    cmd = [
        "security", "find-identity", "-v",
        "-p", "codesigning"
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            dist_certs = [l for l in lines if "Apple Distribution" in l or "iPhone Distribution" in l]
            if dist_certs:
                print("✅ Certificados de distribuição encontrados:")
                for cert in dist_certs:
                    print(f"   {cert.strip()}")
            else:
                print("⚠️  Nenhum certificado de distribuição encontrado no Keychain")
                print("   Importe o .p12 via: security import cert.p12 -k ~/Library/Keychains/login.keychain")
        else:
            print(f"❌ Erro: {result.stderr}")
    except FileNotFoundError:
        print("⚠️  Comando 'security' não disponível (requer macOS)")


def check_provisioning_profile(profile_path: str) -> None:
    print(f"\n🔍 Verificando provisioning profile: {profile_path}\n")

    cmd = [
        "security", "cms", "-D",
        "-i", profile_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            content = result.stdout
            # Extrair campos relevantes
            checks = {
                "Nome": "Name",
                "Bundle ID": "application-identifier",
                "Tipo": "get-task-allow",
                "Expiração": "ExpirationDate",
            }
            print("✅ Provisioning Profile válido!")
            if "ProvisionsAllDevices" in content:
                print("   Tipo: Enterprise (distribui para todos os devices)")
            elif '"get-task-allow"' in content and "false" in content:
                print("   Tipo: App Store Distribution ✅")
            else:
                print("   Tipo: Development (não usar para App Store)")

            if "ExpirationDate" in content:
                for line in content.split("\n"):
                    if "ExpirationDate" in line:
                        print(f"   {line.strip()}")
        else:
            print("❌ Erro ao ler provisioning profile:")
            print(result.stderr)
    except FileNotFoundError:
        print("⚠️  Comando 'security' não disponível (requer macOS)")


def run_full_check() -> None:
    print("\n📋 Verificação completa de certificados iOS\n")
    print("1. Verificar .p12")
    print("2. Listar certificados no Keychain")
    print("3. Verificar Provisioning Profile")
    print("4. Tudo acima")

    choice = input("\nEscolha: ").strip()

    if choice in ["1", "4"]:
        p12 = input("Caminho do .p12: ").strip()
        if Path(p12).exists():
            check_certificate(p12)
        else:
            print(f"❌ Arquivo não encontrado: {p12}")

    if choice in ["2", "4"]:
        check_keychain_certs()

    if choice in ["3", "4"]:
        profile = input("Caminho do .mobileprovision: ").strip()
        if Path(profile).exists():
            check_provisioning_profile(profile)
        else:
            print(f"❌ Arquivo não encontrado: {profile}")


if __name__ == "__main__":
    run_full_check()
