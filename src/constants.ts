import { DetectionAlert } from "./types";

export const DEFAULT_STREAM_URL = "http://10.80.162.190:8080";

export const BACKEND_BASE_URL = "http://10.80.162.190:8000";

export const INITIAL_ALERTS: DetectionAlert[] = [
  {
    id: "1",
    title: "화재·연기 감지",
    zone: "A구역",
    ago: "2분전",
    severity: "critical",
  },
  {
    id: "2",
    title: "쓰러짐·낙상 감지",
    zone: "A구역",
    ago: "30초전",
    severity: "critical",
  },
  {
    id: "3",
    title: "헬멧 미착용 감지",
    zone: "A 구역",
    ago: "5분전",
    severity: "warning",
  },
  {
    id: "4",
    title: "위험구역 침입",
    zone: "A 구역",
    ago: "8분전",
    severity: "warning",
  },
  {
    id: "5",
    title: "설비 이상",
    zone: "A 구역",
    ago: "9분전",
    severity: "warning",
  },
];
