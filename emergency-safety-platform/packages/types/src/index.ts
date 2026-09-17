/**
 * Shared contract between the API and the web dashboard.
 * Every enum/name here mirrors a Prisma enum in apps/api/prisma/schema.prisma
 * and a Socket.IO event emitted by apps/api/src/realtime/socket.ts.
 * Keep the three in sync when adding new states or events.
 */

export enum IncidentStatus {
  STANDBY = "STANDBY",
  ACTIVATED = "ACTIVATED",
  EVIDENCE_COLLECTING = "EVIDENCE_COLLECTING",
  TRUSTED_NOTIFIED = "TRUSTED_NOTIFIED",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESPONDING = "RESPONDING",
  ESCALATED = "ESCALATED",
  RESOLVED = "RESOLVED",
  CANCELLED = "CANCELLED",
}

export enum IncidentPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ActivationMethod {
  KEYWORD = "KEYWORD",
  WEARABLE_BUTTON = "WEARABLE_BUTTON",
  PHONE_BUTTON = "PHONE_BUTTON",
  VOICE_SIMULATED = "VOICE_SIMULATED",
  FALL_DETECTION = "FALL_DETECTION",
  SENSOR_TRIGGER = "SENSOR_TRIGGER",
  MANUAL_DEMO = "MANUAL_DEMO",
}

export enum EvidenceType {
  AUDIO = "AUDIO",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  LOCATION = "LOCATION",
  SENSOR = "SENSOR",
  DEVICE_INFO = "DEVICE_INFO",
}

export enum EvidenceStatus {
  RECORDING = "RECORDING",
  PREPARING = "PREPARING",
  UPLOADING = "UPLOADING",
  UPLOADED = "UPLOADED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
  RECEIVED = "RECEIVED",
}

export enum WearableConnectionStatus {
  CONNECTED = "CONNECTED",
  WEAK = "WEAK",
  DISCONNECTED = "DISCONNECTED",
  RECONNECTING = "RECONNECTING",
}

export enum MotionState {
  STATIONARY = "STATIONARY",
  WALKING = "WALKING",
  RUNNING = "RUNNING",
  SUDDEN_MOVEMENT = "SUDDEN_MOVEMENT",
  NO_MOVEMENT = "NO_MOVEMENT",
}

export enum FallState {
  NORMAL = "NORMAL",
  POSSIBLE_FALL = "POSSIBLE_FALL",
  CONFIRMED_FALL = "CONFIRMED_FALL",
}

export enum WearableEventType {
  FALL = "FALL",
  HIGH_HEART_RATE = "HIGH_HEART_RATE",
  EMERGENCY_BUTTON = "EMERGENCY_BUTTON",
  MOVEMENT_DETECTED = "MOVEMENT_DETECTED",
  GPS_UPDATE = "GPS_UPDATE",
  LOW_BATTERY = "LOW_BATTERY",
  DEVICE_DISCONNECTED = "DEVICE_DISCONNECTED",
  DEVICE_RECONNECTED = "DEVICE_RECONNECTED",
}

export enum NotificationType {
  INCIDENT_CREATED = "INCIDENT_CREATED",
  INCIDENT_UPDATED = "INCIDENT_UPDATED",
  INCIDENT_RESOLVED = "INCIDENT_RESOLVED",
  TRUSTED_MEMBER_INVITE = "TRUSTED_MEMBER_INVITE",
  SYSTEM = "SYSTEM",
}

export enum TrustedMemberStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
}

/** Canonical Socket.IO event names. Server emits, web/mobile clients subscribe. */
export const SocketEvents = {
  INCIDENT_CREATED: "incident.created",
  INCIDENT_UPDATED: "incident.updated",
  INCIDENT_STATUS_CHANGED: "incident.status_changed",
  INCIDENT_RESOLVED: "incident.resolved",
  EVIDENCE_RECEIVED: "evidence.received",
  LOCATION_UPDATED: "location.updated",
  NOTIFICATION_CREATED: "notification.created",
  WEARABLE_CONNECTED: "wearable.connected",
  WEARABLE_DISCONNECTED: "wearable.disconnected",
  SENSOR_UPDATED: "sensor.updated",
  FALL_DETECTED: "fall.detected",
  EMERGENCY_BUTTON_PRESSED: "emergency_button.pressed",
  TIMELINE_EVENT: "incident.timeline_event",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface EmergencyKeywordDTO {
  id: string;
  userId: string;
  keyword: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrustedMemberDTO {
  id: string;
  ownerId: string;
  memberUserId: string | null;
  name: string;
  email: string;
  phone: string | null;
  relationship: string;
  priority: number;
  enabled: boolean;
  status: TrustedMemberStatus;
  createdAt: string;
}

export interface LocationDTO {
  id: string;
  incidentId: string | null;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  simulated: boolean;
  capturedAt: string;
}

export interface EvidenceDTO {
  id: string;
  incidentId: string;
  type: EvidenceType;
  status: EvidenceStatus;
  sourceDevice: string;
  simulated: boolean;
  payloadSummary: string;
  sequence: number;
  capturedAt: string;
}

export interface IncidentEventDTO {
  id: string;
  incidentId: string;
  label: string;
  detail: string | null;
  occurredAt: string;
}

export interface WearableDeviceDTO {
  id: string;
  userId: string;
  name: string;
  deviceType: string;
  connectionStatus: WearableConnectionStatus;
  batteryPercent: number;
  heartRateBpm: number | null;
  motionState: MotionState;
  fallState: FallState;
  lastTelemetryAt: string | null;
  simulated: boolean;
}

export interface IncidentDTO {
  id: string;
  userId: string;
  user?: UserDTO;
  activationMethod: ActivationMethod;
  activationDetail: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  acknowledgedById: string | null;
  respondingById: string | null;
  latestLocation?: LocationDTO | null;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  incidentId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  result: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const DEMO_KEYWORD_DEFAULT = "HELP";
