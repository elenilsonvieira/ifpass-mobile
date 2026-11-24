/**
 * Barramento de Sincronização NFC Simulada em Tempo Real (iPhone <-> Android via Expo Go)
 *
 * Usa WebSocket MQTT 3.1.1 puro (sem dependências externas) em dois brokers públicos
 * simultâneos para funcionar instantaneamente entre iPhone e Android em qualquer rede
 * (Wi-Fi, 4G/5G) diretamente no Expo Go.
 */

export interface CredencialAluno {
  nome: string;
  matricula: string;
  curso: string;
  instituicao: string;
}

export type MensagemNFC =
  | {
      type: 'CATRACA_HEARTBEAT';
      msgId: string;
      senderId: string;
      modo: 'liberar' | 'recusar';
      timestamp: number;
    }
  | {
      type: 'ALUNO_PING';
      msgId: string;
      senderId: string;
      timestamp: number;
    }
  | {
      type: 'NFC_ARMED';
      msgId: string;
      senderId: string;
      requestId: string;
      aluno: CredencialAluno;
      timestamp: number;
    }
  | {
      type: 'NFC_DISARMED';
      msgId: string;
      senderId: string;
      timestamp: number;
    }
  | {
      type: 'CATRACA_PROXIMITY_TRIGGER';
      msgId: string;
      senderId: string;
      requestId: string;
      timestamp: number;
    }
  | {
      type: 'NFC_SEND_CREDENTIAL';
      msgId: string;
      senderId: string;
      requestId: string;
      aluno: CredencialAluno;
      timestamp: number;
    }
  | {
      type: 'CATRACA_DECISION';
      msgId: string;
      senderId: string;
      requestId: string;
      matricula: string;
      resultado: 'liberado' | 'negado';
      motivo?: string;
      horario: string;
      timestamp: number;
    }
  | {
      type: 'SYSTEM_RESET';
      msgId: string;
      senderId: string;
      timestamp: number;
    };

const MQTT_TOPIC = 'ifpass/guarabira/nfc/expo-go/v3';
const BROKERS_WSS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

function stringToUtf8Bytes(str: string): number[] {
  const utf8 = unescape(encodeURIComponent(str));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }
  return bytes;
}

function utf8BytesToString(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

function encodeRemainingLength(length: number): number[] {
  const bytes: number[] = [];
  do {
    let encodedByte = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) {
      encodedByte = encodedByte | 128;
    }
    bytes.push(encodedByte);
  } while (length > 0);
  return bytes;
}

function decodeRemainingLength(
  data: Uint8Array,
  offset: number
): { value: number; bytesUsed: number } {
  let multiplier = 1;
  let value = 0;
  let bytesUsed = 0;
  let encodedByte = 0;
  do {
    if (offset + bytesUsed >= data.length) break;
    encodedByte = data[offset + bytesUsed];
    value += (encodedByte & 127) * multiplier;
    multiplier *= 128;
    bytesUsed++;
  } while ((encodedByte & 128) !== 0 && bytesUsed < 4);
  return { value, bytesUsed };
}

function buildMqttConnectPacket(clientId: string): Uint8Array {
  const clientBytes = stringToUtf8Bytes(clientId);
  const varHeader = [
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // "MQTT"
    0x04, // MQTT 3.1.1
    0x02, // Clean Session
    0x00, 0x1e, // Keep-Alive 30s
  ];
  const payload = [
    (clientBytes.length >> 8) & 0xff,
    clientBytes.length & 0xff,
    ...clientBytes,
  ];
  const remLen = encodeRemainingLength(varHeader.length + payload.length);
  return new Uint8Array([0x10, ...remLen, ...varHeader, ...payload]);
}

function buildMqttSubscribePacket(topic: string): Uint8Array {
  const topicBytes = stringToUtf8Bytes(topic);
  const varHeader = [0x00, 0x01];
  const payload = [
    (topicBytes.length >> 8) & 0xff,
    topicBytes.length & 0xff,
    ...topicBytes,
    0x00,
  ];
  const remLen = encodeRemainingLength(varHeader.length + payload.length);
  return new Uint8Array([0x82, ...remLen, ...varHeader, ...payload]);
}

function buildMqttPublishPacket(topic: string, messageJson: string): Uint8Array {
  const topicBytes = stringToUtf8Bytes(topic);
  const msgBytes = stringToUtf8Bytes(messageJson);
  const varHeader = [
    (topicBytes.length >> 8) & 0xff,
    topicBytes.length & 0xff,
    ...topicBytes,
  ];
  const remLen = encodeRemainingLength(varHeader.length + msgBytes.length);
  return new Uint8Array([0x30, ...remLen, ...varHeader, ...msgBytes]);
}

export class NfcSyncBus {
  private senderId: string;
  private onMessageCallback: (msg: MensagemNFC) => void;
  private onStatusChangeCallback?: (conectado: boolean) => void;
  private seenMsgIds = new Set<string>();
  private sockets: WebSocket[] = [];
  private socketsConnected = new Set<WebSocket>();
  private running = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    role: 'usuario' | 'catraca',
    onMessage: (msg: MensagemNFC) => void,
    onStatusChange?: (conectado: boolean) => void
  ) {
    this.senderId = `${role}_${Math.random().toString(36).substring(2, 9)}`;
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
  }

  public start() {
    if (this.running) return;
    this.running = true;

    this.connectWebSockets();

    this.pingTimer = setInterval(() => {
      const pingPacket = new Uint8Array([0xc0, 0x00]);
      this.socketsConnected.forEach((ws) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pingPacket);
          }
        } catch {}
      });
    }, 18000);

    this.reconnectTimer = setInterval(() => {
      if (!this.running) return;
      if (this.socketsConnected.size === 0) {
        this.connectWebSockets();
      }
    }, 5000);
  }

  public stop() {
    this.running = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    this.sockets.forEach((ws) => {
      try {
        ws.close();
      } catch {}
    });
    this.sockets = [];
    this.socketsConnected.clear();
  }

  private updateStatus() {
    this.onStatusChangeCallback?.(this.socketsConnected.size > 0);
  }

  private connectWebSockets() {
    this.sockets.forEach((ws) => {
      try {
        ws.close();
      } catch {}
    });
    this.sockets = [];
    this.socketsConnected.clear();

    BROKERS_WSS.forEach((brokerUrl, index) => {
      try {
        const ws = new WebSocket(brokerUrl, 'mqtt');
        ws.binaryType = 'arraybuffer';
        this.sockets.push(ws);

        ws.onopen = () => {
          if (!this.running) return;
          try {
            const clientId = `ifpass_${this.senderId}_${index}_${Date.now() % 10000}`;
            ws.send(buildMqttConnectPacket(clientId));
          } catch {}
        };

        ws.onmessage = (event) => {
          if (!this.running || !event.data) return;
          try {
            const data = new Uint8Array(event.data as ArrayBuffer);
            let offset = 0;

            while (offset < data.length) {
              const packetType = data[offset] & 0xf0;
              const { value: remLen, bytesUsed } = decodeRemainingLength(data, offset + 1);
              const packetStart = offset + 1 + bytesUsed;
              const packetEnd = packetStart + remLen;

              if (packetType === 0x20) {
                this.socketsConnected.add(ws);
                this.updateStatus();
                ws.send(buildMqttSubscribePacket(MQTT_TOPIC));
              } else if (packetType === 0x30) {
                const qos = (data[offset] & 0x06) >> 1;
                const topicLen = (data[packetStart] << 8) | data[packetStart + 1];
                let payloadStart = packetStart + 2 + topicLen;
                if (qos > 0) payloadStart += 2;

                if (payloadStart <= packetEnd && packetEnd <= data.length) {
                  const payloadBytes = data.subarray(payloadStart, packetEnd);
                  const jsonStr = utf8BytesToString(payloadBytes);
                  this.handleIncoming(jsonStr);
                }
              }

              offset = packetEnd;
              if (bytesUsed === 0) break;
            }
          } catch {}
        };

        ws.onerror = () => {
          this.socketsConnected.delete(ws);
          this.updateStatus();
        };

        ws.onclose = () => {
          this.socketsConnected.delete(ws);
          this.updateStatus();
        };
      } catch {}
    });
  }

  private handleIncoming(jsonStr: string) {
    try {
      const msg = JSON.parse(jsonStr) as MensagemNFC;
      if (!msg || !msg.msgId || !msg.type) return;
      if (msg.senderId === this.senderId) return;
      if (this.seenMsgIds.has(msg.msgId)) return;

      this.seenMsgIds.add(msg.msgId);
      if (this.seenMsgIds.size > 300) {
        const first = this.seenMsgIds.values().next().value;
        if (first) this.seenMsgIds.delete(first);
      }

      this.onMessageCallback(msg);
    } catch {}
  }

  public publish(
    partial:
      | Omit<Extract<MensagemNFC, { type: 'CATRACA_HEARTBEAT' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'ALUNO_PING' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'NFC_ARMED' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'NFC_DISARMED' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'CATRACA_PROXIMITY_TRIGGER' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'NFC_SEND_CREDENTIAL' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'CATRACA_DECISION' }>, 'msgId' | 'senderId' | 'timestamp'>
      | Omit<Extract<MensagemNFC, { type: 'SYSTEM_RESET' }>, 'msgId' | 'senderId' | 'timestamp'>
  ) {
    const fullMsg: MensagemNFC = {
      ...partial,
      msgId: `${this.senderId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: this.senderId,
      timestamp: Date.now(),
    } as MensagemNFC;

    const packet = buildMqttPublishPacket(MQTT_TOPIC, JSON.stringify(fullMsg));
    this.socketsConnected.forEach((ws) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(packet);
        }
      } catch {}
    });
  }
}
