import asyncio
import json
import urllib.request
import urllib.parse
import sys
sys.path.append("c:/Users/Anony/Documents/antigravity/valiant-borg/backend")
from webrtc_host import WebRtcHost
from signaling_client import EphemeralSignalingClient
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer

async def test_pairing():
    pairing_code = "789456"
    print(f"=== TESTING EPHEMERAL PAIRING FOR CODE: {pairing_code} ===", flush=True)

    host = WebRtcHost()
    bridge_signaling = EphemeralSignalingClient(pairing_code, host)
    await bridge_signaling.start()

    # Client (Phone) side
    phone_pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]))
    phone_dc = phone_pc.createDataChannel("telemetry", ordered=False, maxRetransmits=0)
    
    received_frames = []
    @phone_dc.on("open")
    def on_open():
        print("[PHONE] DataChannel OPENED!", flush=True)

    @phone_dc.on("message")
    def on_msg(msg):
        received_frames.append(msg)

    # Phone creates offer
    offer = await phone_pc.createOffer()
    await phone_pc.setLocalDescription(offer)
    for _ in range(30):
        if phone_pc.iceGatheringState == "complete":
            break
        await asyncio.sleep(0.05)

    # Phone posts offer to broker
    offer_thing = f"gridpulse-sig-offer-{pairing_code}"
    answer_thing = f"gridpulse-sig-answer-{pairing_code}"
    
    offer_data = urllib.parse.urlencode({
        "sdp": phone_pc.localDescription.sdp,
        "type": phone_pc.localDescription.type
    }).encode("utf-8")
    
    print(f"[PHONE] Publishing offer to https://dweet.cc/dweet/for/{offer_thing}...", flush=True)
    req = urllib.request.Request(
        f"https://dweet.cc/dweet/for/{offer_thing}", 
        data=offer_data, 
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        print(f"[PHONE] Offer published: {r.status}", flush=True)

    # Phone polls for answer
    print(f"[PHONE] Polling for answer on https://dweet.cc/get/latest/dweet/for/{answer_thing}...", flush=True)
    answer_sdp = None
    for i in range(15):
        try:
            req = urllib.request.Request(f"https://dweet.cc/get/latest/dweet/for/{answer_thing}")
            with urllib.request.urlopen(req, timeout=5) as r:
                res = json.loads(r.read().decode("utf-8"))
                if res.get("this") == "succeeded" and res.get("with"):
                    content = res["with"][0].get("content", {})
                    if content.get("type") == "answer" and content.get("sdp"):
                        answer_sdp = content
                        break
        except Exception as e:
            print(f"[PHONE] Poll error: {e}", flush=True)
        await asyncio.sleep(1)

    if not answer_sdp:
        print("[ERROR] Timed out waiting for answer!", flush=True)
        bridge_signaling.close()
        await host.close_all()
        await phone_pc.close()
        return False

    print(f"[PHONE] Received answer from Bridge! Applying remote description...", flush=True)
    await phone_pc.setRemoteDescription(RTCSessionDescription(sdp=answer_sdp["sdp"], type=answer_sdp["type"]))

    # Wait for connection & DataChannel
    print("[PHONE] Waiting for WebRTC DataChannel connection...", flush=True)
    for _ in range(20):
        if phone_dc.readyState == "open":
            break
        await asyncio.sleep(0.5)

    print(f"[PHONE] Final DataChannel State: {phone_dc.readyState}", flush=True)
    print(f"[PHONE] ICE Connection State: {phone_pc.iceConnectionState}", flush=True)

    # Send test telemetry from host
    for i in range(10):
        host.broadcast(json.dumps({"test_packet": i, "speed_mph": 88.0}))
        await asyncio.sleep(0.1)

    print(f"[PHONE] Total Telemetry Frames Received: {len(received_frames)}", flush=True)

    bridge_signaling.close()
    await host.close_all()
    await phone_pc.close()
    return phone_dc.readyState == "open" and len(received_frames) > 0

if __name__ == "__main__":
    success = asyncio.run(test_pairing())
    print(f"TEST RESULT: {'SUCCESS' if success else 'FAILED'}", flush=True)
