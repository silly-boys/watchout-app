import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCard } from "./src/components/AlertCard";
import { FullscreenDrawModal } from "./src/components/FullscreenDrawModal";
import { StreamWebView } from "./src/components/StreamWebView";
import { testBackendConnection, BackendConnectionStatus } from "./src/api";
import { INITIAL_ALERTS, DEFAULT_STREAM_URL, BACKEND_BASE_URL } from "./src/constants";
import { Zone } from "./src/types";
import { normalizeStreamUrl, toSvgPoints } from "./src/utils";

export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

function App() {
  const insets = useSafeAreaInsets();
  const [urlInput, setUrlInput] = useState(DEFAULT_STREAM_URL);
  const [streamUrl, setStreamUrl] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [streamSize, setStreamSize] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backendStatus, setBackendStatus] =
    useState<BackendConnectionStatus>({
      ok: false,
      message: "백엔드 확인 중",
    });

  const refreshBackendStatus = async () => {
    setBackendStatus({ ok: false, message: "백엔드 확인 중" });
    setBackendStatus(await testBackendConnection());
  };

  useEffect(() => {
    refreshBackendStatus();
  }, []);

  const connectStream = () => setStreamUrl(normalizeStreamUrl(urlInput));

  const handleStreamLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStreamSize({ width, height });
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>안전 모니터링</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.streamCard} onLayout={handleStreamLayout}>
          {streamUrl && !isFullscreen ? (
            <StreamWebView streamUrl={streamUrl} style={styles.webView} />
          ) : (
            <View style={styles.emptyStream}>
              <Text style={styles.emptyStreamText}>
                {streamUrl ? "위험구역 지정 중" : "실시간 영상 띄워주는 모니터"}
              </Text>
            </View>
          )}
          <View style={styles.zoneOverlay} pointerEvents="none">
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${streamSize.width || 1} ${streamSize.height || 1}`}
            >
              {zones.map((zone) => (
                <Polygon
                  key={zone.id}
                  points={toSvgPoints(zone.points, streamSize)}
                  fill="rgba(255, 149, 0, 0.28)"
                  stroke="#ff3b30"
                  strokeWidth="3"
                />
              ))}
            </Svg>
          </View>
        </View>

        <View style={styles.connectionRow}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={connectStream}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://10.80.162.190:8080/stream"
            placeholderTextColor="#9b9b9b"
            style={styles.urlInput}
          />
          <Pressable style={styles.connectButton} onPress={connectStream}>
            <Text style={styles.connectButtonText}>연결</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.zoneButton}
            onPress={() => setIsFullscreen(true)}
          >
            <Text style={styles.zoneButtonText}>+ 위험구역 지정하기</Text>
          </Pressable>
          <Pressable style={styles.clearButton} onPress={() => setZones([])}>
            <Text style={styles.clearButtonText}>초기화</Text>
          </Pressable>
        </View>

        <View style={styles.zoneSummary}>
          <Text style={styles.zoneSummaryText}>
            {zones.length > 0
              ? `${zones.map((z) => z.name).join(", ")} 지정됨`
              : "위험구역을 그리면 침입 감지 기준으로 사용할 수 있어요."}
          </Text>
        </View>

        <Pressable style={styles.backendStatus} onPress={refreshBackendStatus}>
          <View
            style={[
              styles.backendStatusDot,
              backendStatus.ok && styles.backendStatusDotOnline,
            ]}
          />
          <View style={styles.backendStatusBody}>
            <Text style={styles.backendStatusLabel}>백엔드</Text>
            <Text style={styles.backendStatusText}>{backendStatus.message}</Text>
            <Text style={styles.backendUrlText}>{BACKEND_BASE_URL}</Text>
          </View>
        </Pressable>

        <View style={styles.alertList}>
          {INITIAL_ALERTS.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </View>
      </ScrollView>

      <FullscreenDrawModal
        visible={isFullscreen}
        streamUrl={streamUrl}
        initialZones={zones}
        onDone={(newZones) => {
          setZones(newZones);
          setIsFullscreen(false);
        }}
        onCancel={() => setIsFullscreen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    justifyContent: "flex-end",
    backgroundColor: "#8f8f8f",
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 14,
  },
  streamCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#8f8f8f",
  },
  webView: {
    flex: 1,
    backgroundColor: "#8f8f8f",
  },
  emptyStream: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStreamText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  zoneOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  connectionRow: {
    flexDirection: "row",
    gap: 8,
  },
  urlInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    paddingHorizontal: 12,
    color: "#222222",
    fontSize: 13,
  },
  connectButton: {
    minWidth: 68,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#444444",
  },
  connectButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  zoneButton: {
    flex: 1,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8f8f8f",
  },
  zoneButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  clearButton: {
    width: 82,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#8f8f8f",
  },
  clearButtonText: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "800",
  },
  zoneSummary: {
    minHeight: 26,
    justifyContent: "center",
  },
  zoneSummaryText: {
    color: "#777777",
    fontSize: 13,
    fontWeight: "600",
  },
  backendStatus: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d7d7d7",
    paddingHorizontal: 12,
    gap: 10,
  },
  backendStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ff9500",
  },
  backendStatusDotOnline: {
    backgroundColor: "#34c759",
  },
  backendStatusBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  backendStatusLabel: {
    color: "#777777",
    fontSize: 12,
    fontWeight: "800",
  },
  backendStatusText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },
  backendUrlText: {
    color: "#777777",
    fontSize: 12,
    fontWeight: "600",
  },
  alertList: {
    gap: 12,
  },
});
