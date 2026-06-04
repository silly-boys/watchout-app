import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { DetectionAlert } from "../types";

const ALERT_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  "화재·연기 감지": "fire-alert",
  "쓰러짐·낙상 감지": "human-cane",
  "헬멧 미착용 감지": "hard-hat",
  "위험구역 침입": "map-marker-alert",
  "설비 이상": "cog-outline",
};

export function AlertCard({ alert }: { alert: DetectionAlert }) {
  const isCritical = alert.severity === "critical";
  const icon = ALERT_ICONS[alert.title] ?? "alert-outline";
  const severityLabel = isCritical ? "긴급" : "주의";
  const accentColor = isCritical ? "#B91C1C" : "#C2410C";
  const iconBackground = isCritical ? "#FEE2E2" : "#FFEDD5";

  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <MaterialCommunityIcons name={icon} size={22} color={accentColor} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {alert.title}
          </Text>
          {alert.count && alert.count > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{alert.count}</Text>
            </View>
          )}
          <View style={[styles.severityBadge, { backgroundColor: iconBackground }]}>
            <Text style={[styles.severityText, { color: accentColor }]}>{severityLabel}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.zone}>{alert.zone}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.time}>{alert.ago}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 72,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accent: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    marginLeft: 3,
    width: 42,
  },
  body: {
    flex: 1,
    gap: 7,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  title: {
    color: "#0F172A",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  severityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 7,
  },
  countText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  severityText: {
    fontSize: 12,
    fontWeight: "800",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  zone: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  metaDot: {
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  time: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
});
