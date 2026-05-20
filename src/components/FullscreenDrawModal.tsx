import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StreamWebView } from "./StreamWebView";
import { Zone, Point } from "../types";
import { clamp, toSvgPoints } from "../utils";

type Props = {
  visible: boolean;
  offerUrl: string;
  initialZones: Zone[];
  onDone: (zones: Zone[]) => void;
  onCancel: () => void;
};

export function FullscreenDrawModal({
  visible,
  offerUrl,
  initialZones,
  onDone,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState<Zone[]>([]);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const lastPointRef = useRef<Point | null>(null);
  const draftPointsRef = useRef<Point[]>([]);

  useEffect(() => {
    if (visible) {
      setZones(initialZones);
      setDraftPoints([]);
      draftPointsRef.current = [];
      lastPointRef.current = null;
    }
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          if (!containerSize.width || !containerSize.height) return;
          const point = {
            x: event.nativeEvent.locationX / containerSize.width,
            y: event.nativeEvent.locationY / containerSize.height,
          };
          lastPointRef.current = point;
          draftPointsRef.current = [point];
          setDraftPoints([point]);
        },
        onPanResponderMove: (event) => {
          if (!containerSize.width || !containerSize.height) return;
          const point = {
            x: clamp(event.nativeEvent.locationX / containerSize.width),
            y: clamp(event.nativeEvent.locationY / containerSize.height),
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
            setZones((current) => [
              ...current,
              {
                id: String(Date.now()),
                name: `${String.fromCharCode(65 + current.length)} 구역`,
                points: completedPoints,
              },
            ]);
          }
          setDraftPoints([]);
          draftPointsRef.current = [];
          lastPointRef.current = null;
        },
      }),
    [containerSize]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleClear = () => {
    setZones([]);
    setDraftPoints([]);
    draftPointsRef.current = [];
    lastPointRef.current = null;
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <StatusBar style="light" hidden />
      <View style={styles.container} onLayout={handleLayout}>
        {offerUrl ? (
          <StreamWebView offerUrl={offerUrl} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.emptyStream}>
            <Text style={styles.emptyStreamText}>카메라를 연결한 후 구역을 지정하세요</Text>
          </View>
        )}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${containerSize.width || 1} ${containerSize.height || 1}`}
          >
            {zones.map((zone) => (
              <Polygon
                key={zone.id}
                points={toSvgPoints(zone.points, containerSize)}
                fill="rgba(255, 109, 0, 0.25)"
                stroke="#FF6D00"
                strokeWidth="3"
              />
            ))}
            {draftPoints.length > 0 && (
              <Polyline
                points={toSvgPoints(draftPoints, containerSize)}
                fill="none"
                stroke="#FF6D00"
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
            styles.controls,
            { top: Math.max(insets.top, 16), right: insets.right + 16 },
          ]}
        >
          <Pressable style={styles.ghostBtn} onPress={handleClear}>
            <Text style={styles.ghostBtnText}>초기화</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onCancel}>
            <Text style={styles.ghostBtnText}>취소</Text>
          </Pressable>
          <Pressable style={styles.doneBtn} onPress={() => onDone(zones)}>
            <Text style={styles.doneBtnText}>완료</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.hintWrap,
            { bottom: insets.bottom + 20, left: insets.left + 16, right: insets.right + 16 },
          ]}
        >
          <Text style={styles.hintText}>
            손가락으로 위험구역을 따라 드래그해 그려주세요
          </Text>
          {zones.length > 0 && (
            <Text style={styles.zoneCount}>
              {zones.length}개 구역 지정됨
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  emptyStream: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A2E",
    padding: 24,
  },
  emptyStreamText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  controls: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ghostBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 8,
  },
  ghostBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#1B3A6B",
    borderRadius: 8,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  hintWrap: {
    position: "absolute",
    alignItems: "center",
    gap: 6,
  },
  hintText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  zoneCount: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    backgroundColor: "#1B3A6B",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
  },
});
