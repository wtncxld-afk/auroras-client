package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// CPS counting (mouse presses with no screen open), scroll-to-zoom, and mouse look for freelook and zoom sensitivity.

import gg.auroras.client.platform.Mc;
import com.mojang.blaze3d.platform.InputConstants;
import gg.auroras.client.AurorasModules;
import gg.auroras.client.HudRendererAccess;
import net.minecraft.client.Minecraft;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.input.MouseButtonInfo;
import net.minecraft.client.player.LocalPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public abstract class MouseHandlerMixin {
    @Unique private final double[] auroras$out = new double[2];

    @Inject(method = "onButton(JLnet/minecraft/client/input/MouseButtonInfo;I)V", at = @At("HEAD"))
    private void auroras$click(long window, MouseButtonInfo info, int action, CallbackInfo ci) {
        Minecraft mc = Minecraft.getInstance();
        if (action == InputConstants.PRESS && Mc.screen(mc) == null && mc.isWindowActive()) HudRendererAccess.click(info.button());
    }
    @Inject(method = "onScroll(JDD)V", at = @At("HEAD"), cancellable = true)
    private void auroras$scroll(long window, double horizontal, double vertical, CallbackInfo ci) {
        if (Mc.screen(Minecraft.getInstance()) == null && AurorasModules.scroll(vertical)) ci.cancel();
    }
    @Redirect(method = "turnPlayer", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;turn(DD)V"))
    private void auroras$look(LocalPlayer player, double dx, double dy) {
        if (AurorasModules.look(dx, dy, auroras$out)) return; // freelook turned the camera instead
        player.turn(auroras$out[0], auroras$out[1]);
    }
}
