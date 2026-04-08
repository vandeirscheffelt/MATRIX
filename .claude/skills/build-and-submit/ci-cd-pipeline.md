# CI/CD Pipeline — GitHub Actions para iOS e Android

## Secrets Necessários no GitHub

### iOS
| Secret | Valor |
|--------|-------|
| `IOS_P12_BASE64` | Certificado .p12 em base64 |
| `IOS_P12_PASSWORD` | Senha do .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | .mobileprovision em base64 |
| `APPLE_ID` | Email da conta Apple Developer |
| `APP_STORE_CONNECT_API_KEY_ID` | ID da chave API do App Store Connect |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Chave .p8 em base64 |

### Android
| Secret | Valor |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | keystore.jks em base64 |
| `ANDROID_KEY_ALIAS` | Alias da chave |
| `ANDROID_STORE_PASSWORD` | Senha da store |
| `ANDROID_KEY_PASSWORD` | Senha da chave |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | JSON da service account |

### Gerar base64 de arquivos
```bash
base64 -i shaikron-release.jks | pbcopy       # Mac
base64 -w 0 shaikron-release.jks | xclip      # Linux
[Convert]::ToBase64String([IO.File]::ReadAllBytes("shaikron-release.jks")) | clip  # Windows
```

---

## Templates de Workflow

Veja os workflows prontos:
- [templates/github-actions-ios.yml](templates/github-actions-ios.yml)
- [templates/github-actions-android.yml](templates/github-actions-android.yml)

---

## Estratégia de Versionamento

```bash
# Versão semântica via tags git
git tag v1.0.0
git push origin v1.0.0
# → Dispara build automático de produção

# Build de beta via push para branch release/*
git push origin release/1.1.0
# → Dispara build para TestFlight / Internal Track
```

## Boas Práticas
- Nunca commitar keystores ou .p12 no repositório
- Usar GitHub Environments para separar staging/production
- Cachear `node_modules`, Pods e Gradle para builds rápidos (~50% mais rápido)
- Notificar Slack/Discord ao finalizar build
