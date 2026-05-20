import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { DetectionAlert } from "../types";

export function AlertCard({ alert }: { alert: DetectionAlert }) {
  const isCritical = alert.severity === "critical";

  return (
    <View
      style={[
        styles.alertCard,
        isCritical ? styles.criticalAlert : styles.warningAlert,
      ]}
    >
      <View
        style={[
          styles.alertIcon,
          isCritical ? styles.criticalIcon : styles.warningIcon,
        ]}
      >
        <Text style={styles.alertIconText}>▲</Text>
      </View>
      <View style={styles.alertBody}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertZone}>{alert.zone}</Text>
      </View>
      <Text style={styles.alertTime}>{alert.ago}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    paddingHorizontal: 10,
    gap: 12,
  },
  criticalAlert: {
    backgroundColor: "#f7bbb8",
    borderColor: "#ff3b30",
  },
  warningAlert: {
    backgroundColor: "#ffdca8",
    borderColor: "#ff9500",
  },
  alertIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  criticalIcon: {
    backgroundColor: "#f24a3d",
  },
  warningIcon: {
    backgroundColor: "#f9a014",
  },
  alertIconText: {
    color: "#ffffff",
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 32,
  },
  alertBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  alertTitle: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },
  alertZone: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },
  alertTime: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },
});
