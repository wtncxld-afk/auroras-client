package net.minecraft.client.gui.screens;
/** Preview stand-in for Minecraft's Screen: just the size and the game handle the Auroras screens use. */
public class Screen { public int width, height; public net.minecraft.client.Minecraft minecraft = net.minecraft.client.Minecraft.I; public void onClose() {} public boolean shouldCloseOnEsc() { return true; } public boolean isPauseScreen() { return false; } }
