// Minimal typings for @m-lab/ndt7 (the package ships plain JS).
declare module "@m-lab/ndt7" {
  export type ClientMeasurement = { ElapsedTime: number; NumBytes: number; MeanClientMbps: number };
  export type ServerMeasurement = {
    ConnectionInfo?: { Client?: string; Server?: string; UUID?: string };
    BBRInfo?: { BW?: number; MinRTT?: number };
    TCPInfo?: { MinRTT?: number; RTT?: number; BytesAcked?: number; BytesReceived?: number; ElapsedTime?: number; BusyTime?: number };
  };
  export type Measurement = { Source: "client"; Data: ClientMeasurement } | { Source: "server"; Data: ServerMeasurement };
  export type Complete = { LastClientMeasurement?: ClientMeasurement; LastServerMeasurement?: ServerMeasurement };
  export type LocateResult = { machine?: string; location?: { city?: string; country?: string }; urls: Record<string, string> };

  export type Config = {
    userAcceptedDataPolicy?: boolean;
    mlabDataPolicyInapplicable?: boolean;
    server?: string;
    protocol?: "wss" | "ws";
    loadbalancer?: string;
    clientRegistrationToken?: string;
    metadata?: Record<string, string>;
    downloadworkerfile?: string;
    uploadworkerfile?: string;
  };
  export type Callbacks = {
    error?: (msg: string) => void;
    serverDiscovery?: (d: { loadbalancer: URL }) => void;
    serverChosen?: (server: LocateResult) => void;
    downloadStart?: (d: unknown) => void;
    downloadMeasurement?: (m: Measurement) => void;
    downloadComplete?: (c: Complete) => void;
    uploadStart?: (d: unknown) => void;
    uploadMeasurement?: (m: Measurement) => void;
    uploadComplete?: (c: Complete) => void;
  };
  const ndt7: { test: (config: Config, callbacks: Callbacks) => Promise<number> };
  export default ndt7;
}
