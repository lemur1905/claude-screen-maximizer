#!/usr/bin/env bash
# Pulls popup.html, popup.js, and service_worker.js from the shared
# chrome-maximizer-ui-kit repo, substitutes the placeholders defined in
# ui.config.json, and writes the result into this extension. Run after
# editing the kit (or after editing ui.config.json) to regenerate.
#
# Override the kit location with UI_KIT_PATH=/path/to/kit ./sync-ui.sh
set -euo pipefail

KIT_PATH="${UI_KIT_PATH:-../chrome-maximizer-ui-kit}"
CONFIG_FILE="ui.config.json"

[[ -d "$KIT_PATH" ]] || { echo "Error: UI kit not found at $KIT_PATH" >&2; exit 1; }
[[ -f "$CONFIG_FILE" ]] || { echo "Error: $CONFIG_FILE not found in $(pwd)" >&2; exit 1; }

read_config() {
  python3 -c "import json,sys; print(json.load(open('$CONFIG_FILE'))['$1'])"
}

TITLE=$(read_config title)
LETTER=$(read_config letter)
COLOR_ON=$(read_config colorOn)

for file in popup.html popup.js service_worker.js; do
  src="$KIT_PATH/$file"
  [[ -f "$src" ]] || { echo "Error: missing $src" >&2; exit 1; }
  sed \
    -e "s|{{TITLE}}|$TITLE|g" \
    -e "s|{{LETTER}}|$LETTER|g" \
    -e "s|{{COLOR_ON}}|$COLOR_ON|g" \
    "$src" > "$file"
  echo "Wrote $file"
done

echo "Done."
