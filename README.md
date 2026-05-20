# WatchOut App

Expo 기반 React Native 안전 모니터링 앱입니다.

## 주요 기능

- 라즈베리파이 MJPEG 스트림 URL 연결
- WatchOut 백엔드 연결 상태 확인
- 실시간 영상 위 손가락 드래그로 위험구역 지정
- 화재·연기, 낙상, 위험구역 침입 등 위험도별 알림 카드 표시

## 백엔드

```text
https://3.34.177.235.nip.io
```

앱은 실행 시 `/openapi.json`을 호출해 백엔드 연결 상태를 확인합니다.

확인된 엔드포인트:

- `GET /docs`
- `GET /openapi.json`
- `POST /api/auth/login`
- `GET /api/events`
- `GET /api/cameras`
- `POST /api/cameras/{camera_id}/fence`
- `GET /api/upload/presigned-url`

## 실행

```bash
npm install
npm run start
```

앱에서 라즈베리파이 주소를 입력합니다.

```text
http://10.80.162.190:8080/stream
```

`/snapshot` 또는 포트까지만 입력해도 앱이 `/stream` 주소로 보정합니다.

## 라즈베리파이 스트림 조건

앱은 `multipart/x-mixed-replace` 형식의 JPEG 스트림을 WebView에서 렌더링합니다. 사용자가 제공한 Python 서버의 `/stream` 엔드포인트와 맞습니다.

위험구역 좌표는 영상 영역 기준 0~1 사이의 정규화 좌표로 저장되므로, 이후 서버로 전송해 카메라 해상도와 무관하게 사용할 수 있습니다.
