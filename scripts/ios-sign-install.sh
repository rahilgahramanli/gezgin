#!/usr/bin/env bash
# GEZGIN — imzalı IPA yığır və qoşulu iPhone-a quraşdırır.
#
# Şərt: Xcode-da Apple ID daxil olmalıdır (Xcode → Settings → Accounts).
# Pulsuz hesabla imza 7 gün işləyir; sonra skripti yenidən işlətmək lazımdır.
#
#   ./scripts/ios-sign-install.sh <TEAM_ID> [BUNDLE_ID]
#
# TEAM_ID-ni tapmaq: security find-identity -v -p codesigning | grep "Apple Development"

set -euo pipefail

TEAM="${1:?TEAM_ID lazımdır — məs: 88C74NTJYM}"
BUNDLE="${2:-app.gezgin}"
IOS_DIR="$(cd "$(dirname "$0")/../apps/mobile/ios" && pwd)"
ARCHIVE=/tmp/GezginApp-signed.xcarchive
EXPORT_DIR=/tmp/gezgin-ipa-export

echo "▸ Arxiv qurulur (komanda: $TEAM, bundle: $BUNDLE)…"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
xcodebuild -workspace "$IOS_DIR/GezginApp.xcworkspace" -scheme GezginApp \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" archive \
  -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM" PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE"

cat > /tmp/exportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>development</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>stripSwiftSymbols</key><true/>
  <key>compileBitcode</key><false/>
</dict></plist>
PLIST

echo "▸ IPA ixrac olunur…"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist /tmp/exportOptions.plist \
  -exportPath "$EXPORT_DIR" -allowProvisioningUpdates

IPA=$(find "$EXPORT_DIR" -name "*.ipa" | head -1)
cp "$IPA" ~/Desktop/GEZGIN-1.0-prod-signed.ipa
echo "▸ IPA hazırdır: ~/Desktop/GEZGIN-1.0-prod-signed.ipa"

# Cihaz adında boşluq ola bilər — cədvəli yox, JSON-u oxuyuruq
DEVICE=$(xcrun devicectl list devices --json-output /tmp/devices.json >/dev/null 2>&1 && python3 -c "
import json
d = json.load(open('/tmp/devices.json'))['result']['devices']
ok = [x for x in d if x.get('hardwareProperties', {}).get('platform') == 'iOS'
      and x.get('connectionProperties', {}).get('tunnelState') != 'unavailable']
print(ok[0]['identifier'] if ok else '')" 2>/dev/null)
if [ -n "${DEVICE:-}" ]; then
  echo "▸ Cihaza quraşdırılır ($DEVICE)…"
  xcrun devicectl device install app --device "$DEVICE" ~/Desktop/GEZGIN-1.0-prod-signed.ipa
  echo "▸ Bitdi. Telefonda: Settings → General → VPN & Device Management → bu Apple ID-yə etibar et."
else
  echo "▸ Cihaz görünmür — IPA hazırdır, əl ilə quraşdır."
fi
