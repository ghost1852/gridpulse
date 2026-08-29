import asyncio
import json
import logging
import os
import socket
from typing import Set, Dict, Any, List, Optional
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
import aioice.ice
import aioice.stun

logger = logging.getLogger("GridPulse.WebRTC")
logging.getLogger("aioice.ice").setLevel(logging.DEBUG)
logging.getLogger("aiortc.rtcicetransport").setLevel(logging.DEBUG)

# Bidirectional STUN packet telemetry counters for physical network interface
physical_stats = {
    "outbound_requests": 0,
    "inbound_requests": 0,
    "inbound_responses": 0,
    "outbound_responses": 0,
}

_orig_send_stun = aioice.ice.StunProtocol.send_stun
def _hooked_send_stun(self, message, addr):
    local_host = getattr(self.local_candidate, 'host', 'unknown')
    local_port = getattr(self.local_candidate, 'port', 'unknown')
    local_type = getattr(self.local_candidate, 'type', 'unknown')
    is_physical = '192.168.88.' in str(local_host) or local_type in ['srflx', 'relay']
    if is_physical:
        tx_id = message.transaction_id.hex() if hasattr(message.transaction_id, 'hex') else str(message.transaction_id)
        if message.message_class == aioice.stun.Class.REQUEST:
            physical_stats["outbound_requests"] += 1
            logger.info(f"📤 [STUN SEND REQUEST #{physical_stats['outbound_requests']}] Local: {local_host}:{local_port} (typ {local_type}) ➔ Remote: {addr[0]}:{addr[1]} | {message.message_method.name} (TxID={tx_id}, {len(bytes(message))}B)")
        elif message.message_class == aioice.stun.Class.RESPONSE:
            physical_stats["outbound_responses"] += 1
            logger.info(f"📤 [STUN SEND RESPONSE #{physical_stats['outbound_responses']}] Local: {local_host}:{local_port} (typ {local_type}) ➔ Remote: {addr[0]}:{addr[1]} | {message.message_method.name} (TxID={tx_id}, {len(bytes(message))}B)")
        else:
            logger.info(f"📤 [STUN SEND] Local: {local_host}:{local_port} (typ {local_type}) ➔ Remote: {addr[0]}:{addr[1]} | {message.message_method.name} {message.message_class.name} ({len(bytes(message))}B)")
    return _orig_send_stun(self, message, addr)
aioice.ice.StunProtocol.send_stun = _hooked_send_stun

_orig_datagram_received = aioice.ice.StunProtocol.datagram_received
def _hooked_datagram_received(self, data, addr):
    local_host = getattr(self.local_candidate, 'host', 'unknown')
    local_port = getattr(self.local_candidate, 'port', 'unknown')
    local_type = getattr(self.local_candidate, 'type', 'unknown')
    is_physical = '192.168.88.' in str(local_host) or local_type in ['srflx', 'relay']
    if is_physical:
        try:
            msg = aioice.stun.parse_message(data)
            tx_id = msg.transaction_id.hex() if hasattr(msg.transaction_id, 'hex') else str(msg.transaction_id)
            if msg.message_class == aioice.stun.Class.REQUEST:
                physical_stats["inbound_requests"] += 1
                logger.info(f"📥 [STUN INBOUND REQUEST #{physical_stats['inbound_requests']}] From {addr[0]}:{addr[1]} ➔ Local: {local_host}:{local_port} (typ {local_type}) | Method={msg.message_method.name} (TxID={tx_id}, {len(data)}B)")
            elif msg.message_class == aioice.stun.Class.RESPONSE:
                physical_stats["inbound_responses"] += 1
                logger.info(f"📥 [STUN INBOUND RESPONSE #{physical_stats['inbound_responses']}] From {addr[0]}:{addr[1]} ➔ Local: {local_host}:{local_port} (typ {local_type}) | Method={msg.message_method.name} (TxID={tx_id}, {len(data)}B)")
            else:
                logger.info(f"📥 [STUN INBOUND] From {addr[0]}:{addr[1]} ➔ Local: {local_host}:{local_port} (typ {local_type}) ({len(data)}B)")
        except Exception:
            logger.info(f"📥 [NON-STUN DATAGRAM] From {addr[0]}:{addr[1]} ➔ Local: {local_host}:{local_port} (typ {local_type}) ({len(data)}B)")
    return _orig_datagram_received(self, data, addr)
aioice.ice.StunProtocol.datagram_received = _hooked_datagram_received

_orig_check_start = aioice.ice.Connection.check_start
async def _hooked_check_start(self, pair):
    local_cand = pair.local_candidate
    remote_cand = pair.remote_candidate
    local_host = getattr(local_cand, 'host', 'unknown')
    local_port = getattr(local_cand, 'port', 'unknown')
    local_type = getattr(local_cand, 'type', 'host')
    remote_host = getattr(remote_cand, 'host', 'unknown')
    remote_port = getattr(remote_cand, 'port', 'unknown')
    remote_type = getattr(remote_cand, 'type', 'srflx')
    
    is_physical = '192.168.88.' in str(local_host) or local_type in ['srflx', 'relay']
    if is_physical:
        logger.info(f"🔍 [ICE CHECK START] Local: {local_host}:{local_port} (typ {local_type}) ➔ Remote: {remote_host}:{remote_port} (typ {remote_type})")
    res = await _orig_check_start(self, pair)
    if is_physical:
        status_symbol = "✅ SUCCEEDED" if pair.state.name == "SUCCEEDED" else f"❌ {pair.state.name}"
        logger.info(f"🏁 [ICE CHECK RESULT] Local: {local_host}:{local_port} (typ {local_type}) ➔ Remote: {remote_host}:{remote_port} (typ {remote_type}) | Status: {status_symbol}")
    return res
aioice.ice.Connection.check_start = _hooked_check_start


def get_primary_lan_ip() -> str:
    """Determines the primary LAN IPv4 address of this machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

def clean_sdp_candidates(raw_sdp: str) -> str:
    """
    Cleans SDP candidates in Bridge answer:
    - Strips unroutable APIPA (169.254.*) addresses from virtual NICs.
    - Preserves all host, srflx, and relay candidates without altering RFC priorities.
    """
    lines = raw_sdp.splitlines()
    non_candidates: List[str] = []
    candidates: List[str] = []
    
    for line in lines:
        if line.startswith("a=candidate:"):
            if "169.254." in line:
                continue
            candidates.append(line)
        elif line.startswith("a=end-of-candidates"):
            continue
        else:
            non_candidates.append(line)
    
    result: List[str] = []
    candidates_inserted = False
    for line in non_candidates:
        if (line.startswith("a=ice-ufrag:") or line.startswith("a=fingerprint:")) and not candidates_inserted:
            if candidates:
                result.extend(candidates)
                result.append("a=end-of-candidates")
            candidates_inserted = True
        result.append(line)
        
    if not candidates_inserted and candidates:
        result.extend(candidates)
        result.append("a=end-of-candidates")
        
    return "\r\n".join(result) + "\r\n"

class WebRtcHost:
    def __init__(self, turn_server: Optional[str] = None, turn_username: Optional[str] = None, turn_password: Optional[str] = None):
        self.pcs: Set[RTCPeerConnection] = set()
        self.active_datachannels: Set[Any] = set()
        self.lan_ip = get_primary_lan_ip()
        
        # Primary STUN servers for Direct P2P
        ice_servers = [
            RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.relay.metered.ca:80"])
        ]
        
        # TURN relay fallback via credentials
        turn_url = turn_server or os.environ.get("GRIDPULSE_TURN_SERVER", "").strip() or "turn:global.relay.metered.ca:80?transport=udp"
        turn_user = turn_username or os.environ.get("GRIDPULSE_TURN_USER", "").strip() or "209b522bcd85f9169da1bc48"
        turn_pass = turn_password or os.environ.get("GRIDPULSE_TURN_PASS", "").strip() or "660slSqG6ARvPTC/"
        
        if turn_url:
            logger.info(f"🌐 Configured WebRTC TURN relay fallback: {turn_url}")
            ice_servers.append(
                RTCIceServer(
                    urls=[turn_url],
                    username=turn_user if turn_user else None,
                    credential=turn_pass if turn_pass else None
                )
            )
            # Support TLS TCP fallback
            ice_servers.append(
                RTCIceServer(
                    urls=["turns:global.relay.metered.ca:443?transport=tcp"],
                    username=turn_user if turn_user else None,
                    credential=turn_pass if turn_pass else None
                )
            )

        self.config = RTCConfiguration(iceServers=ice_servers)

    async def handle_offer(self, sdp: str, sdp_type: str) -> Dict[str, str]:
        """Handles an incoming pure WebRTC SDP offer directly from Safari."""
        self.lan_ip = get_primary_lan_ip()
        
        pc = RTCPeerConnection(configuration=self.config)
        self.pcs.add(pc)

        @pc.on("datachannel")
        def on_datachannel(channel):
            logger.info(f"🎉 WebRTC DataChannel OPEN: '{channel.label}' (id={channel.id})")
            self.active_datachannels.add(channel)

            @channel.on("message")
            def on_message(message):
                if isinstance(message, str) and message.startswith("__ping__:"):
                    try:
                        ts = message.split(":", 1)[1]
                        channel.send(f"__pong__:{ts}")
                    except Exception:
                        pass

            @channel.on("close")
            def on_close():
                logger.info(f"WebRTC DataChannel CLOSED: '{channel.label}'")
                self.active_datachannels.discard(channel)

        @pc.on("icegatheringstatechange")
        def on_icegatheringstatechange():
            logger.info(f"[ICE Gathering State] ➔ {pc.iceGatheringState}")

        @pc.on("iceconnectionstatechange")
        def on_iceconnectionstatechange():
            logger.info(f"[ICE Connection State] ➔ {pc.iceConnectionState}")

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"[WebRTC Connection State] ➔ {pc.connectionState}")
            if pc.connectionState == "connected":
                try:
                    ice_transport = pc.sctp.transport.transport
                    selected_pair = getattr(ice_transport._connection, "_selected_pair", None) or getattr(ice_transport._connection, "_nominated_pair", None)
                    if selected_pair:
                        local_cand = selected_pair.local_candidate
                        remote_cand = selected_pair.remote_candidate
                        trans_type = "DIRECT P2P (Host)" if local_cand.type == "host" and remote_cand.type == "host" else (
                            "DIRECT P2P (STUN WAN)" if local_cand.type == "srflx" or remote_cand.type == "srflx" else "RELAY (TURN)"
                        )
                        logger.info("=" * 54)
                        logger.info(f"🏆 [ICE CONNECTED - SELECTED PAIR] ➔ {trans_type}")
                        logger.info(f"   Local:  {local_cand.host}:{local_cand.port} ({local_cand.type})")
                        logger.info(f"   Remote: {remote_cand.host}:{remote_cand.port} ({remote_cand.type})")
                        logger.info("=" * 54)
                except Exception as e:
                    logger.debug(f"Could not inspect selected pair: {e}")
            elif pc.connectionState == "closed":
                self.pcs.discard(pc)

        # Log Remote Candidates from Offer
        logger.info("\n" + "=" * 54)
        logger.info("📡 REMOTE CLIENT CANDIDATES (FROM SDP OFFER):")
        for line in sdp.splitlines():
            if line.startswith("a=candidate:"):
                logger.info(f"   {line[12:]}")

        # Apply pure, unaltered SDP offer from client
        offer = RTCSessionDescription(sdp=sdp, type=sdp_type)
        await pc.setRemoteDescription(offer)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # Wait for ICE gathering to complete so all candidate pairs are embedded in SDP
        for _ in range(30):
            if pc.iceGatheringState == "complete":
                break
            await asyncio.sleep(0.05)

        raw_answer_sdp = pc.localDescription.sdp if pc.localDescription else ""
        cleaned_sdp = clean_sdp_candidates(raw_answer_sdp)

        logger.info("🏠 LOCAL BRIDGE CANDIDATES (ANSWER):")
        for line in cleaned_sdp.splitlines():
            if line.startswith("a=candidate:"):
                logger.info(f"   {line[12:]}")
        logger.info("=" * 54 + "\n")

        return {
            "sdp": cleaned_sdp,
            "type": pc.localDescription.type if pc.localDescription else "answer"
        }

    def broadcast(self, message_str: str):
        """Broadcasts a telemetry frame to all connected WebRTC DataChannels."""
        dead_channels = set()
        for dc in list(self.active_datachannels):
            try:
                if dc.readyState == "open":
                    dc.send(message_str)
                else:
                    dead_channels.add(dc)
            except Exception:
                dead_channels.add(dc)

        for dc in dead_channels:
            self.active_datachannels.discard(dc)

    async def close_all(self):
        """Closes all active WebRTC peer connections."""
        coros = [pc.close() for pc in self.pcs]
        await asyncio.gather(*coros, return_exceptions=True)
        self.pcs.clear()
        self.active_datachannels.clear()
