import React, { useMemo, useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  streamUrl: string;
  style?: StyleProp<ViewStyle>;
};

export function StreamWebView({ streamUrl, style }: Props) {
  const [error, setError] = useState("");

  const source = useMemo(
    () => ({
      uri: streamUrl,
      headers: {
        "ngrok-skip-browser-warning": "1",
        "Cache-Control": "no-cache",
      },
    }),
    [streamUrl]
  );

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={streamUrl}
        originWhitelist={["*"]}
        source={source}
        style={styles.webView}
        javaScriptEnabled
        allowsInlineMediaPlayback
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled={false}
        onLoadStart={() => setError("")}
        onError={(event) => setError(event.nativeEvent.description)}
        onHttpError={(event) =>
          setError(`HTTP ${event.nativeEvent.statusCode}`)
        }
      />
      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>스트림 연결 실패: {error}</Text>
          <Text style={styles.errorUrl}>{streamUrl}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#8f8f8f",
  },
  webView: {
    flex: 1,
    backgroundColor: "#8f8f8f",
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8f8f8f",
    padding: 16,
  },
  errorText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  errorUrl: {
    marginTop: 6,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
