# iOS Build — Apple App Store

## Pré-requisitos
- Conta Apple Developer Program ($99/ano)
- Mac com Xcode instalado (ou usar EAS Build / Fastlane em CI)
- Bundle ID registrado no Apple Developer Portal

---

## 1. Configurar Bundle ID
1. Acesse [developer.apple.com](https://developer.apple.com) → Certificates, IDs & Profiles
2. Identifiers → App IDs → Register New Identifier
3. Bundle ID: `com.scheffelt.shaikron` (Explicit)
4. Habilitar capabilities necessárias (Push Notifications, Sign in with Apple, etc.)

## 2. Criar Certificado de Distribuição
```bash
# Gerar Certificate Signing Request (CSR) via Keychain Access no Mac
# Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority
# Save to disk

# No Apple Developer Portal:
# Certificates → + → Apple Distribution → Upload CSR → Download .cer
# Double-click para instalar no Keychain

# Exportar como .p12 (necessário para CI/CD):
# Keychain Access → My Certificates → clicar com botão direito → Export
# Formato: .p12 — guarda a senha em local seguro
```

## 3. Criar Provisioning Profile
1. Apple Developer Portal → Profiles → + → App Store Connect
2. Selecionar App ID (Bundle ID do app)
3. Selecionar certificado de distribuição
4. Download do `.mobileprovision`

## 4. Build com Xcode
```bash
# Limpar build anterior
xcodebuild clean -workspace ios/Shaikron.xcworkspace -scheme Shaikron

# Arquivar para distribuição
xcodebuild archive \
  -workspace ios/Shaikron.xcworkspace \
  -scheme Shaikron \
  -configuration Release \
  -archivePath ./build/Shaikron.xcarchive \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="Shaikron App Store"

# Exportar .ipa
xcodebuild -exportArchive \
  -archivePath ./build/Shaikron.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath ./build/output
```

## 5. Build com Expo / EAS (recomendado para React Native)
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar projeto
eas build:configure

# Build para App Store
eas build --platform ios --profile production

# Submit direto para TestFlight
eas submit --platform ios
```

## 6. Upload para TestFlight
```bash
# Via Transporter (app da Apple) — arrastar o .ipa
# Via xcrun altool (linha de comando):
xcrun altool --upload-app \
  --type ios \
  --file ./build/output/Shaikron.ipa \
  --username "your@apple.id" \
  --password "@keychain:AC_PASSWORD"

# Via EAS:
eas submit --platform ios --latest
```

## 7. Submit para App Store Review
1. App Store Connect → My Apps → Shaikron
2. + Version → informar versão
3. Preencher: screenshots, descrição, keywords, categoria
4. Selecionar build do TestFlight
5. Submit for Review

---

## Assets Obrigatórios (iOS)

| Asset | Tamanho | Formato |
|-------|---------|---------|
| App Icon | 1024x1024px | PNG, sem transparência |
| iPhone Screenshots | 1290x2796px (6.7") | PNG/JPG |
| iPad Screenshots | 2048x2732px | PNG/JPG (se suportar iPad) |
| Splash Screen | 1242x2688px | PNG |

## Motivos Comuns de Rejeição Apple
- Missing Privacy Policy URL
- Crash na revisão (testar em device físico)
- Login com Apple ausente (obrigatório se tiver outro social login)
- Informações de demo de login não fornecidas
- Screenshots não refletem a UI real do app
