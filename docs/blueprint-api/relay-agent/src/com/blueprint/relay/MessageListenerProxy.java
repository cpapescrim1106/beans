package com.blueprint.relay;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

final class MessageListenerProxy implements InvocationHandler {
  private final Object target;

  private MessageListenerProxy(Object target) {
    this.target = target;
  }

  static Object wrap(Object target) {
    if (target == null) {
      return null;
    }
    Class<?>[] interfaces = target.getClass().getInterfaces();
    if (interfaces == null || interfaces.length == 0) {
      Agent.log("Cannot proxy MessageListener -- no interfaces exposed on %s", target.getClass().getName());
      return null;
    }
    Agent.log("Creating proxy for MessageListener using interfaces: %s", Arrays.toString(interfaces));
    return Proxy.newProxyInstance(
        target.getClass().getClassLoader(),
        interfaces,
        new MessageListenerProxy(target));
  }

  @Override
  public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (method.getDeclaringClass() == Object.class) {
      return method.invoke(target, args);
    }

    boolean isOnMessage = "onMessage".equals(method.getName());
    if (isOnMessage) {
      RelayLogger.log("jms.onMessage args=%s", ArgumentFormatter.summarizeArgs(args));
      captureReportArtifacts(args);
    }

    try {
      Object result = method.invoke(target, args);
      if (isOnMessage) {
        RelayLogger.log("jms.onMessage -> %s", ArgumentFormatter.summarizeValue(result));
      }
      return result;
    } catch (InvocationTargetException ex) {
      Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
      if (isOnMessage) {
        RelayLogger.log("jms.onMessage threw %s: %s",
            cause.getClass().getName(),
            cause.getMessage());
      }
      throw cause;
    }
  }

  private void captureReportArtifacts(Object[] args) {
    String text = extractText(args);
    if (text == null || text.isEmpty()) {
      return;
    }

    boolean looksEscaped = text.contains("\\\"");
    String normalized = looksEscaped ? text.replace("\\\"", "\"") : text;

    if (normalized.contains("PayloadS3Pointer") && normalized.contains("s3BucketName")) {
      String bucket = extractJsonStringValue(normalized, "s3BucketName");
      String key = extractJsonStringValue(normalized, "s3Key");
      if (bucket != null || key != null) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("type", "s3Pointer");
        fields.put("bucket", bucket);
        fields.put("key", key);
        ReportCaptureStore.record(fields);
      }
    }

    if (normalized.contains("\"reportResultXml\"") || normalized.contains("\"reportName\"")) {
      String reportName = extractJsonStringValue(normalized, "reportName");
      String reportResultXml = extractJsonStringValue(normalized, "reportResultXml");
      if (reportName != null || reportResultXml != null) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("type", "reportResponse");
        fields.put("reportName", reportName);
        fields.put("reportResultXml", reportResultXml);
        ReportCaptureStore.record(fields);
      }
    }
  }

  private String extractText(Object[] args) {
    if (args == null) {
      return null;
    }
    for (Object arg : args) {
      if (arg == null) {
        continue;
      }
      if (arg instanceof String) {
        return (String) arg;
      }
      String text = readText(arg);
      if (text != null) {
        return text;
      }
    }
    return null;
  }

  private String readText(Object value) {
    try {
      Method getText = value.getClass().getMethod("getText");
      Object result = getText.invoke(value);
      if (result instanceof String) {
        return (String) result;
      }
    } catch (Exception ignored) {
      // ignore
    }
    return null;
  }

  private String extractJsonStringValue(String text, String key) {
    int idx = indexOfKey(text, key);
    if (idx < 0) {
      return null;
    }
    int colon = text.indexOf(':', idx);
    if (colon < 0) {
      return null;
    }
    int start = colon + 1;
    while (start < text.length() && Character.isWhitespace(text.charAt(start))) {
      start++;
    }
    if (start >= text.length()) {
      return null;
    }
    if (text.startsWith("null", start)) {
      return null;
    }
    if (text.charAt(start) != '"') {
      return null;
    }
    start++;
    StringBuilder builder = new StringBuilder();
    boolean escape = false;
    for (int i = start; i < text.length(); i++) {
      char ch = text.charAt(i);
      if (escape) {
        builder.append(ch);
        escape = false;
        continue;
      }
      if (ch == '\\') {
        escape = true;
        continue;
      }
      if (ch == '"') {
        return builder.toString();
      }
      builder.append(ch);
    }
    return null;
  }

  private int indexOfKey(String text, String key) {
    String raw = "\"" + key + "\"";
    int idx = text.indexOf(raw);
    if (idx >= 0) {
      return idx;
    }
    String escaped = "\\\"" + key + "\\\"";
    return text.indexOf(escaped);
  }
}
