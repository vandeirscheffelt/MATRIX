---
name: build-and-submit
description: Super skill para build, assinatura e envio de apps mobile para Apple App Store e Google Play Store — inclui CI/CD, certificados, keystores e checklist pré-submit
---

# Build & Submit — App Store / Google Play

Skill completa para empacotar, assinar e publicar apps mobile (React Native, Expo, Flutter) nas duas plataformas. Cobre desde a configuração inicial de certificados até o CI/CD automatizado via GitHub Actions.

---

## Capacidades

### iOS — Apple App Store
- Configuração de Bundle ID no Apple Developer Portal
- Geração e gestão de certificados de distribuição (`.p12`)
- Provisioning Profiles (App Store Distribution)
- Build via Xcode / EAS Build (Expo) / Fastlane
- Upload para TestFlight (beta interno e externo)
- Submit para revisão da App Store
- Tratamento de rejeições mais comuns

### Android — Google Play Store
- Geração e gestão de Keystore (`.jks`)
- Build de AAB (Android App Bundle) — formato exigido pela Google Play
- Assinatura do bundle com a keystore
- Upload para Google Play Console (Internal / Closed / Open / Production)
- Gerenciamento de tracks e rollout gradual
- Tratamento de políticas da Play Store

### CI/CD — GitHub Actions
- Pipeline automático de build para iOS e Android
- Secrets necessários (certificados, passwords, tokens)
- Trigger por tag (ex: `v1.0.0`) ou push para `main`
- Notificação de sucesso/falha
- Cache de dependências para builds rápidos

### Checklist Pré-Submit
- Validação de versão e build number
- Assets obrigatórios (ícones, splash screens, screenshots)
- Permissões declaradas no manifest/Info.plist
- Privacy Policy URL
- Conformidade com diretrizes Apple e Google
- Testes em devices reais antes do submit

---

## Inputs Necessários

### iOS
```json
{
  "app_name": "Shaikron",
  "bundle_id": "com.scheffelt.shaikron",
  "apple_id": "your@email.com",
  "team_id": "XXXXXXXXXX",
  "scheme": "Shaikron",
  "export_method": "app-store",
  "framework": "react-native" | "expo" | "flutter"
}
```

### Android
```json
{
  "app_name": "Shaikron",
  "package_name": "com.scheffelt.shaikron",
  "keystore_alias": "shaikron-key",
  "build_type": "release",
  "track": "internal" | "alpha" | "beta" | "production",
  "framework": "react-native" | "expo" | "flutter"
}
```

---

## Outputs

- Arquivo `.ipa` assinado (iOS)
- Arquivo `.aab` assinado (Android)
- GitHub Actions workflow configurado
- Checklist de pré-submit preenchido
- Relatório de build com logs e status

---

## Referências por Plataforma

- [ios-build.md](ios-build.md) — Passo a passo completo iOS
- [android-build.md](android-build.md) — Passo a passo completo Android
- [ci-cd-pipeline.md](ci-cd-pipeline.md) — CI/CD com GitHub Actions

## Scripts

- `scripts/ios_cert_checker.py` — Valida certificados e provisioning profiles
- `scripts/android_keystore_gen.py` — Gera e valida keystores
- `scripts/build_validator.py` — Verifica se o app está pronto para build
- `scripts/submit_checklist.py` — Checklist pré-submit para cada plataforma

## Templates

- `templates/github-actions-ios.yml` — Workflow de build iOS
- `templates/github-actions-android.yml` — Workflow de build Android

---

## Como Usar

```
Hey Claude — use a skill build-and-submit para configurar o pipeline de build
do Shaikron (React Native / Expo) para iOS e Android com GitHub Actions.
```

```
Hey Claude — use a skill build-and-submit para gerar a keystore do Android
e configurar os secrets no GitHub para o repositório do Shaikron.
```

```
Hey Claude — use a skill build-and-submit para rodar o checklist pré-submit
antes de enviar o Shaikron para revisão da Apple App Store.
```

---

## Integração com Outras Skills

- **`app-builder`** — define o framework (React Native, Flutter, Expo)
- **`mobile-design`** — fornece assets (ícones, splash screens) nos tamanhos corretos
- **`app-store-optimization`** — fornece metadata e screenshots para o submit
- **`senior-devops`** — reforça boas práticas de CI/CD
- **`docker-expert`** — containers de build para ambientes reproduzíveis
