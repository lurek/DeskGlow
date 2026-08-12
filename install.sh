#!/bin/bash

UUID="deskglow@zorin-extension"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
USER_SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"

echo "=== Installing DeskGlow Extension for GNOME / Zorin OS ==="

# 1. Compile GSettings Schemas locally and in user glib-2.0 directory
echo "[1/4] Compiling GSettings schema..."
glib-compile-schemas schemas/
mkdir -p "$USER_SCHEMA_DIR"
cp schemas/org.gnome.shell.extensions.deskglow.gschema.xml "$USER_SCHEMA_DIR/"
glib-compile-schemas "$USER_SCHEMA_DIR"

# 2. Create destination extension directory
echo "[2/4] Preparing extension directory at $EXT_DIR..."
mkdir -p "$EXT_DIR"

# 3. Copy extension bundle
echo "[3/4] Copying extension bundle..."
cp -r metadata.json extension.js sysinfo.js stylesheet.css prefs.js schemas icons "$EXT_DIR/"

# 4. Enable extension in GNOME Shell
echo "[4/4] Enabling extension ($UUID)..."
python3 -c "
import subprocess, ast
res = subprocess.check_output(['gsettings', 'get', 'org.gnome.shell', 'enabled-extensions']).decode().strip()
exts = ast.literal_eval(res)
if '$UUID' not in exts:
    exts.append('$UUID')
    subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str(exts)])
" 2>/dev/null

echo "=== Installation Completed Successfully! ==="
echo "Widget installed and enabled."
