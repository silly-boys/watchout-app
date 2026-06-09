import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import EventSource, { EventSourceListener } from "react-native-sse";
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCard } from "./src/components/AlertCard";
import { StreamWebView } from "./src/components/StreamWebView";
import {
  testBackendConnection,
  BackendConnectionStatus,
  EventRecord,
  getEvents,
  getFence,
  upsertFcmToken,
  upsertFence,
} from "./src/api";
import { BACKEND_BASE_URL, DEFAULT_STREAM_URL, INITIAL_ALERTS } from "./src/constants";
import { DetectionAlert, Point, Zone } from "./src/types";
import { buildOfferUrl, clamp, toSvgPoints } from "./src/utils";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type StreamMode = "monitor" | "drawing" | "switching-to-drawing" | "switching-to-monitor";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EVENT_LABELS: Record<EventRecord["type"], string> = {
  FIRE: "화재·연기 감지",
  NO_HELMET: "헬멧 미착용 감지",
  INTRUSION: "위험구역 침입",
  FALL: "쓰러짐·낙상 감지",
  EQUIPMENT_ANOMALY: "설비 이상",
};

const CRITICAL_EVENT_TYPES = new Set<EventRecord["type"]>(["FIRE", "FALL", "INTRUSION"]);

function mapEventsToAlerts(events: EventRecord[]): DetectionAlert[] {
  const groupedEvents = new Map<string, { event: EventRecord; count: number }>();

  events.forEach((event) => {
    const dateKey = getEventDateKey(event.timestamp);
    const key = `${event.type}-${dateKey}`;
    const current = groupedEvents.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    groupedEvents.set(key, { event, count: 1 });
  });

  return Array.from(groupedEvents.values()).map(({ event, count }) =>
    mapEventToAlert(event, count)
  );
}

function mapEventToAlert(event: EventRecord, count: number): DetectionAlert {
  return {
    id: `${event.type}-${getEventDateKey(event.timestamp)}`,
    title: EVENT_LABELS[event.type] ?? event.type,
    zone: "A구역",
    ago: formatEventDate(event.timestamp),
    severity: CRITICAL_EVENT_TYPES.has(event.type) ? "critical" : "warning",
    count,
  };
}

function getEventDateKey(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEventDate(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EA580C",
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return token.data;
}

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
  const [alerts, setAlerts] = useState<DetectionAlert[]>(INITIAL_ALERTS);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [streamSize, setStreamSize] = useState({ width: 0, height: 0 });
  const [streamMode, setStreamMode] = useState<StreamMode>("monitor");
  const [isSavingFence, setIsSavingFence] = useState(false);
  const [isLoadingFence, setIsLoadingFence] = useState(false);
  const [fenceSaveMessage, setFenceSaveMessage] = useState("");
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>({
    ok: false,
    message: "서버 연결 확인 중",
  });

  const lastPointRef = useRef<Point | null>(null);
  const draftPointsRef = useRef<Point[]>([]);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDrawingZone = streamMode === "drawing";
  const isSwitchingStream =
    streamMode === "switching-to-drawing" || streamMode === "switching-to-monitor";

  const criticalCount = useMemo(
    () => alerts.filter((alert) => alert.severity === "critical").length,
    [alerts]
  );
  const warningCount = alerts.length - criticalCount;

  const refreshBackendStatus = async () => {
    setIsCheckingServer(true);
    setBackendStatus({ ok: false, message: "서버 연결 확인 중" });
    const result = await testBackendConnection();
    setBackendStatus(result);
    setIsCheckingServer(false);
  };

  useEffect(() => {
    refreshBackendStatus();
    loadEvents();
    registerPushToken();

    const eventsSource = new EventSource<"event" | "new_event">(
      `${BACKEND_BASE_URL}/api/events/stream`,
      {
        headers: {
          Accept: "text/event-stream",
        },
      }
    );

    const eventStreamListener: EventSourceListener<"event" | "new_event"> = (event) => {
      if (event.type === "message" || event.type === "event" || event.type === "new_event") {
        loadEvents();
      }
    };

    eventsSource.addEventListener("message", eventStreamListener);
    eventsSource.addEventListener("event", eventStreamListener);
    eventsSource.addEventListener("new_event", eventStreamListener);

    return () => {
      eventsSource.removeAllEventListeners();
      eventsSource.close();
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const loadEvents = async () => {
    try {
      const events = await getEvents(20);
      setAlerts(mapEventsToAlerts(events));
    } catch {
      setAlerts(INITIAL_ALERTS);
    }
  };

  const registerPushToken = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await upsertFcmToken(token);
      }
    } catch (error) {
      console.warn("푸시 토큰 등록 실패", error);
    }
  };

  const connectStream = () => {
    const nextOfferUrl = buildOfferUrl(urlInput);
    if (!nextOfferUrl) return;
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
    }
    setOfferUrl(nextOfferUrl);
    setStreamMode("monitor");
    setFenceSaveMessage("");
    resetDraft();
    loadFence();
  };

  const loadFence = async () => {
    setIsLoadingFence(true);
    setFenceSaveMessage("위험구역 불러오는 중");

    try {
      const points = await getFence();
      if (points.length >= 3) {
        setZones([
          {
            id: "server-fence",
            name: "위험구역",
            points,
          },
        ]);
        setFenceSaveMessage("등록된 위험구역 불러옴");
      } else {
        setZones([]);
        setFenceSaveMessage("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "위험구역 조회 실패";
      setFenceSaveMessage(message);
    } finally {
      setIsLoadingFence(false);
    }
  };

  const resetDraft = () => {
    setDraftPoints([]);
    draftPointsRef.current = [];
    lastPointRef.current = null;
  };

  const startDrawing = () => {
    if (streamMode !== "monitor") return;
    resetDraft();
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
    }
    setStreamMode("switching-to-drawing");
    switchTimerRef.current = setTimeout(() => {
      setStreamMode("drawing");
    }, 350);
  };

  const stopDrawing = async () => {
    if (streamMode !== "drawing") return;
    const activeZone = zones[0];

    if (activeZone && activeZone.points.length >= 3) {
      setIsSavingFence(true);
      setFenceSaveMessage("위험구역 저장 중");

      try {
        await upsertFence(activeZone.points);
        setFenceSaveMessage("위험구역 저장됨");
      } catch (error) {
        const message = error instanceof Error ? error.message : "위험구역 저장 실패";
        setFenceSaveMessage(message);
        setIsSavingFence(false);
        return;
      } finally {
        setIsSavingFence(false);
      }
    }

    resetDraft();
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
    }
    setStreamMode("switching-to-monitor");
    switchTimerRef.current = setTimeout(() => {
      setStreamMode("monitor");
    }, 350);
  };

  const handleStreamLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStreamSize({ width, height });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isDrawingZone,
        onMoveShouldSetPanResponder: () => isDrawingZone,
        onPanResponderGrant: (event) => {
          if (!streamSize.width || !streamSize.height) return;
          const point = {
            x: clamp(event.nativeEvent.locationX / streamSize.width),
            y: clamp(event.nativeEvent.locationY / streamSize.height),
          };
          lastPointRef.current = point;
          draftPointsRef.current = [point];
          setDraftPoints([point]);
        },
        onPanResponderMove: (event) => {
          if (!streamSize.width || !streamSize.height) return;
          const point = {
            x: clamp(event.nativeEvent.locationX / streamSize.width),
            y: clamp(event.nativeEvent.locationY / streamSize.height),
          };
          const lastPoint = lastPointRef.current;
          const movedEnough =
            !lastPoint ||
            Math.abs(point.x - lastPoint.x) > 0.012 ||
            Math.abs(point.y - lastPoint.y) > 0.012;

          if (movedEnough) {
            lastPointRef.current = point;
            const nextPoints = [...draftPointsRef.current, point];
            draftPointsRef.current = nextPoints;
            setDraftPoints(nextPoints);
          }
        },
        onPanResponderRelease: () => {
          const completedPoints = draftPointsRef.current;
          if (completedPoints.length >= 3) {
            setZones([
              {
                id: String(Date.now()),
                name: "위험구역",
                points: completedPoints,
              },
            ]);
            setFenceSaveMessage("");
          }
          resetDraft();
        },
      }),
    [isDrawingZone, streamSize]
  );

  const serverTone = isCheckingServer ? "checking" : backendStatus.ok ? "online" : "offline";
  const serverColor =
    serverTone === "checking" ? "#B45309" : serverTone === "online" ? "#15803D" : "#B91C1C";
  const serverStatusText = isCheckingServer
    ? "확인 중"
    : backendStatus.ok
    ? "연결됨"
    : backendStatus.message;

  const summaryItems: Array<{
    label: string;
    value: string;
    icon: IconName;
    color: string;
  }> = [
    { label: "긴급", value: String(criticalCount), icon: "alert-octagon", color: "#B91C1C" },
    { label: "주의", value: String(warningCount), icon: "alert-outline", color: "#C2410C" },
    { label: "구역", value: String(zones.length), icon: "vector-polygon", color: "#475569" },
  ];

  if (!offerUrl) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <View style={[styles.connectScreen, { paddingTop: insets.top + 24 }]}>
          <View style={styles.connectIntro}>
            <View style={styles.connectIcon}>
              <MaterialCommunityIcons name="cctv" size={30} color="#334155" />
            </View>
            <Text style={styles.connectTitle}>카메라 연결</Text>
            <Text style={styles.connectDescription}>
              모니터링과 위험구역 지정에 사용할 WebRTC 카메라 주소를 입력하세요.
            </Text>
          </View>

          <View style={styles.connectCard}>
            <Text style={styles.fieldLabel}>카메라 주소</Text>
            <View style={styles.inputBox}>
              <MaterialCommunityIcons name="link-variant" size={19} color="#64748B" />
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                onSubmitEditing={connectStream}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://카메라IP:포트"
                placeholderTextColor="#94A3B8"
                style={styles.urlInput}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카메라 연결 후 메인 화면으로 이동"
              hitSlop={8}
              style={styles.primaryButton}
              onPress={connectStream}
            >
              <Text style={styles.primaryButtonText}>연결하고 시작</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerMain}>
          <View>
            <Text style={styles.headerTitle}>WatchOut</Text>
            <Text style={styles.headerSubtitle}>A구역 조립 라인</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카메라 주소 다시 입력"
            hitSlop={8}
            style={styles.headerAction}
            onPress={() => setOfferUrl("")}
          >
            <MaterialCommunityIcons name="cctv" size={17} color="#334155" />
            <Text style={styles.headerActionText}>카메라 변경</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI 서버 상태 새로고침"
          hitSlop={8}
          style={styles.serverRow}
          onPress={refreshBackendStatus}
        >
          <View style={[styles.serverDot, { backgroundColor: serverColor }]} />
          <Text style={styles.serverLabel}>AI 서버</Text>
          <Text style={[styles.serverValue, { color: serverColor }]} numberOfLines={1}>
            {serverStatusText}
          </Text>
          <MaterialCommunityIcons name="refresh" size={18} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryBar}>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryItem}>
              <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>실시간 카메라</Text>
              <Text style={styles.sectionHint}>{fenceSaveMessage || "카메라 01"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="위험구역 지정 시작"
              hitSlop={8}
              style={styles.iconButton}
              onPress={isSwitchingStream ? undefined : startDrawing}
            >
              <MaterialCommunityIcons name="fullscreen" size={22} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.streamFrame} onLayout={handleStreamLayout}>
            {streamMode === "monitor" && (
              <StreamWebView offerUrl={offerUrl} style={styles.webView} />
            )}
            {isSwitchingStream && (
              <View style={styles.streamSwitching}>
                <Text style={styles.streamSwitchingText}>카메라 연결 전환 중</Text>
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
                    fill="rgba(234, 88, 12, 0.18)"
                    stroke="#EA580C"
                    strokeWidth="3"
                  />
                ))}
              </Svg>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>감지 알림</Text>
              <Text style={styles.sectionHint}>최근 이벤트</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{alerts.length}</Text>
            </View>
          </View>
          <View style={styles.alertList}>
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        </View>
      </ScrollView>

      {streamMode === "drawing" && (
        <View style={styles.fullscreen} onLayout={handleStreamLayout}>
          <StatusBar style="light" hidden />
          <StreamWebView offerUrl={offerUrl} style={styles.webView} />
          <View style={styles.drawLayer} {...panResponder.panHandlers}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${streamSize.width || 1} ${streamSize.height || 1}`}
            >
              {zones.map((zone) => (
                <Polygon
                  key={zone.id}
                  points={toSvgPoints(zone.points, streamSize)}
                  fill="rgba(234, 88, 12, 0.18)"
                  stroke="#EA580C"
                  strokeWidth="3"
                />
              ))}
              {draftPoints.length > 0 && (
                <Polyline
                  points={toSvgPoints(draftPoints, streamSize)}
                  fill="none"
                  stroke="#EA580C"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
              )}
            </Svg>
          </View>

          <View
            style={[
              styles.fullscreenControls,
              { top: insets.top + 14, right: insets.right + 14 },
            ]}
          >
            <Pressable style={styles.fullscreenGhostButton} onPress={() => setZones([])}>
              <MaterialCommunityIcons name="eraser" size={18} color="#E2E8F0" />
              <Text style={styles.fullscreenGhostText}>초기화</Text>
            </Pressable>
            <Pressable
              disabled={isSavingFence}
              style={[
                styles.fullscreenDoneButton,
                isSavingFence && styles.fullscreenDoneButtonDisabled,
              ]}
              onPress={stopDrawing}
            >
              <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
              <Text style={styles.fullscreenDoneText}>
                {isSavingFence ? "저장 중" : "완료"}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.fullscreenHint,
              {
                bottom: insets.bottom + 14,
                left: insets.left + 14,
                right: insets.right + 14,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.fullscreenHintText}>
              {fenceSaveMessage || "영상 위에 손가락으로 구역을 그리세요"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  connectScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  connectIntro: {
    alignItems: "center",
    marginBottom: 24,
  },
  connectIcon: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    height: 58,
    justifyContent: "center",
    marginBottom: 16,
    width: 58,
  },
  connectTitle: {
    color: "#0F172A",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 0,
  },
  connectDescription: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 9,
    maxWidth: 320,
    textAlign: "center",
  },
  connectCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  headerMain: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
  },
  headerSubtitle: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  headerAction: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  headerActionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  serverRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  serverDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  serverLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  serverValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    gap: 14,
    paddingBottom: 34,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  summaryBar: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 56,
    paddingHorizontal: 11,
  },
  summaryValue: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sectionHint: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  streamFrame: {
    aspectRatio: 16 / 9,
    backgroundColor: "#111827",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  webView: {
    flex: 1,
  },
  streamSwitching: {
    alignItems: "center",
    backgroundColor: "#111827",
    flex: 1,
    justifyContent: "center",
  },
  streamSwitchingText: {
    color: "#CBD5E1",
    fontSize: 15,
    fontWeight: "800",
  },
  zoneOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  urlInput: {
    color: "#0F172A",
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 50,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    minWidth: 30,
    paddingHorizontal: 9,
  },
  countBadgeText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
  },
  alertList: {
    gap: 8,
  },
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020617",
    zIndex: 50,
  },
  drawLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  fullscreenControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    zIndex: 10,
  },
  fullscreenGhostButton: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderColor: "rgba(226, 232, 240, 0.38)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  fullscreenGhostText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "800",
  },
  fullscreenDoneButton: {
    alignItems: "center",
    backgroundColor: "#EA580C",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  fullscreenDoneButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  fullscreenDoneText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  fullscreenHint: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    zIndex: 10,
  },
  fullscreenHintText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
