import javax.tools.*; import java.io.*; import java.nio.file.*; import java.util.*; import java.util.stream.*;
/** Compiles the core with the JDK compiler that ships inside the JRE: java Build.java */
public class Build { public static void main(String[] a) throws Exception {
  Path out = Path.of("out"); Files.createDirectories(out);
  List<String> files; try (Stream<Path> s = Files.walk(Path.of("src"))) { files = s.filter(p -> p.toString().endsWith(".java")).map(Path::toString).collect(Collectors.toList()); }
  List<String> args = new ArrayList<>(List.of("-d", out.toString(), "-Xlint:all")); args.addAll(files);
  int rc = ToolProvider.getSystemJavaCompiler().run(null, null, null, args.toArray(new String[0])); System.exit(rc); } }
