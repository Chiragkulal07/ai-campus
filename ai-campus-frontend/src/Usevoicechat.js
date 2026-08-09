import { useCallback, useEffect, useRef, useState } from 'react';

// Global voice + video chat over a mesh of WebRTC peer connections.
//
// Joining the mesh (so you can HEAR/SEE others) and enabling your own
// mic/camera (so others can hear/see YOU) are separate things. Everyone
// auto-joins the mesh silently on connect — the mic and video buttons
// each independently control only your own outgoing track.
//
// ── Production notes ──
// 1. STUN alone is NOT enough once real users are on different networks/
//    behind restrictive NATs. You need a TURN server or calls will fail
//    to connect silently. Configure via:
//      VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
// 2. Video is bandwidth-heavier than audio — this mesh approach (everyone
//    connects to everyone) is fine for small groups. If you later scale to
//    many simultaneous video broadcasters, that's when an SFU (planned
//    separately) becomes necessary — noted, not needed yet.
export default function useVoiceChat(socket) {
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [speakingPeerIds, setSpeakingPeerIds] = useState([]);
  const [micError, setMicError] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState({}); // { peerId: MediaStream }

  const localAudioStreamRef = useRef(null);
  const localVideoStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());     // peerId -> RTCPeerConnection
  const transceiversRef = useRef(new Map());          // peerId -> { audio, video }
  const audioElementsRef = useRef(new Map());          // peerId -> hidden <audio>
  const analysersRef = useRef(new Map());               // peerId -> { rafId, audioCtx }
  const pendingPlayRef = useRef(new Set());               // audio elements blocked by autoplay policy

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
      console.warn(
        '[voiceChat] No TURN server configured. Calls between users on ' +
        'different networks/behind restrictive NATs will likely fail to connect.'
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
          .catch(() => {});
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
    if (!(stream instanceof MediaStream) || stream.getAudioTracks().length === 0) return;
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

  const clearRemoteVideo = (peerId) => {
    setRemoteVideoStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  // Creates a peer connection with BOTH an audio and a video transceiver.
  // Each starts recvonly unless we already have that specific local track —
  // audio and video are upgraded to sendrecv independently, whenever the
  // corresponding toggle is turned on.
  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    politeRef.current.set(peerId, socket.id < peerId);
    makingOfferRef.current.set(peerId, false);

    let audioTransceiver;
    if (localAudioStreamRef.current) {
      const track = localAudioStreamRef.current.getAudioTracks()[0];
      audioTransceiver = pc.addTransceiver(track, { direction: 'sendrecv', streams: [localAudioStreamRef.current] });
    } else {
      audioTransceiver = pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    let videoTransceiver;
    if (localVideoStreamRef.current) {
      const track = localVideoStreamRef.current.getVideoTracks()[0];
      videoTransceiver = pc.addTransceiver(track, { direction: 'sendrecv', streams: [localVideoStreamRef.current] });
    } else {
      videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
    }

    transceiversRef.current.set(peerId, { audio: audioTransceiver, video: videoTransceiver });

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
      const remoteStream = event.streams[0] || new MediaStream([event.track]);

      if (event.track.kind === 'audio') {
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
        event.track.addEventListener('ended', () => stopWatchingVolume(peerId));
      } else if (event.track.kind === 'video') {
        setRemoteVideoStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
        event.track.addEventListener('ended', () => clearRemoteVideo(peerId));
      }
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
    clearRemoteVideo(peerId);
  };

  // ── Auto-join the mesh the moment we have a connected socket ──
  useEffect(() => {
    if (!socket) return;
    socket.emit('voice:join');

    return () => {
      socket.emit('voice:leave');
      peerConnectionsRef.current.forEach((_, peerId) => closePeerConnection(peerId));
      peerConnectionsRef.current.clear();

      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        localAudioStreamRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      setSpeakingPeerIds([]);
      setRemoteVideoStreams({});
      setIsMicOn(false);
      setIsVideoOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── Signaling handlers ──
  useEffect(() => {
    if (!socket) return;

    const handleExistingParticipants = (existingIds) => {
      existingIds.forEach((peerId) => {
        if (!peerConnectionsRef.current.has(peerId)) {
          createPeerConnection(peerId);
        }
      });
    };

    const handlePeerJoined = () => {
      // no-op — we wait for their offer
    };

    const handleSignal = async ({ from, data }) => {
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);

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

  // ── Mic toggle — soft mute, keeps the same track alive ──
  const toggleMic = async () => {
    if (!socket) return;
    setMicError(null);

    if (isMicOn) {
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
      setIsMicOn(false);
      return;
    }

    if (!localAudioStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localAudioStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];

        peerConnectionsRef.current.forEach((pc, peerId) => {
          const pair = transceiversRef.current.get(peerId);
          if (pair && pair.audio) {
            pair.audio.sender.replaceTrack(track);
            if (pair.audio.sender.setStreams) pair.audio.sender.setStreams(stream);
            pair.audio.direction = 'sendrecv';
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
      localAudioStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    }

    setIsMicOn(true);
  };

  // ── Video toggle — fully stops the camera track when off, not just muted,
  // since people expect the camera's hardware light to actually turn off. ──
  const toggleVideo = async () => {
    if (!socket) return;
    setVideoError(null);

    if (isVideoOn) {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc, peerId) => {
        const pair = transceiversRef.current.get(peerId);
        if (pair && pair.video) {
          pair.video.sender.replaceTrack(null);
          pair.video.direction = 'recvonly';
        }
      });
      setIsVideoOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      localVideoStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach((pc, peerId) => {
        const pair = transceiversRef.current.get(peerId);
        if (pair && pair.video) {
          pair.video.sender.replaceTrack(track);
          if (pair.video.sender.setStreams) pair.video.sender.setStreams(stream);
          pair.video.direction = 'sendrecv';
        } else {
          pc.addTrack(track, stream);
        }
      });

      setIsVideoOn(true);
    } catch (err) {
      console.error('camera permission denied or unavailable:', err);
      setVideoError(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Check your browser permissions.'
          : 'Could not access your camera. Please check your device settings.'
      );
    }
  };

  return {
    isMicOn,
    toggleMic,
    micError,
    isVideoOn,
    toggleVideo,
    videoError,
    speakingPeerIds,
    remoteVideoStreams,     // { peerId: MediaStream } — for rendering <video> tiles
    localVideoStream: localVideoStreamRef.current, // your own camera preview, if you want one
  };
}