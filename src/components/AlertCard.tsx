import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { DetectionAlert } from "../types";

const ALERT_ICONS: Record<string, string> = {
  "화재·연기 감지": "▲",
  "쓰러짐·낙상 감지": "!",
  "헬멧 미착용 감지": "!",
  "위험구역 침입": "▲",
  "설비 이상": "!",
};

export function AlertCard({ alert }: { alert: DetectionAlert }) {
  const isCritical = alert.severity === "critical";
  const icon = ALERT_ICONS[alert.title] ?? (isCritical ? "▲" : "!");
  const severityLabel = isCritical ? "위험" : "주의";
  const titleColor = isCritical ? "#B71C1C" : "#BF360C";
  const accentColor = isCritical ? "#C62828" : "#E65100";
  const iconBgColor = isCritical ? "#C62828" : "#E65100";
  const badgeColor = isCritical ? "#C62828" : "#E65100";

  return (
    <View style={[styles.card, isCritical ? styles.criticalCard : styles.warningCard]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={[styles.iconWrap, { backgroundColor: iconBgColor }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: titleColor }]}>{alert.title}</Text>
        <Text style={styles.zone}>{alert.zone}</Text>
      </View>
      <View style={styles.right}>
        <View style={[styles.severityBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.severityText}>{severityLabel}</Text>
        </View>
        <Text style={styles.time}>{alert.ago}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
    minHeight: 88,
  },
  criticalCard: {
    backgroundColor: "#FFF5F5",
    borderColor: "#EF5350",
  },
  warningCard: {
    backgroundColor: "#FFF8F0",
    borderColor: "#FF8F00",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  iconText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  body: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  zone: {
    color: "#546E7A",
    fontSize: 15,
    fontWeight: "600",
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  time: {
    color: "#78909C",
    fontSize: 14,
    fontWeight: "600",
  },
});
