package gg.auroras.core;

import java.util.*;

/** Small strict JSON reader for the bundled theme file: objects, arrays, strings, numbers, booleans, null. */
public final class Json {
    private final String s; private int i;
    private Json(String s) { this.s = s; }
    public static Object parse(String text) { Json j = new Json(text); j.ws(); Object v = j.value(0); j.ws(); if (j.i != j.s.length()) throw j.err("Trailing characters"); return v; }
    private IllegalArgumentException err(String m) { return new IllegalArgumentException(m + " at position " + i); }
    private void ws() { while (i < s.length() && " \t\r\n".indexOf(s.charAt(i)) >= 0) i++; }
    private Object value(int depth) {
        if (depth > 64) throw err("Too deeply nested"); if (i >= s.length()) throw err("Unexpected end");
        char c = s.charAt(i);
        if (c == '{') { i++; Map<String, Object> m = new LinkedHashMap<>(); ws(); if (peek('}')) return m;
            while (true) { ws(); String k = string(); ws(); expect(':'); ws(); if (m.put(k, value(depth + 1)) != null) throw err("Duplicate key " + k); ws(); if (peek('}')) return m; expect(','); } }
        if (c == '[') { i++; List<Object> l = new ArrayList<>(); ws(); if (peek(']')) return l;
            while (true) { ws(); l.add(value(depth + 1)); ws(); if (peek(']')) return l; expect(','); } }
        if (c == '"') return string();
        if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; } if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; } if (s.startsWith("null", i)) { i += 4; return null; }
        int st = i; if (c == '-') i++; while (i < s.length() && "0123456789.eE+-".indexOf(s.charAt(i)) >= 0) i++;
        if (st == i) throw err("Unexpected character '" + c + "'");
        try { return Double.parseDouble(s.substring(st, i)); } catch (NumberFormatException e) { throw err("Bad number"); }
    }
    private boolean peek(char c) { if (i < s.length() && s.charAt(i) == c) { i++; return true; } return false; }
    private void expect(char c) { if (!peek(c)) throw err("Expected '" + c + "'"); }
    private String string() {
        expect('"'); StringBuilder b = new StringBuilder();
        while (true) { if (i >= s.length()) throw err("Unclosed string"); char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c == '\\') { char e = s.charAt(i++); switch (e) { case 'n' -> b.append('\n'); case 't' -> b.append('\t'); case 'r' -> b.append('\r'); case 'b' -> b.append('\b'); case 'f' -> b.append('\f');
                case 'u' -> { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; } default -> b.append(e); } }
            else if (c < 0x20) throw err("Control character in string"); else b.append(c); }
    }
    @SuppressWarnings("unchecked") public static Map<String, Object> obj(Object o, String what) { if (o instanceof Map) return (Map<String, Object>) o; throw new IllegalArgumentException(what + " must be an object"); }
    @SuppressWarnings("unchecked") public static List<Object> arr(Object o, String what) { if (o instanceof List) return (List<Object>) o; throw new IllegalArgumentException(what + " must be a list"); }
    public static double num(Map<String, Object> m, String k) { if (m.get(k) instanceof Double d) return d; throw new IllegalArgumentException(k + " must be a number"); }
    public static boolean bool(Map<String, Object> m, String k) { if (m.get(k) instanceof Boolean b) return b; throw new IllegalArgumentException(k + " must be true or false"); }
    public static String str(Map<String, Object> m, String k) { if (m.get(k) instanceof String v) return v; throw new IllegalArgumentException(k + " must be text"); }
}
