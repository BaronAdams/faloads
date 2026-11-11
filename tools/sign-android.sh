#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts/android
apk_source=$(find src-tauri/gen/android/app/build/outputs/apk -name '*release*.apk' -print -quit)
test -n "$apk_source"
keystore_path="$RUNNER_TEMP/structcalc-signing.jks"
if [[ -n "${ANDROID_KEY_BASE64:-}" ]]; then
  : "${ANDROID_STORE_PASSWORD:?Missing ANDROID_STORE_PASSWORD}" "${ANDROID_KEY_ALIAS:?Missing ANDROID_KEY_ALIAS}" "${ANDROID_KEY_PASSWORD:?Missing ANDROID_KEY_PASSWORD}"
  printf '%s' "$ANDROID_KEY_BASE64" | base64 --decode > "$keystore_path"
  printf 'Signature avec le keystore configure dans les secrets GitHub.\n' > artifacts/android/SIGNATURE.txt
else
  export ANDROID_STORE_PASSWORD=android ANDROID_KEY_PASSWORD=android ANDROID_KEY_ALIAS=androiddebugkey
  keytool -genkeypair -keystore "$keystore_path" -storepass:env ANDROID_STORE_PASSWORD -keypass:env ANDROID_KEY_PASSWORD -alias "$ANDROID_KEY_ALIAS" -dname 'CN=StructCalc Development,O=StructCalc,C=FR' -keyalg RSA -keysize 2048 -validity 3650
  printf 'Signature de developpement temporaire. Ne pas utiliser pour une publication en boutique. La cle change entre les builds : configurez les secrets Android pour conserver une signature stable.\n' > artifacts/android/SIGNATURE.txt
fi
trap 'rm -f "$keystore_path"' EXIT
"$ANDROID_HOME/build-tools/36.0.0/zipalign" -f -p 4 "$apk_source" "$RUNNER_TEMP/structcalc-aligned.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign --ks "$keystore_path" --ks-key-alias "$ANDROID_KEY_ALIAS" --ks-pass env:ANDROID_STORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD --out artifacts/android/StructCalc-arm64.apk "$RUNNER_TEMP/structcalc-aligned.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose artifacts/android/StructCalc-arm64.apk
