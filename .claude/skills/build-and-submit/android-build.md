# Android Build — Google Play Store

## Pré-requisitos
- Conta Google Play Developer ($25 — taxa única)
- JDK instalado (para geração de keystore)
- Android SDK / Android Studio

---

## 1. Gerar Keystore

> ⚠️ A keystore é PERMANENTE — guarde em local seguro. Perder a keystore = impossível atualizar o app.

```bash
keytool -genkey -v \
  -keystore shaikron-release.jks \
  -alias shaikron-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass SUA_SENHA_STORE \
  -keypass SUA_SENHA_KEY \
  -dname "CN=Scheffelt AI, OU=Mobile, O=Scheffelt, L=Brasil, ST=BR, C=BR"
```

```bash
# Verificar keystore gerada
keytool -list -v -keystore shaikron-release.jks -alias shaikron-key
```

## 2. Configurar Signing no React Native

```javascript
// android/gradle.properties (NÃO commitar — adicionar ao .gitignore)
SHAIKRON_UPLOAD_STORE_FILE=shaikron-release.jks
SHAIKRON_UPLOAD_KEY_ALIAS=shaikron-key
SHAIKRON_UPLOAD_STORE_PASSWORD=SUA_SENHA_STORE
SHAIKRON_UPLOAD_KEY_PASSWORD=SUA_SENHA_KEY
```

```groovy
// android/app/build.gradle
android {
  signingConfigs {
    release {
      storeFile file(SHAIKRON_UPLOAD_STORE_FILE)
      storePassword SHAIKRON_UPLOAD_STORE_PASSWORD
      keyAlias SHAIKRON_UPLOAD_KEY_ALIAS
      keyPassword SHAIKRON_UPLOAD_KEY_PASSWORD
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
  }
}
```

## 3. Build AAB (Android App Bundle)

```bash
# React Native
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab

# Expo / EAS
eas build --platform android --profile production

# Flutter
flutter build appbundle --release
```

## 4. Verificar AAB Gerado

```bash
# Instalar bundletool
# https://github.com/google/bundletool/releases

# Validar o bundle
java -jar bundletool.jar validate --bundle=app-release.aab

# Testar localmente (gera APKs para device conectado)
java -jar bundletool.jar build-apks \
  --bundle=app-release.aab \
  --output=shaikron.apks \
  --ks=shaikron-release.jks \
  --ks-pass=pass:SUA_SENHA_STORE \
  --ks-key-alias=shaikron-key \
  --key-pass=pass:SUA_SENHA_KEY

java -jar bundletool.jar install-apks --apks=shaikron.apks
```

## 5. Upload para Google Play Console

```bash
# Via EAS (recomendado):
eas submit --platform android --latest

# Manual:
# Google Play Console → Shaikron → Release → Internal Testing → Create new release
# Upload app-release.aab
# Preencher release notes
# Review and roll out
```

## 6. Tracks de Distribuição

| Track | Descrição |
|-------|-----------|
| Internal | Até 100 testadores internos — publicação imediata |
| Closed (Alpha) | Grupos específicos de testadores |
| Open (Beta) | Qualquer pessoa pode entrar |
| Production | 100% dos usuários (ou rollout gradual %) |

## Rollout Gradual
```
Production → Edit release → % of users
Recomendado: 10% → 25% → 50% → 100%
Monitorar crash rate antes de expandir
```

---

## Assets Obrigatórios (Android)

| Asset | Tamanho | Formato |
|-------|---------|---------|
| App Icon | 512x512px | PNG, 32-bit |
| Feature Graphic | 1024x500px | JPG/PNG |
| Screenshots | Mínimo 2 — 320px a 3840px | JPG/PNG |
| Short Description | Até 80 caracteres | Texto |
| Full Description | Até 4000 caracteres | Texto |

## Políticas Comuns de Rejeição Google
- Privacy Policy ausente ou inválida
- Permissões desnecessárias declaradas
- Conteúdo de dados de usuário sem transparência
- Target SDK desatualizado (exige API level atual -1 no máximo)
- App crashes detectados no Pre-Launch Report
