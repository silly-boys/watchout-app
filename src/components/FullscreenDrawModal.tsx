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
  streamUrl: string;
  initialZones: Zone[];
  onDone: (zones: Zone[]) => void;
  onCancel: () => void;
};

export function FullscreenDrawModal({
  visible,
  streamUrl,
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
        {streamUrl ? (
          <StreamWebView streamUrl={streamUrl} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.emptyStream}>
            <Text style={styles.emptyStreamText}>스트림 연결 후 지정하세요</Text>
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
                fill="rgba(255, 149, 0, 0.28)"
                stroke="#ff3b30"
                strokeWidth="3"
              />
            ))}
            {draftPoints.length > 0 && (
              <Polyline
                points={toSvgPoints(draftPoints, containerSize)}
                fill="none"
                stroke="#ff3b30"
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
            styles.hint,
            { bottom: insets.bottom + 12, left: insets.left + 16 },
          ]}
        >
          <Text style={styles.hintText}>
            손가락으로 위험구역을 드래그해 그려주세요
          </Text>
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
    backgroundColor: "#8f8f8f",
  },
  emptyStreamText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  controls: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ghostBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  ghostBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  doneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#ff3b30",
  },
  doneBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  hint: {
    position: "absolute",
  },
  hintText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
});
