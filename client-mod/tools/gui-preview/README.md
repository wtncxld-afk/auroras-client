# In-game GUI preview

Renders the real `ModuleScreen.java` and `AUi.java` (compiled against the stand-ins in `stubs/`) to PNGs, so the in-game
menus can be checked without Minecraft. The font is a stand-in with Minecraft's character widths, not the game's own.

Run from this folder (`O` is any empty scratch folder):

```
O=/tmp/guiprev; M=../../adapters/mojmap
javac -d $O/core $(find ../../core/src/main/java -name '*.java')
javac -d $O/gui -cp $O/core $(find stubs -name '*.java') $M/common/java/gg/auroras/client/ModuleScreen.java $M/common/java/gg/auroras/client/ui/AUi.java GuiPreview.java
mkdir -p $O/res/assets/auroras_client/textures/gui
cp ../../../visuals/design-tokens.json $O/res/assets/auroras_client/
cp $M/common/resources/assets/auroras_client/textures/gui/logo.png $O/res/assets/auroras_client/textures/gui/
java -cp $O/core:$O/gui:$O/res gg.auroras.client.GuiPreview background.png outDir [width height guiScale]
```

The Right Shift radial menu has its own previewer in core: `AURORAS_BG=background.png AURORAS_LOGO=<logo.png>
AURORAS_SKIN=<64x64 skin> java -cp out gg.auroras.core.RadialPreview ../../visuals out.png 1920 1080 5 1`.
