/**
 * GridPulse WebRTC Direct P2P Telemetry Engine
 * Establishes an end-to-end encrypted, zero-cloud RTCDataChannel
 * directly between the player's gaming PC and phone browser.
 */

export interface WebRtcOptions {
  bridgeUrl?: string;
  pairingCode?: string;
  onTelemetry: (data: any) => void;
  onStateChange: (state: RTCPeerConnectionState | 'channel_open' | 'error' | 'disconnected') => void;
  onLatency?: (rttMs: number) => void;
  onTransportInfo?: (info: { isDirectP2P: boolean; candidateType: string }) => void;
}

const SIGNALING_URL_BASE = 'https://ntfy.sh';

export class WebRtcTelemetryClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private bridgeUrl: string;
  private pairingCode?: string;
  private onTelemetry: (data: any) => void;
  private onStateChange: (state: RTCPeerConnectionState | 'channel_open' | 'error' | 'disconnected') => void;
  private onLatency?: (rttMs: number) => void;
  private onTransportInfo?: (info: { isDirectP2P: boolean; candidateType: string }) => void;
  private isDestroyed = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: WebRtcOptions) {
    this.bridgeUrl = (options.bridgeUrl || '').replace(/\/$/, '');
    this.pairingCode = options.pairingCode ? options.pairingCode.replace(/\s+/g, '') : undefined;
    this.onTelemetry = options.onTelemetry;
    this.onStateChange = options.onStateChange;
    this.onLatency = options.onLatency;
    this.onTransportInfo = options.onTransportInfo;
  }

  public async connect(): Promise<void> {
    this.isDestroyed = false;
    this.cleanup();

    try {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      this.pc.onconnectionstatechange = () => {
        if (this.pc && !this.isDestroyed) {
          const state = this.pc.connectionState;
          this.onStateChange(state);
          if (state === 'connected') {
            this.checkTransportStats();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            this.stopPing();
          }
        }
      };

      // Unordered, zero-retransmission data channel for minimal telemetry jitter (<1ms)
      this.dc = this.pc.createDataChannel('telemetry', {
        ordered: false,
        maxRetransmits: 0
      });

      this.dc.onopen = () => {
        if (!this.isDestroyed) {
          this.onStateChange('channel_open');
          this.startPing();
          this.checkTransportStats();
        }
      };

      this.dc.onclose = () => {
        this.stopPing();
        if (!this.isDestroyed) {
          this.onStateChange('disconnected');
        }
      };

      this.dc.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data.startsWith('__pong__:')) {
          const sentTs = Number(event.data.split(':', 2)[1]);
          if (!isNaN(sentTs)) {
            const rtt = Math.max(0.1, Date.now() - sentTs);
            if (this.onLatency && !this.isDestroyed) {
              this.onLatency(rtt);
            }
          }
          return;
        }

        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          this.onTelemetry(payload);
        } catch {}
      };

      // Create SDP Offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Wait for local ICE candidates (up to 1.5s max)
      await this.waitForIceGathering();

      const localSdp = this.pc.localDescription;
      if (!localSdp) throw new Error('Failed to generate local SDP offer');

      // Exchange SDP: Path A (Direct Local API) or Path B (Cloud Signaling Broker)
      let answerSdp: RTCSessionDescriptionInit;

      if (this.bridgeUrl && (this.bridgeUrl.includes('localhost') || this.bridgeUrl.includes('127.0.0.1') || window.location.protocol === 'http:')) {
        // Direct local HTTP signaling
        const res = await fetch(`${this.bridgeUrl}/api/webrtc/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: localSdp.sdp, type: localSdp.type })
        });
        if (!res.ok) throw new Error(`Bridge rejected offer: ${res.statusText}`);
        answerSdp = await res.json();
      } else if (this.pairingCode) {
        // Ephemeral Control Plane Signaling via room pairing code
        answerSdp = await this.exchangeSignalingViaBroker(localSdp);
      } else {
        // Fallback to direct fetch
        const res = await fetch(`${this.bridgeUrl || 'http://localhost:8000'}/api/webrtc/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: localSdp.sdp, type: localSdp.type })
        });
        if (!res.ok) throw new Error(`Bridge rejected offer: ${res.statusText}`);
        answerSdp = await res.json();
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));

    } catch (err) {
      if (!this.isDestroyed) {
        this.onStateChange('error');
      }
    }
  }

  private async exchangeSignalingViaBroker(offer: RTCSessionDescription): Promise<RTCSessionDescriptionInit> {
    const code = this.pairingCode!;
    const offerTopic = `gridpulse-sig-offer-${code}`;
    const answerTopic = `gridpulse-sig-answer-${code}`;

    // 1. Post offer to broker
    await fetch(`${SIGNALING_URL_BASE}/${offerTopic}`, {
      method: 'POST',
      headers: { 'Title': 'SDP-Offer', 'Priority': 'high' },
      body: JSON.stringify({ sdp: offer.sdp, type: offer.type })
    });

    // 2. Poll for answer
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      try {
        const resp = await fetch(`${SIGNALING_URL_BASE}/${answerTopic}/json?poll=1`);
        if (resp.ok) {
          const text = await resp.text();
          const lines = text.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            if (data.message) {
              const parsed = JSON.parse(data.message);
              if (parsed.type === 'answer') {
                return parsed;
              }
            }
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error('Signaling handshake timed out');
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.dc && this.dc.readyState === 'open') {
        try {
          this.dc.send(`__ping__:${Date.now()}`);
        } catch {}
      }
    }, 1000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async checkTransportStats(): Promise<void> {
    if (!this.pc || this.isDestroyed) return;
    try {
      const stats = await this.pc.getStats();
      let isDirect = false;
      let candidateType = 'host';

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const remoteCandidate = stats.get(report.remoteCandidateId);
          if (remoteCandidate) {
            candidateType = remoteCandidate.candidateType || 'host';
            isDirect = candidateType === 'host' || candidateType === 'srflx' || candidateType === 'prflx';
          }
        }
      });

      if (this.onTransportInfo) {
        this.onTransportInfo({ isDirectP2P: isDirect, candidateType });
      }
    } catch {}
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const check = () => {
        if (!this.pc || this.pc.iceGatheringState === 'complete') {
          this.pc?.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };

      this.pc.addEventListener('icegatheringstatechange', check);
      setTimeout(() => resolve(), 1500);
    });
  }

  public cleanup(): void {
    this.isDestroyed = true;
    this.stopPing();
    if (this.dc) {
      try { this.dc.close(); } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
  }
}
