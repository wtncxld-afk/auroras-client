import java.nio.file.*;
import java.util.*;

/** Stands in for Minecraft in the launch tests: records how it was started, then exits with -Dprobe.exit (default 0). */
public class Probe {
    public static void main(String[] args) throws Exception {
        List<String> out = new ArrayList<>();
        out.add("main=" + Probe.class.getName());
        out.add("java=" + System.getProperty("java.version"));
        out.add("maxMemMb=" + Runtime.getRuntime().maxMemory() / (1024 * 1024));
        out.add("classpath=" + System.getProperty("java.class.path"));
        out.add("cwd=" + Paths.get("").toAbsolutePath());
        for (String a : args) out.add("arg=" + a);
        Files.write(Paths.get(System.getProperty("probe.out")), out);
        System.out.println("[Probe] started with " + args.length + " arguments");
        int code = Integer.getInteger("probe.exit", 0);
        if (code != 0) System.err.println("[Probe] simulated crash, exiting with " + code);
        System.exit(code);
    }
}
