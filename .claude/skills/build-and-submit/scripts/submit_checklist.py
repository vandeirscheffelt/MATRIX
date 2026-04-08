#!/usr/bin/env python3
"""
submit_checklist.py
Gera checklist interativo pré-submit para Apple App Store e Google Play Store.
"""

import sys


CHECKLIST_IOS = [
    ("Conta Apple Developer ativa ($99/ano)", True),
    ("Bundle ID registrado no Apple Developer Portal", True),
    ("Certificado de distribuição válido (.p12)", True),
    ("Provisioning Profile App Store criado e baixado", True),
    ("Build number incrementado (não pode repetir)", True),
    ("Versão semântica atualizada no Info.plist", True),
    ("App testado em device físico (não só simulador)", True),
    ("App testado nas versões mínima e máxima de iOS suportadas", True),
    ("Ícone 1024x1024px sem transparência", True),
    ("Screenshots em todos os tamanhos exigidos (6.7\", 6.5\", 5.5\")", True),
    ("Privacy Policy URL configurada no App Store Connect", True),
    ("Informações de login de demo fornecidas (se app exigir login)", True),
    ("Sign in with Apple implementado (se tiver outros social logins)", True),
    ("Descrição e keywords preenchidas", True),
    ("Categoria selecionada", True),
    ("Rating de conteúdo preenchido", True),
    ("Preço e disponibilidade configurados", True),
    ("TestFlight beta testado e aprovado pela equipe", False),
]

CHECKLIST_ANDROID = [
    ("Conta Google Play Developer ativa ($25 — taxa única)", True),
    ("Package name correto e único (com.scheffelt.shaikron)", True),
    ("Keystore salva em local seguro (fora do repositório)", True),
    ("Build AAB gerado (não APK) — obrigatório desde 2021", True),
    ("Version code incrementado (inteiro, não pode repetir)", True),
    ("Version name atualizado", True),
    ("App testado em device físico Android", True),
    ("Target SDK atualizado (Google exige API level atual -1 no máximo)", True),
    ("Ícone 512x512px", True),
    ("Feature Graphic 1024x500px", True),
    ("Screenshots (mínimo 2, máximo 8)", True),
    ("Privacy Policy URL configurada", True),
    ("Permissões desnecessárias removidas do manifest", True),
    ("Descrição curta (80 chars) e completa (4000 chars) preenchidas", True),
    ("Categoria selecionada", True),
    ("Content rating preenchido", True),
    ("Preço e países de distribuição configurados", True),
    ("Pre-Launch Report do Google Play sem crashes críticos", False),
    ("Internal testing track validado pela equipe", False),
]


def run_checklist(platform: str) -> None:
    if platform == "ios":
        items = CHECKLIST_IOS
        title = "Apple App Store"
    elif platform == "android":
        items = CHECKLIST_ANDROID
        title = "Google Play Store"
    else:
        print("Uso: python submit_checklist.py [ios|android|all]")
        sys.exit(1)

    print(f"\n📋 Checklist Pré-Submit — {title}\n")
    print("Responda s (sim) ou n (não) para cada item:\n")

    passed = 0
    failed = 0
    skipped = 0

    for item, required in items:
        marker = "🔴" if required else "🟡"
        resp = input(f"{marker} {item}? [s/n]: ").strip().lower()
        if resp == "s":
            print(f"   ✅ OK\n")
            passed += 1
        else:
            status = "BLOQUEANTE" if required else "recomendado"
            print(f"   {'❌' if required else '⚠️ '} Pendente ({status})\n")
            if required:
                failed += 1
            else:
                skipped += 1

    print("─" * 50)
    print(f"✅ Aprovados:  {passed}")
    print(f"❌ Pendentes bloqueantes: {failed}")
    print(f"⚠️  Pendentes recomendados: {skipped}")

    if failed == 0:
        print(f"\n🚀 App pronto para submit na {title}!\n")
    else:
        print(f"\n🚫 Resolva os {failed} item(ns) bloqueante(s) antes de submeter.\n")


if __name__ == "__main__":
    platform = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if platform == "all":
        run_checklist("ios")
        run_checklist("android")
    else:
        run_checklist(platform)
