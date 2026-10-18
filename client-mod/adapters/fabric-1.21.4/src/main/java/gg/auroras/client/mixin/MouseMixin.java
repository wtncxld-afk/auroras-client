package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Counts mouse presses for the CPS counter. It only observes the event (inject at
// HEAD, never cancels), so normal mouse input is untouched. Clicks while a screen is open or the window is unfocused
// don't count. Target: net.minecraft.client.Mouse#onMouseButton(long window, int button, int action, int mods).
// Also: freelook and zoom sensitivity (the player's changeLookDirection call in Mouse#updateMouse), and scroll-to-zoom
// (Mouse#onMouseScroll, cancelled only while zooming with that setting on, so the hotbar doesn't change).

import gg.auroras.client.HudRendererAccess;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import gg.auroras.client.AurorasModules;
import net.minecraft.client.network.ClientPlayerEntity;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public abstract class MouseMixin {
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void auroras$countClick(long window, int button, int action, int mods, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (action != GLFW.GLFW_PRESS || window != mc.getWindow().getHandle() || mc.currentScreen != null || !mc.isWindowFocused()) return;
        HudRendererAccess.click(button);
    }

    private final double[] auroras$lookOut = new double[2];
    @Redirect(method = "updateMouse", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/network/ClientPlayerEntity;changeLookDirection(DD)V"))
    private void auroras$look(ClientPlayerEntity player, double dx, double dy) {
        if (AurorasModules.look(dx, dy, auroras$lookOut)) return; // freelook turned the camera instead
        player.changeLookDirection(auroras$lookOut[0], auroras$lookOut[1]);
    }
    @Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true)
    private void auroras$scroll(long window, double horizontal, double vertical, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (window == mc.getWindow().getHandle() && mc.currentScreen == null && AurorasModules.scroll(vertical)) ci.cancel();
    }
}
