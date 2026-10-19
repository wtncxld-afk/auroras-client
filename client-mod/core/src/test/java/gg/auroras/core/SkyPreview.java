package gg.auroras.core;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Renders one frame of the in-game Custom Sky (the exact SkyMesh quads the adapter hands to Minecraft) into a PNG, so the
 * look can be reviewed without Minecraft. It is a small software rasterizer that does what the GPU does with those quads:
 * a perspective camera at the origin, each quad split into two triangles, perspective-correct vertex-color interpolation
 * and blending in draw order, no depth test (the mesh is ordered far to near): straight alpha blending, or additive
 * (rgb * alpha added, glBlendFunc(SRC_ALPHA, ONE)) for the runs SkyMesh marks additive. Add additive=false after the
 * camera arguments to draw everything with normal blending, as an adapter without an additive render type would.
 *
 * Run from client-mod/core:
 *   java -cp out gg.auroras.core.SkyPreview ../../visuals out.png [W H theme ticks seconds quality yawDeg pitchDeg fovDeg key=value...]
 * Defaults: 1920 1080 aurora 18000 (midnight) 30 HIGH 0 20 70. Extra key=value pairs override sky.* settings (e.g. sky.starDensity=2).
 */
public class SkyPreview {
    public static void main(String[] a) throws Exception {
        Path vis = Path.of(a[0]); String out = a[1];
        int W = a.length > 2 ? Integer.parseInt(a[2]) : 1920, H = a.length > 3 ? Integer.parseInt(a[3]) : 1080;
        String theme = a.length > 4 ? a[4] : "aurora"; long ticks = a.length > 5 ? Long.parseLong(a[5]) : 18000; double sec = a.length > 6 ? Double.parseDouble(a[6]) : 30;
        String q = a.length > 7 ? a[7] : "HIGH"; double yaw = a.length > 8 ? Double.parseDouble(a[8]) : 0, pitch = a.length > 9 ? Double.parseDouble(a[9]) : 20, fov = a.length > 10 ? Double.parseDouble(a[10]) : 70;
        Config.Registry reg = new Config.Registry(); Map<String, String> m = new HashMap<>();
        for (Config.SettingDef d : reg.get("sky").settings()) m.put("sky." + d.key(), d.def());
        m.put(Config.Registry.QUALITY, "BALANCED"); m.put("sky.theme", theme); m.put("sky.skyQuality", q);
        boolean additive = true;
        for (int k = 11; k < a.length; k++) { int e = a[k].indexOf('='); if (a[k].equals("additive=false")) additive = false; else if (e > 0) m.put(a[k].substring(0, e), a[k].substring(e + 1)); }
        SkyMesh mesh = new SkyMesh(Sky.load(Files.readString(vis.resolve("themes.json")))); mesh.configure(m::get);
        if (!mesh.build("minecraft:overworld", ticks, sec)) throw new IllegalStateException("theme " + theme + " draws nothing");
        boolean[] add = new boolean[mesh.quads]; if (additive) for (int r = 0, from = 0; r < mesh.runs; from = mesh.runEnd[r], r++) for (int qi = from; qi < mesh.runEnd[r]; qi++) add[qi] = mesh.runAdd[r];
        BufferedImage img = render(mesh.pos, mesh.col, mesh.quads, add, W, H, Math.toRadians(yaw), Math.toRadians(pitch), Math.toRadians(fov));
        File f = new File(out); if (f.getParentFile() != null) f.getParentFile().mkdirs(); ImageIO.write(img, "png", f);
        System.out.println("wrote " + out + " (" + theme + ", " + q + ", " + mesh.quads + " quads)");
    }

    /** Rasterizes the quads. Camera looks along +x rotated by yaw (around y) and pitch (up), vertical field of view fov. */
    static BufferedImage render(float[] pos, int[] col, int quads, boolean[] add, int W, int H, double yaw, double pitch, double fov) {
        float[] r = new float[W * H], g = new float[W * H], b = new float[W * H];
        // camera basis: forward f, right rt, up u
        double fx = Math.cos(pitch) * Math.cos(yaw), fy = Math.sin(pitch), fz = Math.cos(pitch) * Math.sin(yaw);
        double rx = -Math.sin(yaw), ry = 0, rz = Math.cos(yaw);
        double ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
        double focal = (H / 2.0) / Math.tan(fov / 2);
        double[][] poly = new double[12][7], tmp = new double[12][7];
        for (int qd = 0; qd < quads; qd++) for (int tri = 0; tri < 2; tri++) {
            int[] idx = tri == 0 ? new int[]{0, 1, 2} : new int[]{0, 2, 3}; int n = 3;
            for (int k = 0; k < 3; k++) {
                int vi = qd * 4 + idx[k]; double x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2]; int c = col[vi];
                poly[k][0] = x * rx + y * ry + z * rz; poly[k][1] = x * ux + y * uy + z * uz; poly[k][2] = x * fx + y * fy + z * fz;
                poly[k][3] = ((c >> 16) & 255) / 255.0; poly[k][4] = ((c >> 8) & 255) / 255.0; poly[k][5] = (c & 255) / 255.0; poly[k][6] = (c >>> 24) / 255.0;
            }
            // clip against the near plane (camera-space depth 0.05)
            int m = 0; double near = 0.05;
            for (int k = 0; k < n; k++) {
                double[] p0 = poly[k], p1 = poly[(k + 1) % n]; boolean in0 = p0[2] >= near, in1 = p1[2] >= near;
                if (in0) System.arraycopy(p0, 0, tmp[m++], 0, 7);
                if (in0 != in1) { double t = (near - p0[2]) / (p1[2] - p0[2]); for (int c = 0; c < 7; c++) tmp[m][c] = p0[c] + (p1[c] - p0[c]) * t; m++; }
            }
            for (int k = 1; k + 1 < m; k++) raster(tmp[0], tmp[k], tmp[k + 1], focal, W, H, r, g, b, add[qd]);
        }
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        for (int i = 0; i < W * H; i++) img.setRGB(i % W, i / W, (q8(r[i]) << 16) | (q8(g[i]) << 8) | q8(b[i]));
        return img;
    }
    static int q8(float v) { return Math.round(Math.max(0, Math.min(1, v)) * 255); }

    static void raster(double[] p0, double[] p1, double[] p2, double focal, int W, int H, float[] R, float[] G, float[] B, boolean add) {
        double[][] v = {p0, p1, p2}; double[] sx = new double[3], sy = new double[3], iw = new double[3];
        for (int k = 0; k < 3; k++) { iw[k] = 1 / v[k][2]; sx[k] = W / 2.0 + v[k][0] * focal * iw[k]; sy[k] = H / 2.0 - v[k][1] * focal * iw[k]; }
        double area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]); if (Math.abs(area) < 1e-9) return;
        int x0 = (int) Math.max(0, Math.floor(Math.min(sx[0], Math.min(sx[1], sx[2])))), x1 = (int) Math.min(W - 1, Math.ceil(Math.max(sx[0], Math.max(sx[1], sx[2]))));
        int y0 = (int) Math.max(0, Math.floor(Math.min(sy[0], Math.min(sy[1], sy[2])))), y1 = (int) Math.min(H - 1, Math.ceil(Math.max(sy[0], Math.max(sy[1], sy[2]))));
        for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) {
            double px = x + 0.5, py = y + 0.5;
            double w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) / area, w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) / area, w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            double a0 = w0 * iw[0], a1 = w1 * iw[1], a2 = w2 * iw[2], s = a0 + a1 + a2; a0 /= s; a1 /= s; a2 /= s;
            double cr = a0 * p0[3] + a1 * p1[3] + a2 * p2[3], cg = a0 * p0[4] + a1 * p1[4] + a2 * p2[4], cb = a0 * p0[5] + a1 * p1[5] + a2 * p2[5], al = a0 * p0[6] + a1 * p1[6] + a2 * p2[6];
            int i = y * W + x;
            if (add) { R[i] = Math.min(1, R[i] + (float) (cr * al)); G[i] = Math.min(1, G[i] + (float) (cg * al)); B[i] = Math.min(1, B[i] + (float) (cb * al)); }
            else { R[i] += (float) ((cr - R[i]) * al); G[i] += (float) ((cg - G[i]) * al); B[i] += (float) ((cb - B[i]) * al); }
        }
    }
}
