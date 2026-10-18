import javax.tools.*;
/** java CompileProbe.java <Probe.java> <outDir> : compiles with the JDK compiler module (works on a JRE that includes jdk.compiler). */
public class CompileProbe { public static void main(String[] a) { JavaCompiler c = ToolProvider.getSystemJavaCompiler(); if (c == null) { System.err.println("no compiler"); System.exit(2); } System.exit(c.run(null, null, null, "-d", a[1], a[0])); } }
