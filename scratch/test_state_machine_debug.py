import asyncio
import json
import logging
import time
import urllib.request
import urllib.parse
import sys

sys.path.append("c:/Users/Anony/Documents/antigravity/valiant-borg/backend")
from webrtc_host import WebRtcHost
from signaling_client import EphemeralSignalingClient
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("StateDebugger")

def inspect_sdp(role: str, sdp: str):
    lines = sdp.split("\r\n") if "\r\n" in sdp else sdp.split("\n")
    ufrag = [l for l in lines if l.startswith("a=ice-ufrag:")]
    pwd = [l for l in lines if l.startswith("a=ice-pwd:")]
    candidates = [l for l in lines if l.startswith("a=candidate:")]
    m_lines = [l for l in lines if l.startswith("m=")]
    mid_lines = [l for l in lines if l.startswith("a=mid:")]
    
    print(f"\n--- [{role}] SDP INSPECTION ---", flush=True)
    print(f"[{role}] Total SDP length: {len(sdp)} chars, {len(lines)} lines", flush=True)
    print(f"[{role}] Media lines (m=): {m_lines}", flush=True)
    print(f"[{role}] Mid lines: {mid_lines}", flush=True)
    print(f"[{role}] ICE Ufrag: {ufrag}", flush=True)
    print(f"[{role}] ICE Pwd: {pwd}", flush=True)
    print(f"[{role}] Number of embedded ICE candidates: {len(candidates)}", flush=True)
    for c in candidates:
        print(f"  [{role} CANDIDATE] {c}", flush=True)
    print(f"--- END [{role}] SDP INSPECTION ---\n", flush=True)
    return len(candidates)

async def debug_handshake():
    code = f"debug{int(time.time()) % 100000}"
    print(f"\n========================================================", flush=True)
    print(f"   WEBRTC STATE MACHINE DEBUGGER (ROOM: {code})", flush=True)
    print(f"========================================================\n", flush=True)

    # 1. Instantiate Bridge Host
    bridge_host = WebRtcHost()
    bridge_signaling = EphemeralSignalingClient(code, bridge_host)
    
    # 2. Instrument Bridge WebRtcHost
    original_handle_offer = bridge_host.handle_offer
    async def instrumented_handle_offer(sdp: str, sdp_type: str):
        print(f"[BRIDGE] OFFER RECEIVED via signaling! sdp_type={sdp_type}", flush=True)
        inspect_sdp("BRIDGE RECEIVED OFFER", sdp)
        
        pc = RTCPeerConnection(configuration=bridge_host.config)
        bridge_host.pcs.add(pc)

        @pc.on("icegatheringstatechange")
        def on_ice_gathering():
            print(f"[BRIDGE] ICE gathering state: {pc.iceGatheringState}", flush=True)

        @pc.on("iceconnectionstatechange")
        def on_ice_conn():
            print(f"[BRIDGE] ICE connection state: {pc.iceConnectionState}", flush=True)

        @pc.on("connectionstatechange")
        def on_conn_state():
            print(f"[BRIDGE] PeerConnection state: {pc.connectionState}", flush=True)

        @pc.on("signalingstatechange")
        def on_sig_state():
            print(f"[BRIDGE] Signaling state: {pc.signalingState}", flush=True)

        @pc.on("datachannel")
        def on_dc(channel):
            print(f"[BRIDGE] DataChannel OPENED on bridge! label={channel.label}", flush=True)
            bridge_host.active_datachannels.add(channel)

        print("[BRIDGE] setRemoteDescription START", flush=True)
        offer_desc = RTCSessionDescription(sdp=sdp, type=sdp_type)
        await pc.setRemoteDescription(offer_desc)
        print("[BRIDGE] setRemoteDescription DONE", flush=True)

        print("[BRIDGE] createAnswer START", flush=True)
        answer = await pc.createAnswer()
        print("[BRIDGE] createAnswer DONE", flush=True)

        print("[BRIDGE] setLocalDescription START", flush=True)
        await pc.setLocalDescription(answer)
        print("[BRIDGE] setLocalDescription DONE", flush=True)

        print("[BRIDGE] Waiting for local ICE candidates to gather...", flush=True)
        for _ in range(40):
            if pc.iceGatheringState == "complete":
                break
            await asyncio.sleep(0.05)
        print(f"[BRIDGE] ICE gathering finished! Final state: {pc.iceGatheringState}", flush=True)

        inspect_sdp("BRIDGE GENERATED ANSWER", pc.localDescription.sdp)
        return {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        }

    bridge_host.handle_offer = instrumented_handle_offer
    await bridge_signaling.start()

    # 3. Instrument Phone Client
    print("\n[PHONE] Creating RTCPeerConnection...", flush=True)
    phone_pc = RTCPeerConnection(configuration=RTCConfiguration(
        iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"])]
    ))

    @phone_pc.on("icegatheringstatechange")
    def on_phone_ice_gathering():
        print(f"[PHONE] ICE gathering state: {phone_pc.iceGatheringState}", flush=True)

    @phone_pc.on("iceconnectionstatechange")
    def on_phone_ice_conn():
        print(f"[PHONE] ICE connection state: {phone_pc.iceConnectionState}", flush=True)

    @phone_pc.on("connectionstatechange")
    def on_phone_conn_state():
        print(f"[PHONE] PeerConnection state: {phone_pc.connectionState}", flush=True)

    @phone_pc.on("signalingstatechange")
    def on_phone_sig_state():
        print(f"[PHONE] Signaling state: {phone_pc.signalingState}", flush=True)

    # Phone creates unordered DataChannel
    print("[PHONE] Creating DataChannel 'telemetry'...", flush=True)
    phone_dc = phone_pc.createDataChannel("telemetry", ordered=False, maxRetransmits=0)
    
    received_packets = []
    @phone_dc.on("open")
    def on_phone_dc_open():
        print("[PHONE] DataChannel State -> OPEN!", flush=True)

    @phone_dc.on("message")
    def on_phone_dc_msg(msg):
        received_packets.append(msg)

    # Phone creates offer
    print("[PHONE] createOffer START", flush=True)
    phone_offer = await phone_pc.createOffer()
    print("[PHONE] createOffer DONE", flush=True)

    print("[PHONE] setLocalDescription START", flush=True)
    await phone_pc.setLocalDescription(phone_offer)
    print("[PHONE] setLocalDescription DONE", flush=True)

    print("[PHONE] Waiting for local ICE gathering...", flush=True)
    for _ in range(40):
        if phone_pc.iceGatheringState == "complete":
            break
        await asyncio.sleep(0.05)
    print(f"[PHONE] ICE gathering finished! Final state: {phone_pc.iceGatheringState}", flush=True)

    inspect_sdp("PHONE GENERATED OFFER", phone_pc.localDescription.sdp)

    # 4. Phone Publishes Offer to Ephemeral Broker
    offer_thing = f"gridpulse-sig-offer-{code}"
    answer_thing = f"gridpulse-sig-answer-{code}"

    offer_body = urllib.parse.urlencode({
        "sdp": phone_pc.localDescription.sdp,
        "type": phone_pc.localDescription.type
    }).encode("utf-8")

    print(f"[PHONE] Publishing offer to https://dweet.cc/dweet/for/{offer_thing}...", flush=True)
    req = urllib.request.Request(
        f"https://dweet.cc/dweet/for/{offer_thing}",
        data=offer_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"[PHONE] Offer published successfully: HTTP {resp.status}", flush=True)

    # 5. Phone Polls for Answer from Ephemeral Broker
    print(f"[PHONE] Polling for answer on https://dweet.cc/get/latest/dweet/for/{answer_thing}...", flush=True)
    answer_payload = None
    for attempt in range(1, 20):
        try:
            req = urllib.request.Request(f"https://dweet.cc/get/latest/dweet/for/{answer_thing}")
            with urllib.request.urlopen(req, timeout=5) as r:
                res = json.loads(r.read().decode("utf-8"))
                if res.get("this") == "succeeded" and res.get("with"):
                    c = res["with"][0].get("content", {})
                    if c.get("type") == "answer" and c.get("sdp"):
                        answer_payload = c
                        print(f"[PHONE] Answer received on poll attempt {attempt}!", flush=True)
                        break
        except Exception as e:
            print(f"[PHONE] Poll attempt {attempt} error: {e}", flush=True)
        await asyncio.sleep(1.0)

    if not answer_payload:
        print("[ERROR] Timed out waiting for SDP Answer!", flush=True)
        bridge_signaling.close()
        await bridge_host.close_all()
        await phone_pc.close()
        return False

    inspect_sdp("PHONE RECEIVED ANSWER", answer_payload["sdp"])

    print("[PHONE] setRemoteDescription START", flush=True)
    phone_answer_desc = RTCSessionDescription(sdp=answer_payload["sdp"], type=answer_payload["type"])
    await phone_pc.setRemoteDescription(phone_answer_desc)
    print("[PHONE] setRemoteDescription DONE", flush=True)

    # 6. Monitor ICE Connectivity & DataChannel State
    print("\n[MONITOR] Monitoring connection handshake for 10 seconds...", flush=True)
    for sec in range(1, 11):
        await asyncio.sleep(1.0)
        print(f"[MONITOR @ {sec}s] Phone ICE: {phone_pc.iceConnectionState} | Phone PC: {phone_pc.connectionState} | Phone DC: {phone_dc.readyState}", flush=True)
        if phone_dc.readyState == "open":
            break

    # 7. Test Telemetry Broadcast
    if phone_dc.readyState == "open":
        print("\n[BROADCAST] Broadcasting 10 test telemetry frames...", flush=True)
        for i in range(10):
            bridge_host.broadcast(json.dumps({"frame": i, "speed_mph": 120.5, "rpm": 6500}))
            await asyncio.sleep(0.05)
        print(f"[BROADCAST] Total frames received by Phone: {len(received_packets)}", flush=True)

    success = phone_dc.readyState == "open" and len(received_packets) > 0

    # Teardown
    bridge_signaling.close()
    await bridge_host.close_all()
    await phone_pc.close()

    print(f"\n========================================================", flush=True)
    print(f"   FINAL RESULT: {'SUCCESS (100% P2P VERIFIED)' if success else 'FAILED'}", flush=True)
    print(f"========================================================\n", flush=True)
    return success

if __name__ == "__main__":
    asyncio.run(debug_handshake())
