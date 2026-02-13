export type NotificationEventType =
  | 'ZONE_DEFINED'
  | 'BREAK_DETECTED'
  | 'ENTRY_SIGNAL'
  | 'STOP_HIT'
  | 'TARGET_HIT'
  | 'SESSION_ERROR';

export interface NotificationEvent {
  readonly type: NotificationEventType;
  readonly symbol: string;
  readonly timestamp: number;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

export interface NotificationProvider {
  notify(event: NotificationEvent): void;
}
