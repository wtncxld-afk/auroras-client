package gg.auroras.client.platform;

// Key codes. Settings, the launcher and the profile files store GLFW key codes (what Minecraft used up to 1.21.11).
// Minecraft 26.x reads keys through SDL, whose codes differ, so codes are converted through InputConstants' named
// constants: on 1.21.11 KEY_A is GLFW's 65, on 26.x it is SDL's value, and the same table works for both.

import com.mojang.blaze3d.platform.InputConstants;

public final class Keys {
    private Keys() {}
    private static final int[][] PAIRS = {
        {65, InputConstants.KEY_A}, {66, InputConstants.KEY_B}, {67, InputConstants.KEY_C}, {68, InputConstants.KEY_D}, {69, InputConstants.KEY_E}, {70, InputConstants.KEY_F},
        {71, InputConstants.KEY_G}, {72, InputConstants.KEY_H}, {73, InputConstants.KEY_I}, {74, InputConstants.KEY_J}, {75, InputConstants.KEY_K}, {76, InputConstants.KEY_L},
        {77, InputConstants.KEY_M}, {78, InputConstants.KEY_N}, {79, InputConstants.KEY_O}, {80, InputConstants.KEY_P}, {81, InputConstants.KEY_Q}, {82, InputConstants.KEY_R},
        {83, InputConstants.KEY_S}, {84, InputConstants.KEY_T}, {85, InputConstants.KEY_U}, {86, InputConstants.KEY_V}, {87, InputConstants.KEY_W}, {88, InputConstants.KEY_X},
        {89, InputConstants.KEY_Y}, {90, InputConstants.KEY_Z},
        {48, InputConstants.KEY_0}, {49, InputConstants.KEY_1}, {50, InputConstants.KEY_2}, {51, InputConstants.KEY_3}, {52, InputConstants.KEY_4},
        {53, InputConstants.KEY_5}, {54, InputConstants.KEY_6}, {55, InputConstants.KEY_7}, {56, InputConstants.KEY_8}, {57, InputConstants.KEY_9},
        {32, InputConstants.KEY_SPACE}, {256, InputConstants.KEY_ESCAPE}, {257, InputConstants.KEY_RETURN}, {258, InputConstants.KEY_TAB}, {259, InputConstants.KEY_BACKSPACE},
        {261, InputConstants.KEY_DELETE}, {262, InputConstants.KEY_RIGHT}, {263, InputConstants.KEY_LEFT}, {264, InputConstants.KEY_DOWN}, {265, InputConstants.KEY_UP},
        {290, InputConstants.KEY_F1}, {291, InputConstants.KEY_F2}, {292, InputConstants.KEY_F3}, {293, InputConstants.KEY_F4}, {294, InputConstants.KEY_F5}, {295, InputConstants.KEY_F6},
        {296, InputConstants.KEY_F7}, {297, InputConstants.KEY_F8}, {298, InputConstants.KEY_F9}, {299, InputConstants.KEY_F10}, {300, InputConstants.KEY_F11}, {301, InputConstants.KEY_F12},
        {340, InputConstants.KEY_LSHIFT}, {341, InputConstants.KEY_LCONTROL}, {342, InputConstants.KEY_LALT}, {344, InputConstants.KEY_RSHIFT}, {345, InputConstants.KEY_RCONTROL}, {346, InputConstants.KEY_RALT},
        // punctuation, navigation and keypad: without these a key bound in the Auroras menu on 26.x was saved as a raw SDL code
        {39, InputConstants.KEY_APOSTROPHE}, {44, InputConstants.KEY_COMMA}, {45, InputConstants.KEY_MINUS}, {46, InputConstants.KEY_PERIOD}, {47, InputConstants.KEY_SLASH},
        {59, InputConstants.KEY_SEMICOLON}, {61, InputConstants.KEY_EQUALS}, {91, InputConstants.KEY_LBRACKET}, {92, InputConstants.KEY_BACKSLASH}, {93, InputConstants.KEY_RBRACKET},
        {96, InputConstants.KEY_GRAVE}, {260, InputConstants.KEY_INSERT}, {266, InputConstants.KEY_PAGEUP}, {267, InputConstants.KEY_PAGEDOWN}, {268, InputConstants.KEY_HOME},
        {269, InputConstants.KEY_END}, {280, InputConstants.KEY_CAPSLOCK}, {320, InputConstants.KEY_NUMPAD0}, {321, InputConstants.KEY_NUMPAD1}, {322, InputConstants.KEY_NUMPAD2},
        {323, InputConstants.KEY_NUMPAD3}, {324, InputConstants.KEY_NUMPAD4}, {325, InputConstants.KEY_NUMPAD5}, {326, InputConstants.KEY_NUMPAD6}, {327, InputConstants.KEY_NUMPAD7},
        {328, InputConstants.KEY_NUMPAD8}, {329, InputConstants.KEY_NUMPAD9}};
    public static final int ESCAPE = 256, ENTER = 257, TAB = 258, BACKSPACE = 259, DELETE = 261, RIGHT = 262, LEFT = 263, DOWN = 264, UP = 265, SPACE = 32;
    /** Game key code -> GLFW code (unknown keys keep their own value, so they still compare consistently). */
    public static int toGlfw(int game) { for (int[] p : PAIRS) if (p[1] == game) return p[0]; return game; }
    public static int fromGlfw(int glfw) { for (int[] p : PAIRS) if (p[0] == glfw) return p[1]; return glfw; }
}
