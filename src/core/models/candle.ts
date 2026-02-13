export type Candle = {
  readonly timestamp: number;    // UTC ms, bar START time
  readonly open: number;         // int cents
  readonly high: number;         // int cents
  readonly low: number;          // int cents
  readonly close: number;        // int cents
  readonly volume: number;
  readonly completed: boolean;
  readonly barSizeMinutes: 5;
};
