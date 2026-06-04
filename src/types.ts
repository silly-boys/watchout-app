export type Point = {
  x: number;
  y: number;
};

export type Zone = {
  id: string;
  name: string;
  points: Point[];
};

export type AlertSeverity = "critical" | "warning";

export type DetectionAlert = {
  id: string;
  title: string;
  zone: string;
  ago: string;
  severity: AlertSeverity;
  count?: number;
};
