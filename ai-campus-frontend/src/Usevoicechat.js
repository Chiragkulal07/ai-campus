import { useCallback, useEffect, useRef, useState } from 'react';

// Global voice chat over a mesh of WebRTC peer connections.
//
// Joining the voice mesh (so you can HEAR others) and enabling your
// microphone (so others can hear YOU) are two separate things. Everyone
// auto-joins the mesh silently the moment they connect — the mic button
// only controls whether your own audio track is attached and enabled.
// This means you can hear anyone whose mic is on, regardless of whether
// your own mic is on.
//
// ── Production notes ──
// 1. STUN alone is NOT enough once real users are on different networks/
//    behind restrictive NATs or symmetric NATs (common on mobile data,
//    corporate networks, some ISPs). You need a TURN server, or calls
//    between those users will simply never connect (ICE will fail
//    silently — no error, just permanent "connecting").
//    Configure via Vite env vars:
//      VITE_TURN_URL=turn:your-turn-host:3478
//      VITE_TURN_USERNAME=xxxx
//      VITE_TURN_CREDENTIAL=xxxx
//    For real production traffic, prefer a provider that issues short-lived
//    TURN credentials (Twilio NTS, Cloudflare Calls, Metered, or your own
//    coturn with a credentials endpoint) rather than a single static
//    username/password baked into the client bundle.
// 2. Some browsers block autoplay of a non-muted <audio> element until the
//    page has a "sticky" user gesture. We handle this below by retrying
//    play() on the first user interaction if it was initially blocked.
export default function useVoiceChat(socket) {
  const [isMicOn, setIsMicOn] = useState(false);
  const [speakingPeerIds, setSpeakingPeerIds] = useState([]);
  const [micError, setMicError] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());   // peerId -> RTCPeerConnection
  const transceiversRef = useRef(new Map());       // peerId -> RTCRtpTransceiver (the audio one)
  const audioElementsRef = useRef(new Map());       // peerId -> HTMLAudioElement
  const analysersRef = useRef(new Map());            // peerId -> { rafId, audioCtx }
  const pendingPlayRef = useRef(new Set());           // audio elements blocked by autoplay policy

  // "Perfect negotiation" bookkeeping — prevents two peers from colliding
  // when both try to renegotiate at the same time (e.g. both turn mic on together).
  const politeRef = useRef(new Map());       // peerId -> boolean
  const makingOfferRef = useRef(new Map());   // peerId -> boolean

  const getIceServers = () => {
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }];

    const turnUrl = import.meta.env?.VITE_TURN_URL;
    const turnUsername = import.meta.env?.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env?.VITE_TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    } else if (import.meta.env?.PROD) {
      // Don't fail silently in production — this is the #1 cause of
      // "works on my machine, nobody else can hear anyone" bugs.
      console.warn(
        '[voiceChat] No TURN server configured. Calls between users on ' +
        'different networks/behind restrictive NATs will likely fail to connect. ' +
        'Set VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL.'
      );
    }

    return servers;
  };

  // ── Unlock blocked audio elements on the first real user gesture ──
  useEffect(() => {
    const tryUnlock = () => {
      pendingPlayRef.current.forEach((audioEl) => {
        audioEl.play()
          .then(() => pendingPlayRef.current.delete(audioEl))
          .catch(() => { /* still blocked, will retry on next gesture */ });
      });
    };
    document.addEventListener('click', tryUnlock);
    document.addEventListener('keydown', tryUnlock);
    document.addEventListener('touchstart', tryUnlock);
    return () => {
      document.removeEventListener('click', tryUnlock);
      document.removeEventListener('keydown', tryUnlock);
      document.removeEventListener('touchstart', tryUnlock);
    };
  }, []);

  const playAudioElement = (audioEl) => {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        // Autoplay was blocked — queue it to retry on the next user gesture.
        console.warn('autoplay blocked, will retry on next user interaction:', err.message);
        pendingPlayRef.current.add(audioEl);
      });
    }
  };

  const stopWatchingVolume = (peerId) => {
    const entry = analysersRef.current.get(peerId);
    if (entry) {
      if (entry.rafId) cancelAnimationFrame(entry.rafId);
      if (entry.audioCtx && entry.audioCtx.state !== 'closed') {
        entry.audioCtx.close().catch(() => {});
      }
    }
    analysersRef.current.delete(peerId);
    setSpeakingPeerIds((prev) => prev.filter((id) => id !== peerId));
  };

  const watchVolume = (peerId, stream) => {
    // Guard against being called with something that isn't a real stream
    // with live audio tracks (the root cause of the previous bug).
    if (!(stream instanceof MediaStream) || stream.getAudioTracks().length === 0) {
      console.warn('watchVolume: no valid audio stream for', peerId);
      return;
    }

    // If we were already watching this peer (e.g. their track was replaced
    // during renegotiation), tear down the old analyser first.
    stopWatchingVolume(peerId);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

        setSpeakingPeerIds((prev) => {
          const isSpeaking = avg > 12;
          const already = prev.includes(peerId);
          if (isSpeaking && !already) return [...prev, peerId];
          if (!isSpeaking && already) return prev.filter((id) => id !== peerId);
          return prev;
        });

        const rafId = requestAnimationFrame(check);
        const entry = analysersRef.current.get(peerId);
        if (entry) entry.rafId = rafId;
      };

      analysersRef.current.set(peerId, { rafId: null, audioCtx });
      check();
    } catch (err) {
      console.warn('volume watch failed for', peerId, err);
    }
  };

  // Creates a peer connection to a given peer. If we already have a local
  // mic stream, we send it immediately (sendrecv). If not, we still create
  // a "receive-only" audio transceiver so we can hear them the moment they
  // start talking, even though we're not transmitting anything ourselves.
  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    politeRef.current.set(peerId, socket.id < peerId);
    makingOfferRef.current.set(peerId, false);

    let transceiver;
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      transceiver = pc.addTransceiver(track, {
        direction: 'sendrecv',
        streams: [localStreamRef.current],
      });
    } else {
      transceiver = pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    transceiversRef.current.set(peerId, transceiver);

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(peerId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit('voice:signal', { to: peerId, data: { sdp: pc.localDescription } });
      } catch (err) {
        console.warn('negotiation failed for', peerId, err);
      } finally {
        makingOfferRef.current.set(peerId, false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:signal', { to: peerId, data: { candidate: event.candidate } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
        console.warn(`ICE ${pc.iceConnectionState} for peer`, peerId, '- check TURN server config if this persists across networks');
      }
    };

    pc.ontrack = (event) => {
      // IMPORTANT: don't trust event.streams[0] to always be populated.
      // replaceTrack() on an existing sender (used when upgrading a
      // recvonly connection to sendrecv after mic-on) does not always
      // carry stream association through cleanly on every browser, and
      // relying on it silently breaks playback with no visible error
      // other than a downstream createMediaStreamSource crash. Building
      // our own stream from the track guarantees we always have audio.
      const remoteStream = event.streams[0] || new MediaStream([event.track]);

      let audioEl = audioElementsRef.current.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.dataset.peerId = peerId;
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(peerId, audioEl);
      }
      audioEl.srcObject = remoteStream;
      playAudioElement(audioEl);
      watchVolume(peerId, remoteStream);

      // If the track itself gets replaced later (e.g. mic re-enabled with
      // a fresh getUserMedia call), refresh the volume watcher.
      event.track.addEventListener('ended', () => stopWatchingVolume(peerId));
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [socket]);

  const closePeerConnection = (peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    transceiversRef.current.delete(peerId);
    politeRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);

    const audioEl = audioElementsRef.current.get(peerId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(peerId);
      pendingPlayRef.current.delete(audioEl);
    }
    stopWatchingVolume(peerId);
  };

  // ── Auto-join the voice mesh the moment we have a connected socket ──
  // This is what lets everyone HEAR others without needing their own mic on.
  useEffect(() => {
    if (!socket) return;
    socket.emit('voice:join');

    return () => {
      socket.emit('voice:leave');
      peerConnectionsRef.current.forEach((_, peerId) => closePeerConnection(peerId));
      peerConnectionsRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setSpeakingPeerIds([]);
      setIsMicOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── Signaling handlers ──
  useEffect(() => {
    if (!socket) return;

    // We just joined — connect out to everyone already in the mesh
    const handleExistingParticipants = (existingIds) => {
      existingIds.forEach((peerId) => {
        if (!peerConnectionsRef.current.has(peerId)) {
          createPeerConnection(peerId);
          // onnegotiationneeded fires automatically and sends the offer
        }
      });
    };

    // Someone new joined — we wait for their offer, nothing to do yet
    const handlePeerJoined = () => {
      // no-op
    };

    const handleSignal = async ({ from, data }) => {
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from);
      }

      const polite = politeRef.current.get(from);

      if (data.sdp) {
        const description = data.sdp;
        const offerCollision =
          description.type === 'offer' &&
          (makingOfferRef.current.get(from) || pc.signalingState !== 'stable');

        const ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;

        try {
          await pc.setRemoteDescription(description);
          if (description.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', { to: from, data: { sdp: pc.localDescription } });
          }
        } catch (err) {
          console.warn('failed handling sdp from', from, err);
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          // Safe to ignore — usually a late candidate for a connection that moved on
        }
      }
    };

    const handlePeerLeft = ({ peerId }) => {
      closePeerConnection(peerId);
    };

    socket.on('voice:existing-participants', handleExistingParticipants);
    socket.on('voice:peer-joined', handlePeerJoined);
    socket.on('voice:signal', handleSignal);
    socket.on('voice:peer-left', handlePeerLeft);

    return () => {
      socket.off('voice:existing-participants', handleExistingParticipants);
      socket.off('voice:peer-joined', handlePeerJoined);
      socket.off('voice:signal', handleSignal);
      socket.off('voice:peer-left', handlePeerLeft);
    };
  }, [socket, createPeerConnection]);

  // ── Mic toggle — only controls whether WE transmit, not mesh membership ──
  const toggleMic = async () => {
    if (!socket) return;
    setMicError(null);

    if (isMicOn) {
      // Soft mute — stop transmitting, but stay connected so we keep hearing others
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMicOn(false);
      return;
    }

    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];

        // Upgrade every existing receive-only connection to also send our audio
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const transceiver = transceiversRef.current.get(peerId);
          if (transceiver) {
            transceiver.sender.replaceTrack(track);
            // replaceTrack() alone does NOT reliably associate a MediaStream
            // with the sender on every browser — without this, the remote
            // side's ontrack can fire with an empty event.streams array.
            if (transceiver.sender.setStreams) {
              transceiver.sender.setStreams(stream);
            }
            transceiver.direction = 'sendrecv';
          } else {
            pc.addTrack(track, stream);
          }
        });
      } catch (err) {
        console.error('microphone permission denied or unavailable:', err);
        setMicError(
          err.name === 'NotAllowedError'
            ? 'Microphone access was denied. Check your browser permissions.'
            : 'Could not access your microphone. Please check your device settings.'
        );
        return;
      }
    } else {
      // We already have a stream from before (just soft-muted) — re-enable it
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    }

    setIsMicOn(true);
  };

  return { isMicOn, toggleMic, speakingPeerIds, micError };
}