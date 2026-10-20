package gg.auroras.client.mixin;

import gg.auroras.client.AurorasStream;
import net.minecraft.client.gui.Font;
import net.minecraft.network.chat.FormattedText;
import net.minecraft.util.FormattedCharSequence;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Name Protect: every string Minecraft draws or measures passes here, so names are swapped for aliases on your screen
 * only. With the module off each hook is one boolean check and returns the text untouched.
 */
@Mixin(Font.class)
public abstract class FontMixin {
    @ModifyVariable(method = "prepareText(Ljava/lang/String;FFIZI)Lnet/minecraft/client/gui/Font$PreparedText;", at = @At("HEAD"), argsOnly = true)
    private String auroras$draw(String s) { return AurorasStream.text(s); }
    @ModifyVariable(method = "prepareText(Lnet/minecraft/util/FormattedCharSequence;FFIZZI)Lnet/minecraft/client/gui/Font$PreparedText;", at = @At("HEAD"), argsOnly = true)
    private FormattedCharSequence auroras$drawSeq(FormattedCharSequence s) { return AurorasStream.text(s); }
    @ModifyVariable(method = "width(Ljava/lang/String;)I", at = @At("HEAD"), argsOnly = true)
    private String auroras$width(String s) { return AurorasStream.text(s); }
    @ModifyVariable(method = "width(Lnet/minecraft/util/FormattedCharSequence;)I", at = @At("HEAD"), argsOnly = true)
    private FormattedCharSequence auroras$widthSeq(FormattedCharSequence s) { return AurorasStream.text(s); }
    @Inject(method = "width(Lnet/minecraft/network/chat/FormattedText;)I", at = @At("HEAD"), cancellable = true)
    private void auroras$widthText(FormattedText text, CallbackInfoReturnable<Integer> cir) {
        if (!AurorasStream.protecting() || text == null) return;
        String raw = text.getString(), p = AurorasStream.text(raw); if (p != raw) cir.setReturnValue(((Font) (Object) this).width(p));
    }
}
