#!/usr/bin/env python3
"""
build_validator.py
Verifica se o app está pronto para build de produção.
"""

import os
import json
import sys
from pathlib import Path


def check_package_json(root: Path) -> list[str]:
    issues = []
    pkg = root / "package.json"
    if not pkg.exists():
        issues.append("❌ package.json não encontrado")
        return issues
    data = json.loads(pkg.read_text())
    if not data.get("version"):
        issues.append("❌ Versão não definida no package.json")
    return issues


def check_ios_assets(root: Path) -> list[str]:
    issues = []
    ios = root / "ios"
    if not ios.exists():
        return ["⚠️  Diretório ios/ não encontrado (skip se não for iOS)"]
    # Verificar ícone
    icon_path = ios / "Shaikron" / "Images.xcassets" / "AppIcon.appiconset"
    if not icon_path.exists():
        issues.append("❌ AppIcon não encontrado em Images.xcassets")
    # Verificar Info.plist
    info_plist = ios / "Shaikron" / "Info.plist"
    if not info_plist.exists():
        issues.append("❌ Info.plist não encontrado")
    else:
        content = info_plist.read_text()
        if "NSPrivacyAccessedAPITypes" not in content and "NSCameraUsageDescription" not in content:
            issues.append("⚠️  Verificar se todas as permissões estão declaradas no Info.plist")
    return issues


def check_android_assets(root: Path) -> list[str]:
    issues = []
    android = root / "android" / "app" / "src" / "main"
    if not android.exists():
        return ["⚠️  Diretório android/ não encontrado (skip se não for Android)"]
    # Verificar ícone
    mipmap = android / "res" / "mipmap-xxxhdpi"
    if not mipmap.exists():
        issues.append("❌ Ícone mipmap-xxxhdpi não encontrado")
    # Verificar manifest
    manifest = android / "AndroidManifest.xml"
    if not manifest.exists():
        issues.append("❌ AndroidManifest.xml não encontrado")
    return issues


def check_env(root: Path) -> list[str]:
    issues = []
    env = root / ".env"
    env_example = root / ".env.example"
    if not env.exists() and not env_example.exists():
        issues.append("⚠️  .env não encontrado — verificar variáveis de ambiente")
    gitignore = root / ".gitignore"
    if gitignore.exists():
        content = gitignore.read_text()
        if "*.jks" not in content:
            issues.append("❌ *.jks não está no .gitignore — keystore pode vazar!")
        if ".env" not in content:
            issues.append("❌ .env não está no .gitignore")
    return issues


def run_validation(root_path: str = ".") -> None:
    root = Path(root_path).resolve()
    print(f"\n🔍 Validando build em: {root}\n")

    all_issues = []
    all_issues += check_package_json(root)
    all_issues += check_ios_assets(root)
    all_issues += check_android_assets(root)
    all_issues += check_env(root)

    errors = [i for i in all_issues if i.startswith("❌")]
    warnings = [i for i in all_issues if i.startswith("⚠️")]

    if warnings:
        print("⚠️  Avisos:")
        for w in warnings:
            print(f"   {w}")

    if errors:
        print("\n❌ Erros bloqueantes:")
        for e in errors:
            print(f"   {e}")
        print("\n🚫 App NÃO está pronto para build. Corrija os erros acima.\n")
        sys.exit(1)
    else:
        print("✅ App validado — pronto para build de produção!\n")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "."
    run_validation(path)
