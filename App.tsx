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
import { INITIAL_ALERTS, DEFAULT_STREAM_URL } from "./src/constants";
import { Zone } from "./src/types";
import { buildOfferUrl, toSvgPoints } from "./src/utils";

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
  const [offerUrl, setOfferUrl] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [streamSize, setStreamSize] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>({
    ok: false,
    message: "서버 연결 확인 중",
  });

  const refreshBackendStatus = async () => {
    setIsCheckingServer(true);
    setBackendStatus({ ok: false, message: "서버 연결 확인 중" });
    const result = await testBackendConnection();
    setBackendStatus(result);
    setIsCheckingServer(false);
  };

  useEffect(() => {
    refreshBackendStatus();
  }, []);

  const connectStream = () => setOfferUrl(buildOfferUrl(urlInput));

  const handleStreamLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStreamSize({ width, height });
  };

  const serverDotColor = isCheckingServer
    ? "#F57F17"
    : backendStatus.ok
    ? "#2E7D32"
    : "#C62828";

  const serverStatusText = isCheckingServer
    ? "확인 중..."
    : backendStatus.ok
    ? "정상 연결됨"
    : backendStatus.message;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>WatchOut</Text>
        <Text style={styles.headerSub}>현장 안전 모니터링</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Server Status */}
        <Pressable style={styles.serverCard} onPress={refreshBackendStatus}>
          <View style={[styles.serverDot, { backgroundColor: serverDotColor }]} />
          <View style={styles.serverBody}>
            <Text style={styles.serverLabel}>AI 서버 상태</Text>
            <Text
              style={[
                styles.serverStatus,
                { color: backendStatus.ok ? "#2E7D32" : isCheckingServer ? "#E65100" : "#C62828" },
              ]}
            >
              {serverStatusText}
            </Text>
          </View>
          <Text style={styles.serverRefreshLabel}>탭하여 새로고침</Text>
        </Pressable>

        {/* Live Camera */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>실시간 카메라</Text>
          <View style={styles.streamCard} onLayout={handleStreamLayout}>
            {offerUrl && !isFullscreen ? (
              <StreamWebView offerUrl={offerUrl} style={styles.webView} />
            ) : (
              <View style={styles.emptyStream}>
                <Text style={styles.emptyStreamIcon}>
                  {offerUrl ? "▶" : "■"}
                </Text>
                <Text style={styles.emptyStreamText}>
                  {offerUrl ? "위험구역 지정 중" : "카메라 미연결"}
                </Text>
                {!offerUrl && (
                  <Text style={styles.emptyStreamHint}>
                    아래에서 카메라 주소를 입력하고 연결하세요
                  </Text>
                )}
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
                    fill="rgba(255, 109, 0, 0.25)"
                    stroke="#FF6D00"
                    strokeWidth="3"
                  />
                ))}
              </Svg>
            </View>
          </View>
        </View>

        {/* Camera Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카메라 주소</Text>
          <View style={styles.connectionRow}>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              onSubmitEditing={connectStream}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://카메라IP:포트"
              placeholderTextColor="#9AABB8"
              style={styles.urlInput}
            />
            <Pressable style={styles.connectButton} onPress={connectStream}>
              <Text style={styles.connectButtonText}>연결</Text>
            </Pressable>
          </View>
        </View>

        {/* Danger Zone Setup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>위험구역 설정</Text>
          <Pressable
            style={styles.zoneButton}
            onPress={() => setIsFullscreen(true)}
          >
            <Text style={styles.zoneButtonPlus}>+</Text>
            <Text style={styles.zoneButtonText}>위험구역 지정하기</Text>
          </Pressable>
          {zones.length > 0 ? (
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneInfoText}>
                지정된 구역: {zones.map((z) => z.name).join(", ")}
              </Text>
              <Pressable onPress={() => setZones([])}>
                <Text style={styles.zoneClearText}>전체 삭제</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.zoneHint}>
              위험구역을 지정하면 침입 감지 기준으로 사용됩니다
            </Text>
          )}
        </View>

        {/* Alert List */}
        <View style={styles.section}>
          <View style={styles.alertHeader}>
            <Text style={styles.sectionTitle}>감지 알림</Text>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{INITIAL_ALERTS.length}</Text>
            </View>
          </View>
          <View style={styles.alertList}>
            {INITIAL_ALERTS.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        </View>
      </ScrollView>

      <FullscreenDrawModal
        visible={isFullscreen}
        offerUrl={offerUrl}
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
  root: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  header: {
    backgroundColor: "#1B3A6B",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 22,
  },
  serverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "#DDE3EC",
    gap: 12,
  },
  serverDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  serverBody: {
    flex: 1,
    gap: 3,
  },
  serverLabel: {
    color: "#546E7A",
    fontSize: 14,
    fontWeight: "600",
  },
  serverStatus: {
    fontSize: 17,
    fontWeight: "800",
  },
  serverRefreshLabel: {
    color: "#1B3A6B",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#1A1A2E",
    fontSize: 19,
    fontWeight: "800",
  },
  streamCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
  },
  webView: {
    flex: 1,
  },
  emptyStream: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyStreamIcon: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 40,
  },
  emptyStreamText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyStreamHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
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
    height: 56,
    borderWidth: 1.5,
    borderColor: "#DDE3EC",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#1A1A2E",
    fontSize: 14,
    backgroundColor: "#FFFFFF",
  },
  connectButton: {
    width: 84,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B3A6B",
    borderRadius: 10,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  zoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 68,
    backgroundColor: "#1B3A6B",
    borderRadius: 12,
    gap: 8,
  },
  zoneButtonPlus: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
  },
  zoneButtonText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },
  zoneInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  zoneInfoText: {
    color: "#1A1A2E",
    fontSize: 15,
    fontWeight: "600",
  },
  zoneClearText: {
    color: "#C62828",
    fontSize: 15,
    fontWeight: "700",
  },
  zoneHint: {
    color: "#546E7A",
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C62828",
    paddingHorizontal: 7,
  },
  alertBadgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  alertList: {
    gap: 10,
  },
});
