package gg.auroras.client.mixin;

// Minecraft 26.2 and 26.3: screens moved to Gui (Gui#setScreen; Minecraft#setScreen is gone). The Auroras main menu and
// pause menu take the place of vanilla's TitleScreen and PauseScreen here (MenuHooks decides; switched off in Settings,
// vanilla's screen is used). Optional like every injection (defaultRequire 0): if the name ever differs, vanilla's menus stay.

import gg.auroras.client.MenuHooks;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.screens.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(Gui.class)
public abstract class ScreenSwapMixin {
    @ModifyVariable(method = "setScreen(Lnet/minecraft/client/gui/screens/Screen;)V", at = @At("HEAD"), argsOnly = true)
    private Screen auroras$menus(Screen screen) { return MenuHooks.replace(screen); }
}
