import com.sun.source.util.JavacTask;
import javax.tools.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;
/** Syntax-only check for the adapter sources (no Minecraft jars needed): java ParseCheck.java adapters/fabric-1.21.4/src */
public class ParseCheck { public static void main(String[] a) throws Exception {
  JavaCompiler c = ToolProvider.getSystemJavaCompiler(); DiagnosticCollector<JavaFileObject> d = new DiagnosticCollector<>();
  List<Path> files; try (Stream<Path> s = Files.walk(Path.of(a[0]))) { files = s.filter(p -> p.toString().endsWith(".java")).collect(Collectors.toList()); }
  StandardJavaFileManager fm = c.getStandardFileManager(d, null, null);
  JavacTask t = (JavacTask) c.getTask(null, fm, d, List.of(), null, fm.getJavaFileObjectsFromPaths(files)); t.parse();
  for (Diagnostic<?> x : d.getDiagnostics()) System.out.println(x);
  System.out.println(files.size() + " files parsed, " + d.getDiagnostics().size() + " syntax problems"); System.exit(d.getDiagnostics().isEmpty() ? 0 : 1); } }
