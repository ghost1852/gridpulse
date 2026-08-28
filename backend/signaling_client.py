import asyncio
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger("GridPulse.Signaling")

SIGNALING_URL_BASE = "https://ntfy.sh"

class EphemeralSignalingClient:
    """
    Lightweight, zero-cloud control-plane signaling client.
    Exchanges only ephemeral SDP and ICE metadata for WebRTC pairing.
    Zero telemetry ever passes through this service.
    """
    def __init__(self, pairing_code: str):
        self.clean_code = pairing_code.replace(" ", "").strip()
        self.offer_topic = f"gridpulse-sig-offer-{self.clean_code}"
        self.answer_topic = f"gridpulse-sig-answer-{self.clean_code}"
        self.is_connected = False
        self._listen_task: Optional[asyncio.Task] = None

    async def publish_offer(self, sdp_dict: Dict[str, Any]) -> bool:
        """Publishes the local SDP offer to the control plane signaling topic."""
        url = f"{SIGNALING_URL_BASE}/{self.offer_topic}"
        payload = json.dumps(sdp_dict).encode("utf-8")
        
        def _post():
            req = urllib.request.Request(
                url, 
                data=payload, 
                headers={"Title": "SDP-Offer", "Priority": "high"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200

        try:
            success = await asyncio.to_thread(_post)
            if success:
                logger.info(f"Published SDP offer for room {self.clean_code}")
            return success
        except Exception as e:
            logger.warning(f"Failed to publish SDP offer: {e}")
            return False

    async def listen_for_answer(self, on_answer_callback: Callable[[Dict[str, Any]], Any], timeout: float = 120.0):
        """Polls for the phone's SDP answer for the pairing code."""
        url = f"{SIGNALING_URL_BASE}/{self.answer_topic}/json?poll=1"
        start_time = asyncio.get_event_loop().time()
        
        logger.info(f"Listening for WebRTC answer on room {self.clean_code}...")

        while (asyncio.get_event_loop().time() - start_time) < timeout:
            try:
                def _poll():
                    req = urllib.request.Request(url, headers={"User-Agent": "GridPulse-Bridge"})
                    with urllib.request.urlopen(req, timeout=8) as resp:
                        lines = resp.read().decode("utf-8").strip().split("\n")
                        for line in lines:
                            if not line.strip():
                                continue
                            data = json.loads(line)
                            # ntfy messages have a "message" field containing payload
                            msg_str = data.get("message")
                            if msg_str:
                                try:
                                    parsed = json.loads(msg_str)
                                    if parsed.get("type") in ["answer", "candidate"]:
                                        return parsed
                                except Exception:
                                    pass
                    return None

                answer_payload = await asyncio.to_thread(_poll)
                if answer_payload:
                    logger.info("Received SDP answer from phone!")
                    if asyncio.iscoroutinefunction(on_answer_callback):
                        await on_answer_callback(answer_payload)
                    else:
                        on_answer_callback(answer_payload)
                    return True
            except Exception as e:
                logger.debug(f"Signaling poll tick: {e}")

            await asyncio.sleep(1.5)

        logger.info(f"Pairing window for code {self.clean_code} expired.")
        return False

    def close(self):
        """Stops any active polling."""
        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            self._listen_task = None
