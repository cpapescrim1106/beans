package com.blueprint.relay;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Append-only JSONL capture for report-related artifacts (S3 pointers, responses).
 */
final class ReportCaptureStore {
  private static final Object LOCK = new Object();
  private static final Path LOG_PATH = resolvePath();
  private static final SimpleDateFormat DATE_FORMAT =
      new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ");

  private ReportCaptureStore() {
  }

  static void record(Map<String, String> fields) {
    if (fields == null || fields.isEmpty()) {
      return;
    }
    LinkedHashMap<String, String> payload = new LinkedHashMap<>();
    payload.put("timestamp", DATE_FORMAT.format(new Date()));
    payload.putAll(fields);

    String json = toJson(payload);
    synchronized (LOCK) {
      try {
        Files.write(
            LOG_PATH,
            (json + System.lineSeparator()).getBytes(StandardCharsets.UTF_8),
            StandardOpenOption.CREATE,
            StandardOpenOption.APPEND);
      } catch (IOException ex) {
        System.out.println("[RelayAgent] Failed to write report capture: " + ex.getMessage());
      }
    }
  }

  private static Path resolvePath() {
    String configuredPath = System.getProperty("blueprint.relay.reportCapture");
    if (configuredPath == null || configuredPath.trim().isEmpty()) {
      String home = System.getProperty("user.home", ".");
      configuredPath = home + "/BlueprintRelayReports.jsonl";
    }
    Path path = Paths.get(configuredPath).toAbsolutePath();
    try {
      Path parent = path.getParent();
      if (parent != null && !Files.exists(parent)) {
        Files.createDirectories(parent);
      }
    } catch (IOException ignored) {
      path = Paths.get("BlueprintRelayReports.jsonl").toAbsolutePath();
    }
    return path;
  }

  private static String toJson(LinkedHashMap<String, String> fields) {
    StringBuilder builder = new StringBuilder();
    builder.append("{");
    boolean first = true;
    for (Map.Entry<String, String> entry : fields.entrySet()) {
      if (!first) {
        builder.append(",");
      }
      first = false;
      builder.append("\"").append(escape(entry.getKey())).append("\":");
      String value = entry.getValue();
      if (value == null) {
        builder.append("null");
      } else {
        builder.append("\"").append(escape(value)).append("\"");
      }
    }
    builder.append("}");
    return builder.toString();
  }

  private static String escape(String value) {
    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < value.length(); i++) {
      char ch = value.charAt(i);
      switch (ch) {
        case '\\':
          builder.append("\\\\");
          break;
        case '"':
          builder.append("\\\"");
          break;
        case '\n':
          builder.append("\\n");
          break;
        case '\r':
          builder.append("\\r");
          break;
        case '\t':
          builder.append("\\t");
          break;
        default:
          builder.append(ch);
          break;
      }
    }
    return builder.toString();
  }
}
