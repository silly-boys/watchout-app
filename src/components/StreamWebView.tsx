import React, { useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { buildWebRTCHtml } from "../utils";

type Props = {
  offerUrl: string;
  style?: StyleProp<ViewStyle>;
};

export function StreamWebView({ offerUrl, style }: Props) {
  const html = useMemo(() => buildWebRTCHtml(offerUrl), [offerUrl]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={offerUrl}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webView}
        javaScriptEnabled
        allowsInlineMediaPlayback
        allowUniversalAccessFromFileURLs
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#1A1A2E",
  },
  webView: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
});
