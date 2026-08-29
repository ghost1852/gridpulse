import asyncio
import json
import logging
import socket
from typing import Set, Dict, Any, List, Optional
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
import aioice.ice
import aioice.stun

logger = logging.getLogger("GridPulse.WebRTC")
logging.getLogger("aioice.ice").setLevel(logging.DEBUG)
logging.getLogger("aiortc.rtcicetransport").setLevel(logging.DEBUG)

# Hook StunProtocol to explicitly distinguish physical interface vs virtual interface datagrams
_orig_send_stun = aioice.ice.StunProtocol.send_stun
def _hooked_send_stun(self, message, addr):
    local_host = getattr(self.local_candidate, 'host', 'unknown')
    local_port = getattr(self.local_candidate, 'port', 'unknown')
    is_physical = '192.168.88.' in str(local_host)
    if is_physical:
        logger.info(f"📤 [PHYSICAL STUN SEND] {local_host}:{local_port} ➔ {addr[0]}:{addr[1]} | {message.message_method.name} {message.message_class.name} ({len(bytes(message))} bytes)")
    return _orig_send_stun(self, message, addr)
aioice.ice.StunProtocol.send_stun = _hooked_send_stun

_orig_datagram_received = aioice.ice.StunProtocol.datagram_received
def _hooked_datagram_received(self, data, addr):
    local_host = getattr(self.local_candidate, 'host', 'unknown')
    local_port = getattr(self.local_candidate, 'port', 'unknown')
    is_physical = '192.168.88.' in str(local_host)
    if is_physical:
        logger.info(f"📥 [PHYSICAL STUN RECV] {addr[0]}:{addr[1]} ➔ {local_host}:{local_port} ({len(data)} bytes)")
    return _orig_datagram_received(self, data, addr)
aioice.ice.StunProtocol.datagram_received = _hooked_datagram_received

_orig_check_start = aioice.ice.Connection.check_start
async def _hooked_check_start(self, pair):
    local_host = getattr(pair.local_candidate, 'host', 'unknown')
    local_port = getattr(pair.local_candidate, 'port', 'unknown')
    remote_host = getattr(pair.remote_candidate, 'host', 'unknown')
    remote_port = getattr(pair.remote_candidate, 'port', 'unknown')
    is_physical = '192.168.88.' in str(local_host)
    if is_physical:
        logger.info(f"🔍 [PHYSICAL ICE CHECK START] Local: {local_host}:{local_port} ({getattr(pair.local_candidate, 'type', 'host')}) ➔ Remote: {remote_host}:{remote_port} ({getattr(pair.remote_candidate, 'type', 'srflx')})")
    res = await _orig_check_start(self, pair)
    if is_physical:
        logger.info(f"🏁 [PHYSICAL ICE CHECK RESULT] Local: {local_host}:{local_port} ➔ Remote: {remote_host}:{remote_port} | Final State: {pair.state.name}")
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

def clean_sdp_candidates(raw_sdp: str, lan_ip: str) -> str:
    """
    Cleans and prioritizes SDP candidates in Bridge answer:
    - Strips unroutable APIPA (169.254.*) addresses from virtual NICs.
    - Places primary LAN candidate and STUN srflx first.
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
            
    def _cand_rank(c: str) -> int:
        if lan_ip in c:
            return 0
        if "typ srflx" in c:
            return 1
        return 2

    candidates.sort(key=_cand_rank)
    
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
    def __init__(self):
        self.pcs: Set[RTCPeerConnection] = set()
        self.active_datachannels: Set[Any] = set()
        self.lan_ip = get_primary_lan_ip()
        self.config = RTCConfiguration(
            iceServers=[
                RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"])
            ]
        )

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
            if pc.connectionState == "closed":
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
        cleaned_sdp = clean_sdp_candidates(raw_answer_sdp, self.lan_ip)

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
