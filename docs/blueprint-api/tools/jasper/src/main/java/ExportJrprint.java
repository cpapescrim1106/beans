import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.zip.GZIPInputStream;

import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.util.JRLoader;
import net.sf.jasperreports.export.SimpleExporterInput;
import net.sf.jasperreports.export.SimpleWriterExporterOutput;
import net.sf.jasperreports.export.SimpleCsvExporterConfiguration;
import net.sf.jasperreports.engine.export.JRCsvExporter;

public class ExportJrprint {
  public static void main(String[] args) throws Exception {
    if (args.length < 3) {
      System.err.println("Usage: ExportJrprint <input.jrprint.gz> <format:pdf|xml|csv> <output-file>");
      System.exit(1);
    }

    File input = new File(args[0]);
    String format = args[1].toLowerCase();
    File output = new File(args[2]);

    JasperPrint print;
    try (InputStream raw = new BufferedInputStream(new FileInputStream(input))) {
      raw.mark(2);
      int b1 = raw.read();
      int b2 = raw.read();
      raw.reset();
      boolean gzip = (b1 == 0x1f && b2 == 0x8b);
      try (InputStream in = gzip ? new GZIPInputStream(raw) : raw) {
        Object obj = JRLoader.loadObject(in);
        print = (JasperPrint) obj;
      }
    }

    switch (format) {
      case "pdf":
        JasperExportManager.exportReportToPdfFile(print, output.getAbsolutePath());
        break;
      case "xml":
        JasperExportManager.exportReportToXmlFile(print, output.getAbsolutePath(), false);
        break;
      case "csv":
        exportCsv(print, output.getAbsolutePath());
        break;
      default:
        throw new IllegalArgumentException("Unsupported format: " + format);
    }

    System.out.println("Exported " + format + " to " + output.getAbsolutePath());
  }

  private static void exportCsv(JasperPrint print, String path) throws Exception {
    JRCsvExporter exporter = new JRCsvExporter();
    exporter.setExporterInput(new SimpleExporterInput(print));
    exporter.setExporterOutput(new SimpleWriterExporterOutput(path));

    SimpleCsvExporterConfiguration config = new SimpleCsvExporterConfiguration();
    config.setFieldDelimiter(",");
    exporter.setConfiguration(config);
    exporter.exportReport();
  }
}
