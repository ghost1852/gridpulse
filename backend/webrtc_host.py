import asyncio
import json
import logging
from typing import Set, Dict, Any
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer

logger = logging.getLogger("GridPulse.WebRTC")

class WebRtcHost:
    def __init__(self):
        self.pcs: Set[RTCPeerConnection] = set()
        self.active_datachannels: Set[Any] = set()
        self.config = RTCConfiguration(
            iceServers=[
                RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"])
            ]
        )

    async def handle_offer(self, sdp: str, sdp_type: str) -> Dict[str, str]:
        """Handles an incoming WebRTC SDP offer from a phone/browser client."""
        pc = RTCPeerConnection(configuration=self.config)
        self.pcs.add(pc)

        @pc.on("datachannel")
        def on_datachannel(channel):
            logger.info(f"WebRTC DataChannel opened: {channel.label}")
            self.active_datachannels.add(channel)

            @channel.on("close")
            def on_close():
                logger.info(f"WebRTC DataChannel closed: {channel.label}")
                self.active_datachannels.discard(channel)

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"WebRTC connection state: {pc.connectionState}")
            if pc.connectionState in ["failed", "closed"]:
                await pc.close()
                self.pcs.discard(pc)

        offer = RTCSessionDescription(sdp=sdp, type=sdp_type)
        await pc.setRemoteDescription(offer)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
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
