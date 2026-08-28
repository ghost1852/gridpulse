import asyncio
import json
import logging
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any
from webrtc_host import WebRtcHost

logger = logging.getLogger("GridPulse.Signaling")

SIGNALING_URL_BASE = "https://dweet.cc"

class EphemeralSignalingClient:
    """
    Lightweight, zero-cloud control-plane signaling client.
    Exchanges only ephemeral SDP and ICE metadata for WebRTC pairing.
    Role: OFFER RECEIVER + ANSWER PUBLISHER.
    Zero telemetry ever passes through this service.
    """
    def __init__(self, pairing_code: str, webrtc_engine: WebRtcHost):
        self.clean_code = pairing_code.replace(" ", "").strip()
        self.offer_thing = f"gridpulse-sig-offer-{self.clean_code}"
        self.answer_thing = f"gridpulse-sig-answer-{self.clean_code}"
        self.webrtc_engine = webrtc_engine
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_processed_time: Optional[str] = None

    async def start(self):
        """Starts background polling for phone SDP offers."""
        self._running = True
        self._task = asyncio.create_task(self._listen_for_offers())
        logger.info(f"Ephemeral signaling active for room code: {self.clean_code}")

    async def publish_answer(self, answer_dict: Dict[str, Any]) -> bool:
        """Publishes the local SDP answer back to the phone."""
        url = f"{SIGNALING_URL_BASE}/dweet/for/{self.answer_thing}"
        data = urllib.parse.urlencode({
            "sdp": answer_dict.get("sdp", ""),
            "type": answer_dict.get("type", "answer")
        }).encode("utf-8")
        
        def _post():
            req = urllib.request.Request(
                url, 
                data=data, 
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200

        try:
            success = await asyncio.to_thread(_post)
            if success:
                logger.info(f"Published SDP answer to phone for room {self.clean_code}")
            return success
        except Exception as e:
            logger.warning(f"Failed to publish SDP answer: {e}")
            return False

    async def _listen_for_offers(self):
        """Polls for incoming WebRTC offers from the phone."""
        url = f"{SIGNALING_URL_BASE}/get/latest/dweet/for/{self.offer_thing}"

        while self._running:
            try:
                def _poll():
                    req = urllib.request.Request(url, headers={"User-Agent": "GridPulse-Bridge"})
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        return json.loads(resp.read().decode("utf-8"))

                res = await asyncio.to_thread(_poll)
                if res.get("this") == "succeeded" and res.get("with"):
                    dweet = res["with"][0]
                    created = dweet.get("created")
                    content = dweet.get("content", {})
                    
                    if created != self._last_processed_time and content.get("type") == "offer" and content.get("sdp"):
                        self._last_processed_time = created
                        logger.info(f"Received phone WebRTC offer for room {self.clean_code}!")
                        answer = await self.webrtc_engine.handle_offer(content["sdp"], content["type"])
                        if answer:
                            await self.publish_answer(answer)

            except Exception as e:
                logger.debug(f"Signaling poll tick: {e}")

            await asyncio.sleep(1.0)

    def close(self):
        """Stops background signaling loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
