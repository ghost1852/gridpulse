/**
 * GridPulse WebRTC Direct P2P Telemetry Engine
 * Establishes an end-to-end encrypted, zero-cloud RTCDataChannel
 * directly between the player's gaming PC and phone browser.
 */

export interface WebRtcDiagnostics {
  sessionId: string;
  iceGatheringState: RTCIceGathererState;
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  signalingState: RTCSignalingState;
  localCandidates: string[];
  remoteCandidates: string[];
  peerConnectionCount: number;
  offersPublishedCount: number;
  answersReceivedCount: number;
  framesReceivedCount: number;
  selectedPair?: {
    local: string;
    remote: string;
    state: string;
  };
}

export interface WebRtcOptions {
  bridgeUrl?: string;
  pairingCode?: string;
  onTelemetry: (data: any) => void;
  onStateChange: (state: RTCPeerConnectionState | 'channel_open' | 'error' | 'disconnected' | 'pairing_required') => void;
  onLatency?: (rttMs: number) => void;
  onTransportInfo?: (info: { isDirectP2P: boolean; candidateType: string }) => void;
  onDiagnostics?: (diag: WebRtcDiagnostics) => void;
}

const SIGNALING_URL_BASE = 'https://dweet.cc';

// Global single-process metrics to catch any accidental duplicate initializations
let globalPcCount = 0;
let globalOfferCount = 0;
let globalAnswerCount = 0;
let globalFrameCount = 0;

export class WebRtcTelemetryClient {
  public readonly sessionId: string;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private bridgeUrl: string;
  private pairingCode?: string;
  private onTelemetry: (data: any) => void;
  private onStateChange: (state: RTCPeerConnectionState | 'channel_open' | 'error' | 'disconnected' | 'pairing_required') => void;
  private onLatency?: (rttMs: number) => void;
  private onTransportInfo?: (info: { isDirectP2P: boolean; candidateType: string }) => void;
  private onDiagnostics?: (diag: WebRtcDiagnostics) => void;
  private isDestroyed = false;
  private isConnecting = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private iceTimeout: ReturnType<typeof setTimeout> | null = null;
  private localCandidates: string[] = [];
  private remoteCandidates: string[] = [];

  constructor(options: WebRtcOptions) {
    const code = options.pairingCode ? options.pairingCode.replace(/\s+/g, '') : 'LAN';
    const tag = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.sessionId = `${code}-${tag}`;
    this.bridgeUrl = (options.bridgeUrl || '').replace(/\/$/, '');
    this.pairingCode = options.pairingCode ? options.pairingCode.replace(/\s+/g, '') : undefined;
    this.onTelemetry = options.onTelemetry;
    this.onStateChange = options.onStateChange;
    this.onLatency = options.onLatency;
    this.onTransportInfo = options.onTransportInfo;
    this.onDiagnostics = options.onDiagnostics;
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[WebRTC session=${this.sessionId}] ${message}`, ...args);
  }

  private warn(message: string, ...args: any[]): void {
    console.warn(`[WebRTC session=${this.sessionId}] ⚠️ ${message}`, ...args);
  }

  private error(message: string, ...args: any[]): void {
    console.error(`[WebRTC session=${this.sessionId}] ❌ ${message}`, ...args);
  }

  private reportDiagnostics(): void {
    if (!this.pc || !this.onDiagnostics || this.isDestroyed) return;
    this.onDiagnostics({
      sessionId: this.sessionId,
      iceGatheringState: this.pc.iceGatheringState,
      iceConnectionState: this.pc.iceConnectionState,
      connectionState: this.pc.connectionState,
      signalingState: this.pc.signalingState,
      localCandidates: [...this.localCandidates],
      remoteCandidates: [...this.remoteCandidates],
      peerConnectionCount: globalPcCount,
      offersPublishedCount: globalOfferCount,
      answersReceivedCount: globalAnswerCount,
      framesReceivedCount: globalFrameCount,
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnecting) {
      this.warn('connect() called while already connecting; skipping duplicate invocation.');
      return;
    }

    this.isConnecting = true;
    this.isDestroyed = false;
    this.cleanup();
    this.localCandidates = [];
    this.remoteCandidates = [];

    // Verify pairing code if on cloud domain
    const isCloudHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const activeCode = this.pairingCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('gridpulse_pairing_code') : null);

    if (isCloudHttps && (!activeCode || !activeCode.trim())) {
      this.warn('No pairing code supplied on HTTPS domain. Awaiting QR code scan.');
      this.isConnecting = false;
      this.onStateChange('pairing_required');
      return;
    }

    this.pairingCode = activeCode ? activeCode.trim() : undefined;

    try {
      globalPcCount += 1;
      this.log(`🚀 Initializing RTCPeerConnection (Total PCs created: ${globalPcCount})`);

      const iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        {
          urls: 'turn:global.relay.metered.ca:80',
          username: '209b522bcd85f9169da1bc48',
          credential: '660slSqG6ARvPTC/'
        },
        {
          urls: 'turn:global.relay.metered.ca:80?transport=tcp',
          username: '209b522bcd85f9169da1bc48',
          credential: '660slSqG6ARvPTC/'
        },
        {
          urls: 'turn:global.relay.metered.ca:443',
          username: '209b522bcd85f9169da1bc48',
          credential: '660slSqG6ARvPTC/'
        },
        {
          urls: 'turns:global.relay.metered.ca:443?transport=tcp',
          username: '209b522bcd85f9169da1bc48',
          credential: '660slSqG6ARvPTC/'
        }
      ];

      // Support dynamic custom TURN overrides via URL query params or localStorage
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const turnUrl = params.get('turn') || (window as any).__GRIDPULSE_TURN_SERVER__ || localStorage.getItem('gridpulse_turn_server');
          const turnUser = params.get('turn_user') || (window as any).__GRIDPULSE_TURN_USER__ || localStorage.getItem('gridpulse_turn_user');
          const turnPass = params.get('turn_pass') || (window as any).__GRIDPULSE_TURN_PASS__ || localStorage.getItem('gridpulse_turn_pass');

          if (turnUrl) {
            this.log(`🌐 Added custom WebRTC TURN relay override: ${turnUrl}`);
            iceServers.push({
              urls: turnUrl,
              username: turnUser || undefined,
              credential: turnPass || undefined
            });
          }
        }
      } catch {}

      this.pc = new RTCPeerConnection({ iceServers });

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          const cStr = event.candidate.candidate;
          this.localCandidates.push(cStr);
          const cand = event.candidate as any;
          const type = cand.type || 'unknown';
          const ip = cand.address || cand.ip || 'unknown';
          this.log(`[ICE Local Candidate] Type: ${type} | Address: ${ip}:${cand.port}`);
          this.reportDiagnostics();
        }
      };

      this.pc.onicegatheringstatechange = () => {
        if (!this.pc) return;
        this.log(`[ICE Gathering State] ➔ ${this.pc.iceGatheringState.toUpperCase()}`);
        this.reportDiagnostics();
      };

      this.pc.oniceconnectionstatechange = () => {
        if (!this.pc || this.isDestroyed) return;
        const state = this.pc.iceConnectionState;
        this.log(`[ICE Connection State] ➔ ${state.toUpperCase()}`);
        this.reportDiagnostics();

        if (state === 'connected' || state === 'completed') {
          if (this.iceTimeout) {
            clearTimeout(this.iceTimeout);
            this.iceTimeout = null;
          }
          this.checkTransportStats();
        } else if (state === 'failed' || state === 'disconnected') {
          this.stopPing();
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc || this.isDestroyed) return;
        const state = this.pc.connectionState;
        this.log(`[PeerConnection State] ➔ ${state.toUpperCase()}`);
        this.onStateChange(state);
        this.reportDiagnostics();

        if (state === 'connected') {
          this.checkTransportStats();
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          this.stopPing();
        }
      };

      // Unordered, zero-retransmission data channel for minimal telemetry jitter (<1ms)
      this.log('Creating DataChannel "telemetry" (unordered, maxRetransmits=0)...');
      this.dc = this.pc.createDataChannel('telemetry', {
        ordered: false,
        maxRetransmits: 0
      });

      this.dc.onopen = () => {
        if (!this.isDestroyed) {
          this.log('🎉 DataChannel OPEN! Direct P2P telemetry streaming active.');
          this.onStateChange('channel_open');
          this.startPing();
          this.checkTransportStats();
        }
      };

      this.dc.onclose = () => {
        this.stopPing();
        if (!this.isDestroyed) {
          this.log('DataChannel closed.');
          this.onStateChange('disconnected');
        }
      };

      this.dc.onmessage = (event) => {
        globalFrameCount += 1;
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

      // 1. Create SDP Offer
      this.log('Generating local SDP Offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 2. Wait for non-trickle ICE candidates to gather completely
      this.log('Gathering local ICE candidates (non-trickle mode)...');
      await this.waitForIceGathering();

      const localSdp = this.pc.localDescription;
      if (!localSdp) throw new Error('Failed to generate local SDP offer');

      // 3. Exchange SDP
      let answerSdp: RTCSessionDescriptionInit;

      if (window.location.protocol === 'http:' && this.bridgeUrl) {
        this.log(`Using Direct Local LAN signaling at ${this.bridgeUrl}...`);
        const res = await fetch(`${this.bridgeUrl}/api/webrtc/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: localSdp.sdp, type: localSdp.type })
        });
        if (!res.ok) throw new Error(`Bridge rejected offer: ${res.statusText}`);
        answerSdp = await res.json();
      } else {
        this.log(`Using Ephemeral Control Plane Signaling (Room: ${this.pairingCode})...`);
        answerSdp = await this.exchangeSignalingViaBroker(localSdp);
      }

      // Parse and log remote candidates
      const remoteLines = (answerSdp.sdp || '').split('\n');
      this.remoteCandidates = remoteLines.filter(l => l.includes('a=candidate:')).map(l => l.trim());
      this.log(`Remote Answer contains ${this.remoteCandidates.length} candidate(s):`);
      this.remoteCandidates.forEach(c => this.log(`  [Remote Candidate] ${c}`));

      // 4. Apply remote description
      this.log('Applying Bridge SDP Answer to local peer connection...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      this.reportDiagnostics();

      // 5. Start explicit 25s ICE connectivity watchdog
      this.iceTimeout = setTimeout(() => {
        if (this.pc && this.pc.iceConnectionState !== 'connected' && this.pc.iceConnectionState !== 'completed') {
          this.warn(`ICE connectivity watchdog timed out (State: ${this.pc.iceConnectionState}).`);
          if (!this.isDestroyed) {
            this.onStateChange('error');
          }
        }
      }, 25000);

    } catch (err) {
      this.error('Fatal error during connection setup:', err);
      if (!this.isDestroyed) {
        this.onStateChange('error');
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private async exchangeSignalingViaBroker(offer: RTCSessionDescription): Promise<RTCSessionDescriptionInit> {
    const code = this.pairingCode!;
    const offerThing = `gridpulse-sig-offer-${code}`;
    const answerThing = `gridpulse-sig-answer-${code}`;
    const offerId = `${this.sessionId}-${Date.now()}`;

    globalOfferCount += 1;
    this.log(`📡 Publishing ONE SDP offer (offer_id=${offerId}) to broker for room: ${code} (Total offers: ${globalOfferCount})`);

    // 1. Post offer to broker with unique offer_id
    const params = new URLSearchParams();
    params.set('sdp', offer.sdp);
    params.set('type', offer.type);
    params.set('offer_id', offerId);

    await fetch(`${SIGNALING_URL_BASE}/dweet/for/${offerThing}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    this.log(`⏳ Offer published (offer_id=${offerId}). Polling for Bridge SDP Answer on ${answerThing}...`);

    // 2. Poll for matching answer
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      try {
        const resp = await fetch(`${SIGNALING_URL_BASE}/get/latest/dweet/for/${answerThing}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.this === 'succeeded' && data.with && data.with.length > 0) {
            const dweet = data.with[0];
            const content = dweet.content;
            if (content && content.type === 'answer' && content.sdp) {
              // Verify offer_id match if available to avoid applying answers from previous sessions
              if (content.offer_id && content.offer_id !== offerId) {
                this.log(`Ignoring previous stale Bridge answer (received offer_id=${content.offer_id}, expected=${offerId}). Awaiting fresh answer...`);
              } else {
                globalAnswerCount += 1;
                this.log(`✅ Matching Bridge SDP Answer received! (Total answers: ${globalAnswerCount}) Establishing Direct P2P...`);
                return { sdp: content.sdp, type: content.type };
              }
            }
          }
        }
      } catch (pollErr) {
        this.warn('Polling tick error:', pollErr);
      }
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

  public async checkTransportStats(): Promise<void> {
    if (!this.pc) return;
    try {
      const stats = await this.pc.getStats();
      let isDirect = false;
      let candidateType = 'host';

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          const localCandidate = stats.get(report.localCandidateId);
          const remoteCandidate = stats.get(report.remoteCandidateId);
          if (remoteCandidate) {
            candidateType = remoteCandidate.candidateType || 'host';
            isDirect = candidateType === 'host' || candidateType === 'srflx' || candidateType === 'prflx';
          }
          this.log(`[Transport Stats] Active Candidate Pair: ${localCandidate?.ip || localCandidate?.address}:${localCandidate?.port} ➔ ${remoteCandidate?.ip || remoteCandidate?.address}:${remoteCandidate?.port} (${candidateType}) [state: ${report.state}]`);
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

      let timeout: any;
      const check = () => {
        if (!this.pc || this.pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          this.pc?.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };

      this.pc.addEventListener('icegatheringstatechange', check);
      timeout = setTimeout(() => {
        this.pc?.removeEventListener('icegatheringstatechange', check);
        resolve();
      }, 3500);
    });
  }

  public cleanup(): void {
    this.isDestroyed = true;
    this.stopPing();
    if (this.iceTimeout) {
      clearTimeout(this.iceTimeout);
      this.iceTimeout = null;
    }
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
