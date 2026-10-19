package net.minecraft.resources;
public record Identifier(String ns, String path) { public static Identifier fromNamespaceAndPath(String n, String p) { return new Identifier(n, p); } }
