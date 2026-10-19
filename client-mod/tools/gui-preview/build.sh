#!/bin/sh
# Compiles the real ModuleScreen.java and AUi.java against the preview stand-ins and renders the in-game GUI to PNGs.
# Usage: sh build.sh background.png outDir
set -e; H=$(cd "$(dirname "$0")" && pwd); M=$H/../../adapters/mojmap; C=$H/../../core; O=$(mktemp -d)
javac -d $O/core $(find $C/src/main/java -name '*.java')
javac -d $O/gui -cp $O/core $(find $H/stubs -name '*.java') $M/common/java/gg/auroras/client/ModuleScreen.java $M/common/java/gg/auroras/client/ui/AUi.java $H/GuiPreview.java
mkdir -p $O/res/assets/auroras_client/textures/gui && cp $H/../../../visuals/design-tokens.json $O/res/assets/auroras_client/ && cp $M/common/resources/assets/auroras_client/textures/gui/logo.png $O/res/assets/auroras_client/textures/gui/
java -cp $O/core:$O/gui:$O/res gg.auroras.client.GuiPreview "$1" "$2" ${3:-1920} ${4:-1080} ${5:-3}
